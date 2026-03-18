import { prisma } from '@/lib/db';
import { put } from '@vercel/blob';
import { renderReportPDF } from '@/lib/pdf-renderer';
import { logger } from '@/lib/logger';

const log = logger('api/pdf');

export const maxDuration = 30;

export async function GET(req, { params }) {
  try {
    const { id } = await params;

    const report = await prisma.report.findUnique({ where: { id } });
    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    // Generate PDF buffer
    const buffer = await renderReportPDF(report);

    // Upload to Vercel Blob for persistent URL
    const blob = await put(
      `reports/pdf/${report.id}-${Date.now()}.pdf`,
      buffer,
      { access: 'public', contentType: 'application/pdf' }
    );

    // Log delivery and increment downloads in parallel — allSettled so
    // a logging failure doesn't prevent returning the PDF URL
    await Promise.allSettled([
      prisma.reportDelivery.create({
        data: {
          reportId: report.id,
          channel: 'PDF_DOWNLOAD',
          recipients: [],
          status: 'SENT',
        },
      }),
      prisma.report.update({
        where: { id: report.id },
        data: { downloads: { increment: 1 } },
      }),
    ]);

    return Response.json({ url: blob.url });
  } catch (error) {
    log.error('PDF generation failed', { error, reportId: (await params).id });
    return Response.json(
      { error: 'PDF generation failed' },
      { status: 500 }
    );
  }
}
