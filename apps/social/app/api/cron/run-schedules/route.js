import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyCronAuth } from '@/lib/cron-auth';
import { generateEnrichedReport, getPreviousPeriod } from '@/lib/report-engine';
import { sendReportEmail } from '@/lib/email-sender';
import { renderReportPDF } from '@/lib/pdf-renderer.jsx';
import {
  computeNextRun,
  computeDateRange,
  cadenceToReportType,
} from '@/lib/scheduling/schedule-helpers';
import { createWithArtifact } from '@/lib/artifacts/create';
import { ARTIFACT_MODULE, ARTIFACT_TYPE } from '@/lib/artifacts/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min for Pro plan

/**
 * Cron handler: process all due report schedules.
 * Runs every 15 minutes via vercel.json.
 * - Finds enabled schedules where nextRunAt <= now
 * - Generates report, sends email if recipients configured
 * - Advances nextRunAt for the next run
 */
export async function GET(request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // Cap at 3 to avoid timeout on heavy report generation
  const dueSchedules = await prisma.reportSchedule.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
    take: 3,
  });

  if (dueSchedules.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, errors: [] });
  }

  const results = await Promise.allSettled(
    dueSchedules.map(async (schedule) => {
      // Guard against double execution: skip if lastRunAt is within 60s of now
      if (
        schedule.lastRunAt &&
        now.getTime() - new Date(schedule.lastRunAt).getTime() < 60_000
      ) {
        return { scheduleId: schedule.id, skipped: true };
      }

      // Compute date range and benchmark period
      const { dateStart, dateEnd } = computeDateRange(schedule.cadence, now);
      const benchmarkPeriod = getPreviousPeriod(dateStart, dateEnd);
      const reportType = schedule.reportType || cadenceToReportType(schedule.cadence);

      // Generate report content
      const content = await generateEnrichedReport({
        reportType,
        dateStart,
        dateEnd,
        benchmarkPeriod,
      });

      // Save report record + artifact row
      const reportTitle = `${schedule.name} - ${now.toLocaleDateString()}`;
      const { moduleRow: report } = await createWithArtifact(prisma, {
        module: ARTIFACT_MODULE.SOCIAL,
        type: ARTIFACT_TYPE.REPORT,
        prismaModel: 'report',
        title: reportTitle,
        ownerId: schedule.createdById,
        status: 'READY',
        moduleCreate: (tx) =>
          tx.report.create({
            data: {
              title: reportTitle,
              reportType,
              content,
              aiPct: 95,
              createdById: schedule.createdById,
              status: 'READY',
              chartUrls:
                content.charts?.map((c) => ({
                  id: c.id,
                  label: c.label,
                  imageUrl: c.imageUrl,
                })) || [],
              coveragePeriod: content.coveragePeriod,
              benchmarkPeriod: content.benchmarkPeriod,
            },
          }),
      });

      // Email delivery if recipients configured
      const recipients = Array.isArray(schedule.recipients)
        ? schedule.recipients
        : [];

      if (recipients.length > 0) {
        try {
          const pdfBuffer = await renderReportPDF(report);
          await sendReportEmail({
            report,
            recipients,
            pdfBuffer,
            appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.socialcommand.com',
          });

          await prisma.reportDelivery.create({
            data: {
              reportId: report.id,
              channel: 'EMAIL',
              recipients: JSON.stringify(recipients),
              status: 'SENT',
            },
          });
        } catch (emailErr) {
          // Log delivery failure but don't fail the schedule run
          await prisma.reportDelivery.create({
            data: {
              reportId: report.id,
              channel: 'EMAIL',
              recipients: JSON.stringify(recipients),
              status: 'FAILED',
              error: emailErr.message,
            },
          });
        }
      }

      // Advance schedule to next run
      await prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: now,
          lastReportId: report.id,
          nextRunAt: computeNextRun(schedule.cadence, now),
        },
      });

      return { scheduleId: schedule.id, reportId: report.id };
    })
  );

  const processed = results.filter(
    (r) => r.status === 'fulfilled' && !r.value?.skipped
  ).length;
  const errors = results
    .filter((r) => r.status === 'rejected')
    .map((r) => ({ error: r.reason?.message || String(r.reason) }));

  // ── Ad hoc snapshot re-runs ─────────────────────────────
  const dueSnapshots = await prisma.adHocReport.findMany({
    where: {
      nextSnapshotAt: { lte: now },
      status: 'READY',
    },
    take: 3,
  });

  const snapshotResults = await Promise.allSettled(
    dueSnapshots.map(async (adHoc) => {
      const params = adHoc.reportParams;
      if (!params) return { adHocId: adHoc.id, skipped: true };

      const report = await generateEnrichedReport({
        reportType: params.reportType || 'CUSTOM',
        dateStart: params.dateStart,
        dateEnd: params.dateEnd,
        benchmarkPeriod: null,
      });

      const snapshotTitle = `${params.title || 'Ad Hoc Snapshot'} - ${now.toLocaleDateString()}`;
      const snapshotReportType =
        params.reportType === 'WEEKLY_PERFORMANCE' ||
        params.reportType === 'MONTHLY_SUMMARY' ||
        params.reportType === 'COMPETITIVE_ANALYSIS' ||
        params.reportType === 'KOL_REPORT'
          ? params.reportType
          : 'CUSTOM';
      const { moduleRow: savedReport } = await createWithArtifact(prisma, {
        module: ARTIFACT_MODULE.SOCIAL,
        type: ARTIFACT_TYPE.REPORT,
        prismaModel: 'report',
        title: snapshotTitle,
        ownerId: adHoc.createdById,
        status: 'READY',
        moduleCreate: (tx) =>
          tx.report.create({
            data: {
              title: snapshotTitle,
              reportType: snapshotReportType,
              content: report,
              aiPct: 100,
              createdById: adHoc.createdById,
              status: 'READY',
              chartUrls:
                report.charts?.map((c) => ({
                  id: c.id,
                  label: c.label,
                  imageUrl: c.imageUrl,
                })) || [],
              coveragePeriod: { start: params.dateStart, end: params.dateEnd },
            },
          }),
      });

      // Compute next snapshot time
      const intervals = Array.isArray(adHoc.snapshotIntervals) ? adHoc.snapshotIntervals : [];
      let nextSnapshotAt = null;
      if (intervals.length > 0) {
        const minHours = Math.min(...intervals);
        nextSnapshotAt = new Date(now.getTime() + minHours * 60 * 60 * 1000);
      }

      await prisma.adHocReport.update({
        where: { id: adHoc.id },
        data: { reportId: savedReport.id, nextSnapshotAt },
      });

      return { adHocId: adHoc.id, reportId: savedReport.id };
    })
  );

  const snapshotsProcessed = snapshotResults.filter(
    (r) => r.status === 'fulfilled' && !r.value?.skipped
  ).length;
  const snapshotErrors = snapshotResults
    .filter((r) => r.status === 'rejected')
    .map((r) => ({ error: r.reason?.message || String(r.reason) }));

  return NextResponse.json({
    ok: true,
    processed,
    snapshots: snapshotsProcessed,
    errors: [...errors, ...snapshotErrors],
  });
}
