import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DESTINATION = 'marketing@figure.com';

function buildTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function POST(request) {
  const form = await request.formData();
  const name = (form.get('name') || '').toString().trim();
  const email = (form.get('email') || '').toString().trim();
  const company = (form.get('company') || '').toString().trim();
  const role = (form.get('role') || '').toString().trim();
  const notes = (form.get('notes') || '').toString().trim();
  const persona = (form.get('persona') || '').toString().trim();

  if (!name || !email || !company) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  const subject = `RWA House contact — ${name}${persona ? ` · ${persona}` : ''}`;
  const body = [
    `Name:     ${name}`,
    `Email:    ${email}`,
    `Company:  ${company}`,
    role && `Role:     ${role}`,
    persona && `Persona:  ${persona}`,
    '',
    notes && 'Notes:',
    notes && notes,
    '',
    '—',
    'Submitted from https://figure.marketing/rwahouse',
  ]
    .filter((line) => line !== false && line !== undefined)
    .join('\n');

  try {
    await buildTransport().sendMail({
      from: process.env.SMTP_FROM || 'RWA House <noreply@figure.com>',
      to: DESTINATION,
      replyTo: email,
      subject,
      text: body,
    });
  } catch (err) {
    console.error('[rwahouse-contact] send failed:', err?.message);
    const url = new URL('/rwahouse', request.url);
    url.searchParams.set('submitted', 'error');
    return NextResponse.redirect(url, { status: 303 });
  }

  const url = new URL('/rwahouse', request.url);
  url.searchParams.set('submitted', '1');
  return NextResponse.redirect(url, { status: 303 });
}
