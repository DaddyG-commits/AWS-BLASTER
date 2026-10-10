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
  delivered_at?: string | null;
  opened_at?: string | null;
  open_count?: number | null;
  clicked_at?: string | null;
  click_count?: number | null;
  last_event?: string | null;
};

export type EmailStats = {
  total: number;
  sent: number;
  failed: number;
  delivered: number;
  opened: number;
  clicked: number;
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
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') {
    const x = parseInt(v, 10);
    return Number.isNaN(x) ? 0 : x;
  }
  if (v == null) return 0;
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

function st(s: unknown): string {
  return String(s || '').toLowerCase().trim();
}

export async function logEmail(opts: {
  id?: string;
  sender: string;
  recipient: string;
  subject: string;
  text?: string;
  html?: string;
  messageType?: string;
  status: 'sent' | 'failed' | 'delivered' | 'opened';
  error?: string;
  messageId?: string;
  campaignId?: string;
}) {
  if (!hasDatabase()) return null;
  const sql = getSql();
  const id = opts.id || randomUUID();
  const delivered =
    opts.status === 'sent' || opts.status === 'delivered' || opts.status === 'opened';
  const status = opts.status === 'sent' ? 'delivered' : opts.status;

  try {
    await sql`
      INSERT INTO emails (
        id, sender, recipient, subject, text_body, html_body,
        message_type, status, error_message, message_id, campaign_id,
        delivered_at, open_count, click_count, last_event
      ) VALUES (
        ${id},
        ${opts.sender},
        ${opts.recipient},
        ${opts.subject},
        ${opts.text || null},
        ${opts.html || null},
        ${opts.messageType || 'email'},
        ${status},
        ${opts.error || null},
        ${opts.messageId || null},
        ${opts.campaignId || null},
        ${delivered ? new Date().toISOString() : null},
        0,
        0,
        ${status}
      )
    `;
  } catch (e) {
    console.error('logEmail with tracking cols failed, fallback', e);
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
        ${status},
        ${opts.error || null},
        ${opts.messageId || null},
        ${opts.campaignId || null}
      )
    `;
  }

  if (opts.status === 'sent' || opts.status === 'delivered') {
    try {
      await upsertCustomer(opts.recipient, {
        note: opts.subject ? `Last: ${opts.subject.slice(0, 80)}` : '',
      });
    } catch (err) {
      console.error('upsertCustomer failed', err);
    }
  }

  return id;
}

export async function recordOpen(emailId: string) {
  if (!hasDatabase() || !emailId) return false;
  const sql = getSql();
  try {
    await sql`
      UPDATE emails SET
        open_count = COALESCE(open_count, 0) + 1,
        opened_at = COALESCE(opened_at, NOW()),
        status = CASE
          WHEN lower(status) = 'failed' THEN status
          ELSE 'opened'
        END,
        last_event = 'opened'
      WHERE id = ${emailId}
    `;
    return true;
  } catch (e) {
    try {
      await sql`
        UPDATE emails SET status = 'opened'
        WHERE id = ${emailId} AND lower(status) != 'failed'
      `;
      return true;
    } catch (e2) {
      console.error('recordOpen failed', e2);
      return false;
    }
  }
}

/** Record a link click separately so analytics can show who clicked. */
export async function recordClick(emailId: string) {
  if (!hasDatabase() || !emailId) return false;
  const sql = getSql();
  try {
    await sql`
      UPDATE emails SET
        open_count = COALESCE(open_count, 0) + 1,
        opened_at = COALESCE(opened_at, NOW()),
        click_count = COALESCE(click_count, 0) + 1,
        clicked_at = COALESCE(clicked_at, NOW()),
        status = CASE
          WHEN lower(status) = 'failed' THEN status
          ELSE 'opened'
        END,
        last_event = 'clicked'
      WHERE id = ${emailId}
    `;
    return true;
  } catch (e) {
    console.error('recordClick failed, falling back to open', e);
    try {
      await recordOpen(emailId);
    } catch {
      /* ignore */
    }
    return false;
  }
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
  const limit = Math.min(Math.max(opts?.limit || 200, 1), 2000);
  const offset = opts?.offset || 0;
  const status = opts?.status || '';
  const type = opts?.type || '';
  const q = (opts?.q || '').trim();

  if (status === 'clicked') {
    if (q) {
      const pattern = `%${q}%`;
      return (await sql`
        SELECT * FROM emails
        WHERE (lower(COALESCE(last_event,'')) = 'clicked' OR COALESCE(click_count, 0) > 0)
          AND (recipient ILIKE ${pattern} OR subject ILIKE ${pattern})
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `) as EmailRow[];
    }
    return (await sql`
      SELECT * FROM emails
      WHERE lower(COALESCE(last_event,'')) = 'clicked' OR COALESCE(click_count, 0) > 0
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `) as EmailRow[];
  }
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
    if (status === 'sent') {
      return (await sql`
        SELECT * FROM emails
        WHERE lower(status) IN ('sent', 'delivered', 'opened')
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `) as EmailRow[];
    }
    return (await sql`
      SELECT * FROM emails WHERE lower(status) = ${status.toLowerCase()}
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
    delivered: 0,
    opened: 0,
    clicked: 0,
    otp: 0,
    email: 0,
    today: 0,
    todaySent: 0,
    todayFailed: 0,
  };
  if (!hasDatabase()) return empty;

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN lower(trim(status)) IN ('sent','delivered','opened') THEN 1 ELSE 0 END), 0)::int AS sent,
        COALESCE(SUM(CASE WHEN lower(trim(status)) = 'failed' THEN 1 ELSE 0 END), 0)::int AS failed,
        COALESCE(SUM(CASE WHEN lower(trim(status)) IN ('delivered','opened') THEN 1 ELSE 0 END), 0)::int AS delivered,
        COALESCE(SUM(CASE WHEN lower(trim(status)) = 'opened' OR opened_at IS NOT NULL THEN 1 ELSE 0 END), 0)::int AS opened,
        COALESCE(SUM(CASE WHEN lower(COALESCE(last_event,'')) = 'clicked' OR COALESCE(click_count, 0) > 0 THEN 1 ELSE 0 END), 0)::int AS clicked,
        COALESCE(SUM(CASE WHEN lower(trim(message_type)) = 'otp' THEN 1 ELSE 0 END), 0)::int AS otp,
        COALESCE(SUM(CASE WHEN lower(trim(message_type)) = 'email' THEN 1 ELSE 0 END), 0)::int AS email,
        COALESCE(SUM(CASE WHEN created_at >= date_trunc('day', NOW()) THEN 1 ELSE 0 END), 0)::int AS today,
        COALESCE(SUM(CASE WHEN lower(trim(status)) IN ('sent','delivered','opened') AND created_at >= date_trunc('day', NOW()) THEN 1 ELSE 0 END), 0)::int AS today_sent,
        COALESCE(SUM(CASE WHEN lower(trim(status)) = 'failed' AND created_at >= date_trunc('day', NOW()) THEN 1 ELSE 0 END), 0)::int AS today_failed
      FROM emails
    `;

    const r = (rows as any[])[0] || {};
    return {
      total: n(r.total),
      sent: n(r.sent),
      failed: n(r.failed),
      delivered: n(r.delivered),
      opened: n(r.opened),
      clicked: n(r.clicked),
      otp: n(r.otp),
      email: n(r.email),
      today: n(r.today),
      todaySent: n(r.today_sent),
      todayFailed: n(r.today_failed),
    };
  } catch (e) {
    console.error('getStats error', e);
    try {
      const sql = getSql();
      const all = (await sql`SELECT status, message_type, created_at, last_event, click_count, opened_at FROM emails`) as {
        status: string;
        message_type: string;
        created_at: string;
        last_event?: string | null;
        click_count?: number | null;
        opened_at?: string | null;
      }[];
      const now = new Date();
      const isToday = (iso: string) => {
        try {
          return new Date(iso).toDateString() === now.toDateString();
        } catch {
          return false;
        }
      };
      return {
        total: all.length,
        sent: all.filter((e) => ['sent', 'delivered', 'opened'].includes(st(e.status))).length,
        failed: all.filter((e) => st(e.status) === 'failed').length,
        delivered: all.filter((e) => ['delivered', 'opened'].includes(st(e.status))).length,
        opened: all.filter(
          (e) => st(e.status) === 'opened' || !!e.opened_at
        ).length,
        clicked: all.filter(
          (e) => st(e.last_event) === 'clicked' || n(e.click_count) > 0
        ).length,
        otp: all.filter((e) => st(e.message_type) === 'otp').length,
        email: all.filter((e) => st(e.message_type) === 'email').length,
        today: all.filter((e) => isToday(e.created_at)).length,
        todaySent: all.filter(
          (e) =>
            ['sent', 'delivered', 'opened'].includes(st(e.status)) && isToday(e.created_at)
        ).length,
        todayFailed: all.filter(
          (e) => st(e.status) === 'failed' && isToday(e.created_at)
        ).length,
      };
    } catch (e2) {
      console.error('getStats fallback error', e2);
      return empty;
    }
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
      LIMIT 2000
    `) as CustomerRow[];
  }
  return (await sql`
    SELECT * FROM customers ORDER BY last_emailed_at DESC LIMIT 2000
  `) as CustomerRow[];
}

export async function syncCustomersFromEmails(): Promise<number> {
  if (!hasDatabase()) return 0;
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT ON (lower(recipient)) recipient, subject, created_at
    FROM emails
    WHERE lower(trim(status)) IN ('sent', 'delivered', 'opened')
    ORDER BY lower(recipient), created_at DESC
  `) as { recipient: string; subject: string; created_at: string }[];

  let added = 0;
  for (const r of rows) {
    try {
      const before = (await sql`
        SELECT id FROM customers WHERE email = ${r.recipient.toLowerCase()} LIMIT 1
      `) as any[];
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
