import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { generateWeeklyReport, generateCompetitiveAnalysis, generateListeningSummary } from '../ai/reports';
import { generateEnrichedReport, getPreviousPeriod } from '../report-engine';
import { renderReportPDF } from '../pdf-renderer.jsx';
import { sendReportEmail } from '../email-sender';
import { computeBenchmarkDeltas, resolveComparisonPeriod } from '../benchmark-compare';

export const reportsRouter = router({
  /**
   * reports.list
   * List all reports with title, type, and date.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.report.findMany({
      select: {
        id: true,
        title: true,
        reportType: true,
        aiPct: true,
        createdAt: true,
        updatedAt: true,
        downloads: true,
        createdById: true,
        status: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }),

  /**
   * reports.getById
   * Return a single report by ID including all fields.
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.report.findUnique({ where: { id: input.id } });
    }),

  /**
   * reports.generate
   * Generate an AI-powered report.
   * WEEKLY_PERFORMANCE and MONTHLY_SUMMARY use the enriched report engine.
   * COMPETITIVE_ANALYSIS and KOL_REPORT use legacy generators with typeSpecific wrapping.
   * CUSTOM accepts arbitrary dateStart/dateEnd for ad hoc reports.
   */
  generate: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1),
        reportType: z.enum([
          'WEEKLY_PERFORMANCE',
          'MONTHLY_SUMMARY',
          'COMPETITIVE_ANALYSIS',
          'KOL_REPORT',
          'CUSTOM',
        ]),
        prompt: z.string().optional(),
        dateStart: z.string().optional(),
        dateEnd: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma, user } = ctx;
      const { title, reportType, prompt } = input;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      let report;
      try {
        // Create initial report record with GENERATING status
        report = await prisma.report.create({
          data: {
            title,
            reportType,
            prompt: prompt ?? null,
            content: {},
            aiPct: 0,
            createdById: user.id,
            status: 'GENERATING',
          },
        });
        // Enriched path: WEEKLY_PERFORMANCE, MONTHLY_SUMMARY, CUSTOM
        if (reportType === 'WEEKLY_PERFORMANCE' || reportType === 'MONTHLY_SUMMARY' || reportType === 'CUSTOM') {
          let dateStart, dateEnd;

          if (reportType === 'CUSTOM' && input.dateStart && input.dateEnd) {
            // Ad hoc reports with custom date ranges
            dateStart = new Date(input.dateStart);
            dateEnd = new Date(input.dateEnd);
          } else {
            dateStart = reportType === 'WEEKLY_PERFORMANCE' ? sevenDaysAgo : thirtyDaysAgo;
            dateEnd = now;
          }

          // Auto-compute benchmark period for cadence reports
          const benchmarkPeriod = reportType !== 'CUSTOM'
            ? getPreviousPeriod(dateStart, dateEnd)
            : null;

          const content = await generateEnrichedReport({
            reportType,
            dateStart,
            dateEnd,
            benchmarkPeriod,
          });

          // Extract chart URLs for separate storage
          const chartUrls = content.charts?.map((c) => ({
            id: c.id,
            label: c.label,
            imageUrl: c.imageUrl,
          })) || [];

          return prisma.report.update({
            where: { id: report.id },
            data: {
              content,
              aiPct: 95,
              status: 'READY',
              chartUrls,
              coveragePeriod: content.coveragePeriod,
              benchmarkPeriod: content.benchmarkPeriod,
            },
          });
        }

        // Legacy path: COMPETITIVE_ANALYSIS
        if (reportType === 'COMPETITIVE_ANALYSIS') {
          const [accounts, competitors] = await Promise.all([
            prisma.account.findMany({ where: { isActive: true }, include: { accountMetrics: { orderBy: { date: 'desc' }, take: 1 } } }),
            prisma.competitor.findMany({ include: { metrics: { orderBy: { date: 'desc' }, take: 1 } } }),
          ]);

          const ourMetrics = accounts[0]?.accountMetrics?.[0];
          const legacyContent = await generateCompetitiveAnalysis(
            { followers: ourMetrics?.followers || 0, engagementRate: 0, postsCount: ourMetrics?.totalPosts || 0 },
            competitors.map((c) => ({ name: c.name, metrics: c.metrics[0] || {} }))
          );

          // Wrap legacy content in canonical schema
          const content = {
            kpis: [],
            executiveSummary: legacyContent.overview || '',
            sentimentThemes: null,
            charts: [],
            recommendations: legacyContent.recommendations || [],
            topContent: [],
            coveragePeriod: { start: thirtyDaysAgo.toISOString(), end: now.toISOString() },
            benchmarkPeriod: null,
            typeSpecific: legacyContent,
          };

          return prisma.report.update({
            where: { id: report.id },
            data: {
              content,
              aiPct: 95,
              status: 'READY',
              coveragePeriod: content.coveragePeriod,
            },
          });
        }

        // Legacy path: KOL_REPORT (uses listening summary as fallback)
        const [hits, topics] = await Promise.all([
          prisma.listeningHit.findMany({ where: { detectedAt: { gte: sevenDaysAgo } } }),
          prisma.listeningTopic.findMany({ where: { active: true } }),
        ]);
        const legacyContent = await generateListeningSummary(hits, topics);

        const content = {
          kpis: [],
          executiveSummary: legacyContent.sentimentOverview?.summary || '',
          sentimentThemes: null,
          charts: [],
          recommendations: [],
          topContent: [],
          coveragePeriod: { start: sevenDaysAgo.toISOString(), end: now.toISOString() },
          benchmarkPeriod: null,
          typeSpecific: legacyContent,
        };

        return prisma.report.update({
          where: { id: report.id },
          data: {
            content,
            aiPct: 95,
            status: 'READY',
            coveragePeriod: content.coveragePeriod,
          },
        });
      } catch (err) {
        console.error('Report generation error:', err);

        // Save FAILED status to the report record so it's visible in the repository
        if (report?.id) {
          await prisma.report.update({
            where: { id: report.id },
            data: {
              content: {
                kpis: [],
                executiveSummary: `Report generation failed: ${err.message}`,
                sentimentThemes: null,
                charts: [],
                recommendations: [],
                topContent: [],
                coveragePeriod: { start: '', end: '' },
                benchmarkPeriod: null,
              },
              aiPct: 0,
              status: 'FAILED',
            },
          });
        }

        // Always throw so the client's onError fires and shows the error UI
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Report generation failed: ${err.message}`,
        });
      }
    }),

  /**
   * reports.getBenchmarks
   * Return historical data for benchmarks -- aggregated post + account metrics.
   */
  getBenchmarks: protectedProcedure.query(async ({ ctx }) => {
    const { prisma } = ctx;

    // Monthly aggregates for the last 6 months
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const postMetrics = await prisma.postMetrics.findMany({
      where: { fetchedAt: { gte: sixMonthsAgo } },
      select: {
        fetchedAt: true,
        impressions: true,
        engagements: true,
        engagementRate: true,
        likes: true,
        retweets: true,
        replies: true,
      },
      orderBy: { fetchedAt: 'asc' },
      take: 5000, // Safety cap per research pitfall #3
    });

    // Group by month
    const byMonth = {};
    for (const m of postMetrics) {
      const monthKey = m.fetchedAt.toISOString().slice(0, 7); // YYYY-MM
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = {
          impressions: 0,
          engagements: 0,
          rates: [],
          likes: 0,
          retweets: 0,
          replies: 0,
          count: 0,
        };
      }
      byMonth[monthKey].impressions += m.impressions;
      byMonth[monthKey].engagements += m.engagements;
      byMonth[monthKey].rates.push(m.engagementRate);
      byMonth[monthKey].likes += m.likes;
      byMonth[monthKey].retweets += m.retweets;
      byMonth[monthKey].replies += m.replies;
      byMonth[monthKey].count += 1;
    }

    // Also get follower counts per month from AccountMetrics
    const accountMetrics = await prisma.accountMetrics.findMany({
      where: { date: { gte: sixMonthsAgo } },
      select: { date: true, followers: true },
      orderBy: { date: 'asc' },
    });
    // Take the max follower count per month (last snapshot of month)
    const followersByMonth = {};
    for (const am of accountMetrics) {
      const mk = am.date.toISOString().slice(0, 7);
      followersByMonth[mk] = Math.max(followersByMonth[mk] || 0, am.followers || 0);
    }

    // Sentiment per month from listening hits
    const sentHits = await prisma.listeningHit.findMany({
      where: { detectedAt: { gte: sixMonthsAgo } },
      select: { detectedAt: true, sentiment: true },
    });
    const sentByMonth = {};
    for (const h of sentHits) {
      const mk = h.detectedAt.toISOString().slice(0, 7);
      if (!sentByMonth[mk]) sentByMonth[mk] = { pos: 0, total: 0 };
      sentByMonth[mk].total++;
      if (h.sentiment === 'POSITIVE') sentByMonth[mk].pos++;
    }

    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => {
        const engRate = data.rates.length > 0
          ? parseFloat((data.rates.reduce((a, b) => a + b, 0) / data.rates.length).toFixed(2))
          : 0;
        const sent = sentByMonth[month];
        const sentiment = sent && sent.total > 0
          ? Math.round((sent.pos / sent.total) * 100)
          : null;
        return {
          month,
          engRate,
          impressions: data.impressions,
          engagements: data.engagements,
          followers: followersByMonth[month] || null,
          sentiment,
          sovPct: null, // Computed from competitor metrics when available
          likes: data.likes,
          retweets: data.retweets,
          replies: data.replies,
          postCount: data.count,
        };
      });
  }),

  /**
   * reports.emailReport
   * Send a report via email with branded HTML and PDF attachment.
   * Logs delivery as ReportDelivery record.
   */
  emailReport: protectedProcedure
    .input(
      z.object({
        reportId: z.string(),
        recipients: z.array(z.string().email()).min(1),
        subject: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;

      // Fetch report
      const report = await prisma.report.findUnique({ where: { id: input.reportId } });
      if (!report) throw new Error('Report not found');

      try {
        // Generate PDF for attachment
        const pdfBuffer = await renderReportPDF(report);

        // Determine app URL for CTA link
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.socialcommand.com';

        // Send email
        await sendReportEmail({
          report,
          recipients: input.recipients,
          pdfBuffer,
          appUrl,
        });

        // Log successful delivery
        const delivery = await prisma.reportDelivery.create({
          data: {
            reportId: input.reportId,
            channel: 'EMAIL',
            recipients: JSON.stringify(input.recipients),
            status: 'SENT',
          },
        });

        return { success: true, deliveryId: delivery.id };
      } catch (err) {
        console.error('[emailReport] Send failed:', err);

        // Log failed delivery
        const delivery = await prisma.reportDelivery.create({
          data: {
            reportId: input.reportId,
            channel: 'EMAIL',
            recipients: JSON.stringify(input.recipients),
            status: 'FAILED',
            error: err.message || 'Unknown error',
          },
        });

        return { success: false, deliveryId: delivery.id };
      }
    }),

  /**
   * reports.deliveryLog
   * Return delivery history for a report, newest first.
   */
  deliveryLog: protectedProcedure
    .input(z.object({ reportId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.reportDelivery.findMany({
        where: { reportId: input.reportId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }),

  /**
   * reports.compareBenchmark
   * Ephemeral benchmark comparison: computes KPI deltas between a report's
   * coverage period and a comparison period (WoW/MoM/QoQ/YoY or milestone).
   * Results are returned directly, not saved to the report record.
   */
  compareBenchmark: protectedProcedure
    .input(
      z.object({
        reportId: z.string(),
        comparisonType: z.enum(['WoW', 'MoM', 'QoQ', 'YoY', 'MILESTONE']),
        milestoneId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { prisma } = ctx;

      // 1. Fetch the report to get coveragePeriod
      const report = await prisma.report.findUnique({
        where: { id: input.reportId },
        select: { coveragePeriod: true },
      });

      if (!report || !report.coveragePeriod) {
        throw new Error('Report not found or has no coverage period');
      }

      const coveragePeriod = {
        start: new Date(report.coveragePeriod.start),
        end: new Date(report.coveragePeriod.end),
      };

      // 2. Resolve the benchmark period
      let benchmarkPeriod;

      if (input.comparisonType === 'MILESTONE') {
        if (!input.milestoneId) {
          throw new Error('milestoneId is required for MILESTONE comparison');
        }
        const milestone = await prisma.milestone.findUnique({
          where: { id: input.milestoneId },
        });
        if (!milestone) {
          throw new Error('Milestone not found');
        }
        benchmarkPeriod = {
          start: milestone.startDate,
          end: milestone.endDate,
        };
      } else {
        benchmarkPeriod = resolveComparisonPeriod(
          coveragePeriod.start,
          coveragePeriod.end,
          input.comparisonType
        );
        if (!benchmarkPeriod) {
          throw new Error('Could not resolve comparison period');
        }
      }

      // 3. Compute deltas
      return computeBenchmarkDeltas(coveragePeriod, benchmarkPeriod);
    }),
});
