// Email sender module for report distribution
// Uses nodemailer SMTP transport with React Email template rendering

import nodemailer from 'nodemailer';
import { render } from '@react-email/render';
import { ReportEmail } from './email-templates/report-email.jsx';

// Create transport at module scope for warm reuse in serverless
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a report email to specified recipients with optional PDF attachment.
 *
 * @param {Object} params
 * @param {Object} params.report - Report object with id, title, content
 * @param {string[]} params.recipients - Array of email addresses
 * @param {Buffer|null} params.pdfBuffer - PDF buffer for attachment (optional)
 * @param {string} params.appUrl - Base app URL for CTA link
 * @returns {{ messageId: string, accepted: string[], rejected: string[] }}
 */
export async function sendReportEmail({ report, recipients, pdfBuffer, appUrl }) {
  // Render React Email template to HTML
  const html = await render(ReportEmail({ report, appUrl }));

  // Build attachments
  const attachments = [];
  if (pdfBuffer) {
    // Sanitize title for filename
    const safeName = (report.title || 'report')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
    attachments.push({
      filename: `${safeName}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    });
  }

  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || 'Social Command <noreply@figure.com>',
    to: recipients.join(', '),
    subject: `Report: ${report.title}`,
    html,
    attachments,
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
}
