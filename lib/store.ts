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

export type CustomerRow = {
  id: string;
  email: string;
  name: string;
  note: string;
  last_emailed_at: string;
  send_count: number;
  created_at: string;
};

function n(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const x = parseInt(v, 10);
    return Number.isNaN(x) ? 0 : x;
  }
  if (v && typeof v === 'object' && 'valueOf' in v) {
    const x = Number((v as any).valueOf());
    return Number.isNaN(x) ? 0 : x;
  }
  return 0;
}

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

  // Auto-add successful recipients as customers for future resend
  if (opts.status === 'sent') {
    try {
      await upsertCustomer(opts.recipient, {
        note: opts.subject ? `Last: ${opts.subject.slice(0, 80)}` : '',
      });
    } catch (e) {
      console.error('upsertCustomer failed', e);
    }
  }

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

  try {
    const sql = getSql();

    // Simple separate counts (more reliable than FILTER with some drivers)
    const totalR = await sql`SELECT COUNT(*) AS c FROM emails`;
    const sentR = await sql`SELECT COUNT(*) AS c FROM emails WHERE lower(status) = 'sent'`;
    const failedR = await sql`SELECT COUNT(*) AS c FROM emails WHERE lower(status) = 'failed'`;
    const otpR = await sql`SELECT COUNT(*) AS c FROM emails WHERE lower(message_type) = 'otp'`;
    const emailR = await sql`SELECT COUNT(*) AS c FROM emails WHERE lower(message_type) = 'email'`;
    const todayR = await sql`SELECT COUNT(*) AS c FROM emails WHERE created_at >= date_trunc('day', NOW())`;
    const todaySentR = await sql`SELECT COUNT(*) AS c FROM emails WHERE lower(status) = 'sent' AND created_at >= date_trunc('day', NOW())`;
    const todayFailedR = await sql`SELECT COUNT(*) AS c FROM emails WHERE lower(status) = 'failed' AND created_at >= date_trunc('day', NOW())`;

    return {
      total: n((totalR as any)[0]?.c),
      sent: n((sentR as any)[0]?.c),
      failed: n((failedR as any)[0]?.c),
      otp: n((otpR as any)[0]?.c),
      email: n((emailR as any)[0]?.c),
      today: n((todayR as any)[0]?.c),
      todaySent: n((todaySentR as any)[0]?.c),
      todayFailed: n((todayFailedR as any)[0]?.c),
    };
  } catch (e) {
    console.error('getStats error', e);
    return empty;
  }
}

export async function upsertCustomer(
  email: string,
  opts?: { name?: string; note?: string }
) {
  if (!hasDatabase()) return null;
  const em = email.trim().toLowerCase();
  if (!em.includes('@')) return null;

  const sql = getSql();
  const existing = (await sql`
    SELECT id, send_count FROM customers WHERE email = ${em} LIMIT 1
  `) as { id: string; send_count: number }[];

  if (existing.length > 0) {
    const row = existing[0];
    const nextCount = n(row.send_count) + 1;
    await sql`
      UPDATE customers SET
        last_emailed_at = NOW(),
        send_count = ${nextCount},
        note = COALESCE(NULLIF(${opts?.note || ''}, ''), note),
        name = COALESCE(NULLIF(${opts?.name || ''}, ''), name)
      WHERE id = ${row.id}
    `;
    return row.id;
  }

  const id = randomUUID();
  await sql`
    INSERT INTO customers (id, email, name, note, last_emailed_at, send_count)
    VALUES (
      ${id},
      ${em},
      ${opts?.name || ''},
      ${opts?.note || ''},
      NOW(),
      1
    )
  `;
  return id;
}

export async function listCustomers(q?: string): Promise<CustomerRow[]> {
  if (!hasDatabase()) return [];
  const sql = getSql();
  const query = (q || '').trim();
  if (query) {
    const pattern = `%${query}%`;
    return (await sql`
      SELECT * FROM customers
      WHERE email ILIKE ${pattern} OR name ILIKE ${pattern} OR note ILIKE ${pattern}
      ORDER BY last_emailed_at DESC
      LIMIT 1000
    `) as CustomerRow[];
  }
  return (await sql`
    SELECT * FROM customers ORDER BY last_emailed_at DESC LIMIT 1000
  `) as CustomerRow[];
}

/** Backfill customers from existing sent emails */
export async function syncCustomersFromEmails(): Promise<number> {
  if (!hasDatabase()) return 0;
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT ON (lower(recipient)) recipient, subject, created_at
    FROM emails
    WHERE lower(status) = 'sent'
    ORDER BY lower(recipient), created_at DESC
  `) as { recipient: string; subject: string; created_at: string }[];

  let added = 0;
  for (const r of rows) {
    try {
      const before = (await sql`SELECT id FROM customers WHERE email = ${r.recipient.toLowerCase()} LIMIT 1`) as any[];
      await upsertCustomer(r.recipient, {
        note: r.subject ? `Last: ${String(r.subject).slice(0, 80)}` : '',
      });
      if (!before.length) added++;
    } catch (e) {
      console.error(e);
    }
  }
  return added;
}
