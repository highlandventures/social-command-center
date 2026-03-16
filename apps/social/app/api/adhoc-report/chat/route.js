import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { API_COSTS } from '@/lib/api-costs';
import { ADHOC_SYSTEM_PROMPT } from '@/lib/adhoc/system-prompt';
import { extractReportParams } from '@/lib/adhoc/param-extractor';

export const maxDuration = 60;

export async function POST(req) {
  try {
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, adHocId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'Messages are required' }, { status: 400 });
    }

    // Get or create AdHocReport
    let activeAdHocId = adHocId;
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();

    if (activeAdHocId) {
      // Save latest user message to existing ad hoc report
      if (lastUserMessage) {
        await prisma.adHocReportMessage.create({
          data: {
            adHocId: activeAdHocId,
            role: 'user',
            content: lastUserMessage.content,
          },
        });
      }
    } else {
      // Create new ad hoc report
      const adHocReport = await prisma.adHocReport.create({
        data: {
          createdById: session.user.id,
          status: 'SCOPING',
        },
      });
      activeAdHocId = adHocReport.id;

      if (lastUserMessage) {
        await prisma.adHocReportMessage.create({
          data: {
            adHocId: activeAdHocId,
            role: 'user',
            content: lastUserMessage.content,
          },
        });
      }
    }

    // Stream response from Claude
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: ADHOC_SYSTEM_PROMPT,
      messages,
      maxTokens: 2048,
      async onFinish({ text, usage }) {
        try {
          // Save assistant message
          await prisma.adHocReportMessage.create({
            data: {
              adHocId: activeAdHocId,
              role: 'assistant',
              content: text,
            },
          });

          // Check for report params in assistant response
          const params = extractReportParams(text);
          if (params) {
            await prisma.adHocReport.update({
              where: { id: activeAdHocId },
              data: {
                reportParams: params,
                title: params.title || null,
              },
            });
          }

          // Update timestamp
          await prisma.adHocReport.update({
            where: { id: activeAdHocId },
            data: { updatedAt: new Date() },
          });

          // Log cost to APICallLog
          const inputTokens = usage?.promptTokens || 0;
          const outputTokens = usage?.completionTokens || 0;
          const estimatedCost =
            (inputTokens * API_COSTS.CLAUDE_SONNET_INPUT_PER_TOKEN) +
            (outputTokens * API_COSTS.CLAUDE_SONNET_OUTPUT_PER_TOKEN);

          await prisma.aPICallLog.create({
            data: {
              provider: 'claude',
              endpoint: 'adhoc-report-chat',
              method: 'POST',
              statusCode: 200,
              responseTime: 0,
              tokensUsed: inputTokens + outputTokens,
              estimatedCost,
            },
          });
        } catch (err) {
          console.error('[adhoc-report/chat] onFinish error:', err);
        }
      },
    });

    return result.toDataStreamResponse({
      headers: { 'X-AdHoc-Id': activeAdHocId },
    });
  } catch (err) {
    console.error('[adhoc-report/chat] error:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
