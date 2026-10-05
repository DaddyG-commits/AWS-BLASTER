import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let transporter: Transporter | null = null;

export type EmailAttachment = {
  filename: string;
  content: string; // base64
  contentType?: string;
};

function randHex(bytes: number): string {
  const alphabet = 'abcdef0123456789';
  let out = '';
  for (let i = 0; i < bytes * 2; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function extractEmail(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return '';
  const angle = s.match(/<([^>]+@[^>]+)>/);
  if (angle) return angle[1].trim().toLowerCase();
  const plain = s.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (plain) return plain[0].toLowerCase();
  return s.includes('@') ? s.toLowerCase() : '';
}

function cleanDisplayName(raw: string, fallback = 'CryptoByt'): string {
  let s = (raw || '').trim();
  if (!s) return fallback;
  const named = s.match(/^(.+?)\s*<[^>]+>$/);
  if (named) s = named[1].trim();
  s = s.replace(/[<>"']/g, '');
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s || s.length > 40) return fallback;
  return s;
}

export function getMailConfig() {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = extractEmail(
    process.env.SMTP_USER || process.env.GMAIL_USER || ''
  );
  const pass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '')
    .replace(/\s+/g, '')
    .trim();

  const fromRaw =
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    user ||
    '';
  let fromEmail = extractEmail(fromRaw) || user;

  const fromName = cleanDisplayName(
    process.env.MAIL_FROM_NAME ||
      process.env.SMTP_FROM_NAME ||
      process.env.FROM_NAME ||
      'CryptoByt',
    'CryptoByt'
  );

  const replyTo =
    extractEmail(process.env.MAIL_REPLY_TO || process.env.SMTP_REPLY_TO || '') ||
    fromEmail;

  const envelopeFrom = extractEmail(
    process.env.SMTP_ENVELOPE_FROM || process.env.SMTP_RETURN_PATH || ''
  );

  const from =
    fromName && fromEmail
      ? { name: fromName, address: fromEmail }
      : fromEmail;

  const domain = fromEmail.includes('@')
    ? fromEmail.split('@')[1].toLowerCase()
    : '';

  const isGmail =
    host.includes('gmail.com') ||
    host.includes('googlemail.com') ||
    user.endsWith('@gmail.com') ||
    user.endsWith('@googlemail.com');

  const isSes = host.includes('amazonaws.com') || host.includes('email-smtp');

  return {
    host,
    port,
    user,
    pass,
    from,
    fromEmail,
    fromName,
    replyTo,
    envelopeFrom,
    domain,
    isGmail,
    isSes,
  };
}

export function isMailConfigured() {
  const { user, pass } = getMailConfig();
  return Boolean(user && pass);
}

export function resetTransporter() {
  if (transporter) {
    try {
      transporter.close();
    } catch {
      /* ignore */
    }
  }
  transporter = null;
}

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const { host, port, user, pass, isGmail, isSes } = getMailConfig();

  if (!user || !pass) {
    throw new Error(
      'SMTP not configured. Set SMTP_USER and SMTP_PASS (Gmail App Password or SES SMTP credentials).'
    );
  }

  const maxConn = Math.min(
    Math.max(
      parseInt(
        process.env.SMTP_MAX_CONNECTIONS || (isGmail ? '2' : isSes ? '5' : '3'),
        10
      ),
      1
    ),
    10
  );

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT !== '0',
    },
    pool: true,
    maxConnections: maxConn,
    maxMessages: 200,
    rateDelta: 1000,
    rateLimit: isGmail ? 8 : isSes ? 14 : 12,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 25000,
    name: process.env.SMTP_HELO || process.env.SMTP_HOSTNAME || undefined,
  });

  return transporter;
}

export function formatMailError(error: unknown): string {
  const e = error as any;
  const raw = String(e?.response || e?.message || e || 'SMTP error');
  const code = String(e?.code || e?.responseCode || '');

  if (
    /Invalid login|EAUTH|535|Username and Password not accepted/i.test(raw) ||
    code === 'EAUTH'
  ) {
    return (
      'SMTP login failed. For Gmail: use a 16-char App Password + 2FA. ' +
      'For SES: use SMTP credentials from the SES console (not IAM access keys alone).'
    );
  }
  if (/Daily.*limit|User-rate limit|421-4\.7\.0|421 4\.7\.0|Throttl/i.test(raw)) {
    return 'Provider rate/limit hit. Lower SMTP_MAX_CONNECTIONS or raise SMTP_SEND_DELAY_MS.';
  }
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ESOCKET/i.test(raw)) {
    return `Cannot reach SMTP host (${raw}). Check SMTP_HOST / SMTP_PORT.`;
  }
  if (/550|553|Sender.*not|not allowed|does not match|MessageRejected/i.test(raw)) {
    return (
      'Provider rejected From/envelope. Verify MAIL_FROM domain in SES or match Gmail account. ' +
      raw.slice(0, 200)
    );
  }
  return raw.slice(0, 500);
}

/** {{name}} {{company}} {{title}} {{email}} */
export function personalize(
  template: string,
  vars: Record<string, string | undefined | null>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return vars[key] ?? '';
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeSubject(subject: string): string {
  let s = subject.trim();
  if (s === s.toUpperCase() && s.length > 8) {
    s = s.charAt(0) + s.slice(1).toLowerCase();
  }
  s = s.replace(/!{2,}/g, '!');
  return s.slice(0, 150);
}

export async function verifyMailConnection(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    if (!isMailConfigured()) {
      return { ok: false, error: 'SMTP_USER / SMTP_PASS not set' };
    }
    resetTransporter();
    await getTransporter().verify();
    return { ok: true };
  } catch (e) {
    resetTransporter();
    return { ok: false, error: formatMailError(e) };
  }
}

export async function sendMail({
  to,
  subject,
  text,
  html,
  fromName,
  attachments,
  unsubscribeUrl,
}: {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  fromName?: string;
  attachments?: EmailAttachment[];
  unsubscribeUrl?: string;
}) {
  const cfg = getMailConfig();
  const t = getTransporter();

  const recipients = Array.isArray(to)
    ? to
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
        .join(', ')
    : to.trim();

  const name = cleanDisplayName(fromName || cfg.fromName, cfg.fromName);
  const from =
    name && (cfg.fromEmail || cfg.user)
      ? { name, address: cfg.fromEmail || cfg.user }
      : cfg.fromEmail || cfg.user;

  const plain =
    (text && text.trim()) ||
    (html ? stripHtml(html) : '') ||
    '.';

  const rich = html || undefined;
  const safeSubject = sanitizeSubject(subject || 'Hello');

  const nodemailerAttachments =
    attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.content, 'base64'),
      contentType: a.contentType,
    })) || [];

  const totalBytes = nodemailerAttachments.reduce(
    (n, a) => n + a.content.length,
    0
  );
  if (totalBytes > 8 * 1024 * 1024) {
    throw new Error('Attachments too large (max ~8MB total)');
  }

  const unsub =
    unsubscribeUrl || process.env.SMTP_UNSUBSCRIBE_URL || undefined;

  const headers: Record<string, string> = {
    'X-Entity-Ref-ID': randHex(12),
    'X-Mailer': 'AWS-BLASTER/2',
  };
  if (unsub) {
    headers['List-Unsubscribe'] = `<${unsub}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  let envelope: { from: string; to: string } | undefined;
  if (cfg.envelopeFrom) {
    envelope = { from: cfg.envelopeFrom, to: recipients };
  }

  try {
    const info = await t.sendMail({
      from,
      envelope,
      to: recipients,
      replyTo: cfg.replyTo || cfg.fromEmail,
      subject: safeSubject,
      text: plain,
      html: rich,
      attachments: nodemailerAttachments,
      messageId: `<${randHex(16)}.${Date.now()}@${cfg.domain || 'mail.local'}>`,
      date: new Date(),
      encoding: 'utf-8',
      headers,
      priority: 'normal',
    });
    return info;
  } catch (e: any) {
    if (/EAUTH|Invalid login|535/i.test(String(e?.message || e?.code || ''))) {
      resetTransporter();
    }
    throw new Error(formatMailError(e));
  }
}

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Pause between recipients. Default ~150ms (LeadBot Pro style). */
export function sendDelayMs(): number {
  const raw = process.env.SMTP_SEND_DELAY_MS;
  const base =
    raw === undefined || raw === '' ? 150 : parseInt(raw, 10);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const jitter = Math.floor(Math.random() * Math.min(200, base));
  return base + jitter;
}
