import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

export function getMailConfig() {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const fromEmail = (process.env.MAIL_FROM || user).trim();
  const fromName = (process.env.MAIL_FROM_NAME || 'AWS BLASTER').trim();
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);

  return { user, pass, fromEmail, fromName, host, port };
}

export function isMailConfigured() {
  const { user, pass } = getMailConfig();
  return Boolean(user && pass);
}

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const { user, pass, host, port } = getMailConfig();

  if (!user || !pass) {
    throw new Error(
      'Gmail is not configured. Set SMTP_USER and SMTP_PASS (Google App Password) on Vercel.'
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });

  return transporter;
}

export function formatMailError(error: unknown): string {
  const e = error as any;
  const raw = String(e?.response || e?.message || e || 'SMTP error');

  if (/Invalid login|EAUTH|535|Username and Password not accepted/i.test(raw)) {
    return (
      'Gmail login failed. Use a 16-character App Password (not your normal password). ' +
      'SMTP_USER must be the full Gmail address. Enable 2-Step Verification first.'
    );
  }

  if (/Daily user sending limit|User-rate limit exceeded|421-4\.7\.0|450/i.test(raw)) {
    return 'Gmail sending limit hit. Wait a few hours or try again tomorrow.';
  }

  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ESOCKET/i.test(raw)) {
    return `Cannot reach Gmail SMTP. ${raw}`;
  }

  return raw.slice(0, 500);
}

export async function sendMail({
  to,
  subject,
  text,
  html,
  fromName,
}: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  fromName?: string;
}) {
  const cfg = getMailConfig();
  const t = getTransporter();

  const recipients = Array.isArray(to)
    ? to.map((e) => e.trim()).filter(Boolean).join(', ')
    : to.trim();

  const name = (fromName || cfg.fromName || '').trim();
  const from = name
    ? { name, address: cfg.fromEmail || cfg.user }
    : cfg.fromEmail || cfg.user;

  const plain =
    (text && text.trim()) ||
    (html
      ? html
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : '') ||
    '.';

  const info = await t.sendMail({
    from,
    to: recipients,
    subject: subject.slice(0, 200),
    text: plain,
    html: html || undefined,
  });

  return info;
}
