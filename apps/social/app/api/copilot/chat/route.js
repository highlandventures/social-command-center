import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { API_COSTS } from '@/lib/api-costs';
import { buildSystemPrompt } from '@/lib/copilot/system-prompt';

export const maxDuration = 60;

export async function POST(req) {
  try {
    // Auth check
    const session = await getSession();
    if (!session?.user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, accountId, postMode, platform, threadId } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'Messages are required' }, { status: 400 });
    }

    // Build system prompt with intel context and brand voice
    const systemPrompt = await buildSystemPrompt({ accountId, postMode, platform });

    // Get or create thread for message persistence
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    let activeThreadId = threadId;

    if (activeThreadId) {
      // Save latest user message to existing thread
      if (lastUserMessage) {
        await prisma.copilotMessage.create({
          data: {
            threadId: activeThreadId,
            role: 'user',
            content: lastUserMessage.content,
          },
        });
      }
    } else {
      // Create new thread and save user message
      const thread = await prisma.copilotThread.create({
        data: {
          userId: session.user.id,
          accountId: accountId || null,
          title: lastUserMessage?.content?.slice(0, 100) || null,
        },
      });
      activeThreadId = thread.id;

      if (lastUserMessage) {
        await prisma.copilotMessage.create({
          data: {
            threadId: activeThreadId,
            role: 'user',
            content: lastUserMessage.content,
          },
        });
      }
    }

    // Stream response from Claude
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages,
      maxTokens: 2048,
      async onFinish({ text, usage }) {
        try {
          // Save assistant message
          await prisma.copilotMessage.create({
            data: {
              threadId: activeThreadId,
              role: 'assistant',
              content: text,
            },
          });

          // Update thread timestamp
          await prisma.copilotThread.update({
            where: { id: activeThreadId },
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
              endpoint: 'copilot-chat',
              method: 'POST',
              statusCode: 200,
              responseTime: 0,
              tokensUsed: inputTokens + outputTokens,
              estimatedCost,
              accountId: accountId || null,
            },
          });
        } catch (err) {
          console.error('[copilot/chat] onFinish error:', err);
        }
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    console.error('[copilot/chat] error:', err);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
