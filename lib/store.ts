import { getSql, hasDatabase } from './db';
import { randomUUID } from 'crypto';

export type EmailRow = {
  id: string;
  sender: string;
  recipient: string;
  subject: string;
  text_body: string | null;
  html_body: string | null;
  message_type: string;
  status: string;
  error_message: string | null;
  message_id: string | null;
  campaign_id: string | null;
  created_at: string;
};

export type EmailStats = {
  total: number;
  sent: number;
  failed: number;
  otp: number;
  email: number;
  today: number;
  todaySent: number;
  todayFailed: number;
};

export async function logEmail(opts: {
  sender: string;
  recipient: string;
  subject: string;
  text?: string;
  html?: string;
  messageType?: string;
  status: 'sent' | 'failed';
  error?: string;
  messageId?: string;
  campaignId?: string;
}) {
  if (!hasDatabase()) return null;
  const sql = getSql();
  const id = randomUUID();
  await sql`
    INSERT INTO emails (
      id, sender, recipient, subject, text_body, html_body,
      message_type, status, error_message, message_id, campaign_id
    ) VALUES (
      ${id},
      ${opts.sender},
      ${opts.recipient},
      ${opts.subject},
      ${opts.text || null},
      ${opts.html || null},
      ${opts.messageType || 'email'},
      ${opts.status},
      ${opts.error || null},
      ${opts.messageId || null},
      ${opts.campaignId || null}
    )
  `;
  return id;
}

export async function listEmails(opts?: {
  status?: string;
  type?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<EmailRow[]> {
  if (!hasDatabase()) return [];
  const sql = getSql();
  const limit = Math.min(opts?.limit || 100, 500);
  const offset = opts?.offset || 0;
  const status = opts?.status || '';
  const type = opts?.type || '';
  const q = (opts?.q || '').trim();

  if (status && type && q) {
    const pattern = `%${q}%`;
    return (await sql`
      SELECT * FROM emails
      WHERE status = ${status} AND message_type = ${type}
        AND (recipient ILIKE ${pattern} OR subject ILIKE ${pattern})
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `) as EmailRow[];
  }
  if (status && q) {
    const pattern = `%${q}%`;
    return (await sql`
      SELECT * FROM emails
      WHERE status = ${status}
        AND (recipient ILIKE ${pattern} OR subject ILIKE ${pattern})
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `) as EmailRow[];
  }
  if (type && q) {
    const pattern = `%${q}%`;
    return (await sql`
      SELECT * FROM emails
      WHERE message_type = ${type}
        AND (recipient ILIKE ${pattern} OR subject ILIKE ${pattern})
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `) as EmailRow[];
  }
  if (status) {
    return (await sql`
      SELECT * FROM emails WHERE status = ${status}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `) as EmailRow[];
  }
  if (type) {
    return (await sql`
      SELECT * FROM emails WHERE message_type = ${type}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `) as EmailRow[];
  }
  if (q) {
    const pattern = `%${q}%`;
    return (await sql`
      SELECT * FROM emails
      WHERE recipient ILIKE ${pattern} OR subject ILIKE ${pattern}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `) as EmailRow[];
  }
  return (await sql`
    SELECT * FROM emails ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
  `) as EmailRow[];
}

export async function getStats(): Promise<EmailStats> {
  const empty: EmailStats = {
    total: 0,
    sent: 0,
    failed: 0,
    otp: 0,
    email: 0,
    today: 0,
    todaySent: 0,
    todayFailed: 0,
  };
  if (!hasDatabase()) return empty;
  const sql = getSql();
  const rows = (await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'sent')::int AS sent,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE message_type = 'otp')::int AS otp,
      COUNT(*) FILTER (WHERE message_type = 'email')::int AS email,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('day', NOW()))::int AS today,
      COUNT(*) FILTER (WHERE status = 'sent' AND created_at >= date_trunc('day', NOW()))::int AS "todaySent",
      COUNT(*) FILTER (WHERE status = 'failed' AND created_at >= date_trunc('day', NOW()))::int AS "todayFailed"
    FROM emails
  `) as any[];
  const r = rows[0] || {};
  return {
    total: r.total || 0,
    sent: r.sent || 0,
    failed: r.failed || 0,
    otp: r.otp || 0,
    email: r.email || 0,
    today: r.today || 0,
    todaySent: r.todaySent || 0,
    todayFailed: r.todayFailed || 0,
  };
}
