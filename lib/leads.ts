import { getSql, hasDatabase } from './db';
import { randomUUID } from 'crypto';

export type LeadRow = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  industry: string | null;
  source: string;
  score: number;
  tags: string | null;
  notes: string | null;
  status: string;
  cik: string | null;
  filing_type: string | null;
  created_at: string;
  updated_at: string;
};

export async function ensureLeadsTable() {
  if (!hasDatabase()) return { ok: false, error: 'No DATABASE_URL' };
  const sql = getSql();
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        title TEXT,
        company TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        industry TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        score INT NOT NULL DEFAULT 50,
        tags TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'NEW',
        cik TEXT,
        filing_type TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email)`;
    await sql`
      CREATE TABLE IF NOT EXISTS suppressions (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        reason TEXT NOT NULL DEFAULT 'bounce',
        source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function upsertLead(data: {
  name: string;
  title?: string;
  company?: string;
  email?: string;
  source?: string;
  score?: number;
  tags?: string;
  status?: string;
  cik?: string;
  filing_type?: string;
  notes?: string;
}): Promise<LeadRow | null> {
  if (!hasDatabase()) return null;
  await ensureLeadsTable();
  const sql = getSql();
  const email = data.email?.trim().toLowerCase() || null;
  const id = randomUUID();

  if (email) {
    try {
      const rows = await sql`
        INSERT INTO leads (
          id, name, title, company, email, source, score, tags, status, cik, filing_type, notes
        ) VALUES (
          ${id},
          ${data.name},
          ${data.title || null},
          ${data.company || null},
          ${email},
          ${data.source || 'manual'},
          ${data.score ?? 50},
          ${data.tags || null},
          ${data.status || 'NEW'},
          ${data.cik || null},
          ${data.filing_type || null},
          ${data.notes || null}
        )
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          title = COALESCE(EXCLUDED.title, leads.title),
          company = COALESCE(EXCLUDED.company, leads.company),
          score = GREATEST(leads.score, EXCLUDED.score),
          source = EXCLUDED.source,
          updated_at = NOW()
        RETURNING *
      `;
      return (rows as LeadRow[])[0] || null;
    } catch (e) {
      console.error('upsertLead', e);
      return null;
    }
  }

  try {
    const rows = await sql`
      INSERT INTO leads (
        id, name, title, company, email, source, score, tags, status, cik, filing_type, notes
      ) VALUES (
        ${id},
        ${data.name},
        ${data.title || null},
        ${data.company || null},
        ${null},
        ${data.source || 'manual'},
        ${data.score ?? 50},
        ${data.tags || null},
        ${data.status || 'NEW'},
        ${data.cik || null},
        ${data.filing_type || null},
        ${data.notes || null}
      )
      RETURNING *
    `;
    return (rows as LeadRow[])[0] || null;
  } catch (e) {
    console.error('upsertLead no-email', e);
    return null;
  }
}

export async function listLeads(opts?: {
  status?: string;
  q?: string;
  limit?: number;
}): Promise<LeadRow[]> {
  if (!hasDatabase()) return [];
  await ensureLeadsTable();
  const sql = getSql();
  const limit = Math.min(Math.max(opts?.limit || 200, 1), 2000);
  const status = opts?.status || '';
  const q = (opts?.q || '').trim();

  if (status && q) {
    const pattern = `%${q}%`;
    return (await sql`
      SELECT * FROM leads
      WHERE status = ${status}
        AND (name ILIKE ${pattern} OR email ILIKE ${pattern} OR company ILIKE ${pattern})
      ORDER BY created_at DESC LIMIT ${limit}
    `) as LeadRow[];
  }
  if (status) {
    return (await sql`
      SELECT * FROM leads WHERE status = ${status}
      ORDER BY created_at DESC LIMIT ${limit}
    `) as LeadRow[];
  }
  if (q) {
    const pattern = `%${q}%`;
    return (await sql`
      SELECT * FROM leads
      WHERE name ILIKE ${pattern} OR email ILIKE ${pattern} OR company ILIKE ${pattern}
      ORDER BY created_at DESC LIMIT ${limit}
    `) as LeadRow[];
  }
  return (await sql`
    SELECT * FROM leads ORDER BY created_at DESC LIMIT ${limit}
  `) as LeadRow[];
}

export async function updateLeadStatus(email: string, status: string) {
  if (!hasDatabase() || !email) return;
  try {
    const sql = getSql();
    await sql`
      UPDATE leads SET status = ${status}, updated_at = NOW()
      WHERE lower(email) = ${email.toLowerCase()}
    `;
  } catch (e) {
    console.warn('updateLeadStatus', e);
  }
}

export async function isSuppressed(email: string): Promise<boolean> {
  if (!hasDatabase() || !email) return false;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id FROM suppressions WHERE lower(email) = ${email.toLowerCase()} LIMIT 1
    `;
    return (rows as any[]).length > 0;
  } catch {
    return false;
  }
}

export async function addSuppression(
  email: string,
  reason = 'bounce',
  source?: string
) {
  if (!hasDatabase() || !email.includes('@')) return;
  await ensureLeadsTable();
  const sql = getSql();
  const id = randomUUID();
  try {
    await sql`
      INSERT INTO suppressions (id, email, reason, source)
      VALUES (${id}, ${email.toLowerCase()}, ${reason}, ${source || null})
      ON CONFLICT (email) DO NOTHING
    `;
  } catch (e) {
    console.warn('addSuppression', e);
  }
}

export async function leadStats() {
  if (!hasDatabase()) {
    return { total: 0, byStatus: {} as Record<string, number> };
  }
  await ensureLeadsTable();
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT status, COUNT(*)::int AS c FROM leads GROUP BY status
    `) as { status: string; c: number }[];
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byStatus[r.status] = Number(r.c);
      total += Number(r.c);
    }
    return { total, byStatus };
  } catch {
    return { total: 0, byStatus: {} };
  }
}
