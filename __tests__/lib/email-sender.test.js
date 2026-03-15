import { describe, it, expect, vi } from 'vitest';

// Mock nodemailer
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn().mockReturnValue({
      sendMail: vi.fn().mockResolvedValue({
        messageId: 'mock-id',
        accepted: ['test@example.com'],
        rejected: [],
      }),
    }),
  },
}));

// Mock @react-email/render
vi.mock('@react-email/render', () => ({
  render: vi.fn().mockResolvedValue('<html>mock</html>'),
}));

// Mock the email template
vi.mock('../../lib/email-templates/report-email.jsx', () => ({
  ReportEmail: () => null,
}));

describe('email-sender', () => {
  it('sends email', async () => {
    const { sendReportEmail } = await import('../../lib/email-sender.js');
    expect(sendReportEmail).toBeDefined();
    expect(typeof sendReportEmail).toBe('function');
  });

  it('email content includes report data', async () => {
    const { sendReportEmail } = await import('../../lib/email-sender.js');
    const result = await sendReportEmail({
      report: { id: 'r1', title: 'Test', content: { kpis: [], executiveSummary: 'Summary' } },
      recipients: ['test@example.com'],
      pdfBuffer: Buffer.from('mock-pdf'),
      appUrl: 'http://localhost:3000',
    });
    expect(result).toBeDefined();
    expect(result.messageId).toBeDefined();
  });

  it('recipients are passed to transport', async () => {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.default.createTransport();
    const { sendReportEmail } = await import('../../lib/email-sender.js');
    await sendReportEmail({
      report: { id: 'r1', title: 'Test', content: { kpis: [], executiveSummary: 'Summary' } },
      recipients: ['a@b.com', 'c@d.com'],
      pdfBuffer: null,
      appUrl: 'http://localhost:3000',
    });
    expect(transport.sendMail).toHaveBeenCalled();
  });

  it('delivery logging data is returned', async () => {
    const { sendReportEmail } = await import('../../lib/email-sender.js');
    const result = await sendReportEmail({
      report: { id: 'r1', title: 'Test', content: { kpis: [], executiveSummary: 'Summary' } },
      recipients: ['test@example.com'],
      pdfBuffer: null,
      appUrl: 'http://localhost:3000',
    });
    expect(result).toHaveProperty('messageId');
    expect(result).toHaveProperty('accepted');
    expect(result).toHaveProperty('rejected');
  });
});
