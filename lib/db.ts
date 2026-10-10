import { neon } from '@neondatabase/serverless';

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add a Neon Postgres URL on Vercel, run schema.sql, then redeploy.'
    );
  }
  return neon(url);
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

let trackingColsReady = false;

/**
 * Ensures open/click tracking columns exist on emails.
 * Safe to call repeatedly — uses IF NOT EXISTS.
 */
export async function ensureEmailTrackingColumns(): Promise<boolean> {
  if (!hasDatabase()) return false;
  if (trackingColsReady) return true;
  try {
    const sql = getSql();
    await sql`ALTER TABLE emails ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ`;
    await sql`ALTER TABLE emails ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ`;
    await sql`ALTER TABLE emails ADD COLUMN IF NOT EXISTS open_count INT NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE emails ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ`;
    await sql`ALTER TABLE emails ADD COLUMN IF NOT EXISTS click_count INT NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE emails ADD COLUMN IF NOT EXISTS last_event TEXT`;
    trackingColsReady = true;
    return true;
  } catch (e) {
    console.error('ensureEmailTrackingColumns', e);
    return false;
  }
}
