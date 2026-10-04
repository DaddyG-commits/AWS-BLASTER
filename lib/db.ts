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
