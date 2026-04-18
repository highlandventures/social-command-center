import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { extractReportParams } from '../adhoc/param-extractor';
import { generateEnrichedReport } from '../report-engine';
import { createWithArtifact } from '../artifacts/create';
import { ARTIFACT_MODULE, ARTIFACT_TYPE } from '../artifacts/types';

export const adhocReportsRouter = router({
  /**
   * adhocReports.list
   * Returns all ad hoc reports for current user, ordered by updatedAt desc.
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.adHocReport.findMany({
      where: { createdById: ctx.user.id },
      select: {
        id: true,
        title: true,
        status: true,
        reportId: true,
        reportParams: true,
        snapshotIntervals: true,
        nextSnapshotAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }),

  /**
   * adhocReports.get
   * Returns a single ad hoc report with all messages for the chat page.
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const report = await ctx.prisma.adHocReport.findUnique({
        where: { id: input.id },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (!report) {
        throw new Error('Ad hoc report not found');
      }
      return report;
    }),

  /**
   * adhocReports.create
   * Creates a new ad hoc report with status SCOPING.
   */
  create: protectedProcedure.mutation(async ({ ctx }) => {
    return ctx.prisma.adHocReport.create({
      data: {
        createdById: ctx.user.id,
        status: 'SCOPING',
      },
    });
  }),

  /**
   * adhocReports.saveMessage
   * Saves a chat message. If assistant message contains generate params,
   * updates the ad hoc report with extracted params.
   */
  saveMessage: protectedProcedure
    .input(z.object({
      adHocId: z.string(),
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.prisma.adHocReportMessage.create({
        data: {
          adHocId: input.adHocId,
          role: input.role,
          content: input.content,
        },
      });

      // Check assistant messages for report params
      if (input.role === 'assistant') {
        const params = extractReportParams(input.content);
        if (params) {
          await ctx.prisma.adHocReport.update({
            where: { id: input.adHocId },
            data: {
              reportParams: params,
              title: params.title || null,
            },
          });
        }
      }

      return message;
    }),

  /**
   * adhocReports.generate
   * Generates a report from extracted params. Sets status GENERATING then READY.
   */
  generate: protectedProcedure
    .input(z.object({
      adHocId: z.string(),
      reportParams: z.object({
        title: z.string().optional(),
        dateStart: z.string(),
        dateEnd: z.string(),
        reportType: z.string(),
        metricsScope: z.string().optional(),
        comparisonBaseline: z.string().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const { adHocId, reportParams } = input;

      // Set status to GENERATING
      await ctx.prisma.adHocReport.update({
        where: { id: adHocId },
        data: { status: 'GENERATING', reportParams },
      });

      try {
        // Generate the report
        const report = await generateEnrichedReport({
          reportType: reportParams.reportType,
          dateStart: reportParams.dateStart,
          dateEnd: reportParams.dateEnd,
          benchmarkPeriod: null,
        });

        // Create Report record + artifact row
        const reportTitle = reportParams.title || `Ad Hoc Report - ${new Date().toLocaleDateString()}`;
        const resolvedReportType = reportParams.reportType === 'WEEKLY_PERFORMANCE' ||
                    reportParams.reportType === 'MONTHLY_SUMMARY' ||
                    reportParams.reportType === 'COMPETITIVE_ANALYSIS' ||
                    reportParams.reportType === 'KOL_REPORT'
          ? reportParams.reportType
          : 'CUSTOM';
        const { moduleRow: savedReport } = await createWithArtifact(ctx.prisma, {
          module: ARTIFACT_MODULE.SOCIAL,
          type: ARTIFACT_TYPE.REPORT,
          prismaModel: 'report',
          title: reportTitle,
          ownerId: ctx.user.id,
          status: 'READY',
          moduleCreate: (tx) =>
            tx.report.create({
              data: {
                title: reportTitle,
                reportType: resolvedReportType,
                content: report.content || {},
                chartUrls: report.chartUrls || [],
                coveragePeriod: { start: reportParams.dateStart, end: reportParams.dateEnd },
                aiPct: 100,
                createdById: ctx.user.id,
                status: 'READY',
              },
            }),
        });

        // Link report and set READY
        await ctx.prisma.adHocReport.update({
          where: { id: adHocId },
          data: {
            reportId: savedReport.id,
            status: 'READY',
            title: reportParams.title || null,
          },
        });

        return { id: adHocId, reportId: savedReport.id, status: 'READY' };
      } catch (err) {
        console.error('[adhoc-reports] generate error:', err);
        await ctx.prisma.adHocReport.update({
          where: { id: adHocId },
          data: { status: 'FAILED' },
        });
        throw err;
      }
    }),

  /**
   * adhocReports.rerun
   * Re-runs report generation using stored reportParams.
   */
  rerun: protectedProcedure
    .input(z.object({ adHocId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const adHoc = await ctx.prisma.adHocReport.findUnique({
        where: { id: input.adHocId },
      });

      if (!adHoc?.reportParams) {
        throw new Error('No report params stored for re-run');
      }

      const params = adHoc.reportParams;

      await ctx.prisma.adHocReport.update({
        where: { id: input.adHocId },
        data: { status: 'GENERATING' },
      });

      try {
        const report = await generateEnrichedReport({
          reportType: params.reportType,
          dateStart: params.dateStart,
          dateEnd: params.dateEnd,
          benchmarkPeriod: null,
        });

        const rerunTitle = params.title || `Ad Hoc Re-run - ${new Date().toLocaleDateString()}`;
        const rerunReportType = params.reportType === 'WEEKLY_PERFORMANCE' ||
                    params.reportType === 'MONTHLY_SUMMARY' ||
                    params.reportType === 'COMPETITIVE_ANALYSIS' ||
                    params.reportType === 'KOL_REPORT'
          ? params.reportType
          : 'CUSTOM';
        const { moduleRow: savedReport } = await createWithArtifact(ctx.prisma, {
          module: ARTIFACT_MODULE.SOCIAL,
          type: ARTIFACT_TYPE.REPORT,
          prismaModel: 'report',
          title: rerunTitle,
          ownerId: ctx.user.id,
          status: 'READY',
          moduleCreate: (tx) =>
            tx.report.create({
              data: {
                title: rerunTitle,
                reportType: rerunReportType,
                content: report.content || {},
                chartUrls: report.chartUrls || [],
                coveragePeriod: { start: params.dateStart, end: params.dateEnd },
                aiPct: 100,
                createdById: ctx.user.id,
                status: 'READY',
              },
            }),
        });

        await ctx.prisma.adHocReport.update({
          where: { id: input.adHocId },
          data: {
            reportId: savedReport.id,
            status: 'READY',
          },
        });

        return { id: input.adHocId, reportId: savedReport.id, status: 'READY' };
      } catch (err) {
        console.error('[adhoc-reports] rerun error:', err);
        await ctx.prisma.adHocReport.update({
          where: { id: input.adHocId },
          data: { status: 'FAILED' },
        });
        throw err;
      }
    }),

  /**
   * adhocReports.configureSnapshots
   * Sets snapshot intervals and computes nextSnapshotAt.
   */
  configureSnapshots: protectedProcedure
    .input(z.object({
      adHocId: z.string(),
      intervals: z.array(z.number()), // hours, e.g. [24, 48, 72]
    }))
    .mutation(async ({ ctx, input }) => {
      const { adHocId, intervals } = input;
      const minHours = Math.min(...intervals);
      const nextSnapshotAt = new Date(Date.now() + minHours * 60 * 60 * 1000);

      return ctx.prisma.adHocReport.update({
        where: { id: adHocId },
        data: {
          snapshotIntervals: intervals,
          nextSnapshotAt,
        },
      });
    }),
});
