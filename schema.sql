-- Run on Neon Postgres (SQL Editor)

CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL DEFAULT '',
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  text_body TEXT,
  html_body TEXT,
  message_type TEXT NOT NULL DEFAULT 'email',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  message_id TEXT,
  campaign_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_created ON emails (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails (status);
CREATE INDEX IF NOT EXISTS idx_emails_recipient ON emails (recipient);
CREATE INDEX IF NOT EXISTS idx_emails_type ON emails (message_type);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  total INT NOT NULL DEFAULT 0,
  sent INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  last_emailed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  send_count INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers (email);
CREATE INDEX IF NOT EXISTS idx_customers_last ON customers (last_emailed_at DESC);
