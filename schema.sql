-- AWS BLASTER full schema — run on Neon Postgres (SQL Editor)
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  open_count INT NOT NULL DEFAULT 0,
  clicked_at TIMESTAMPTZ,
  click_count INT NOT NULL DEFAULT 0,
  last_event TEXT
);

ALTER TABLE emails ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS open_count INT NOT NULL DEFAULT 0;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS click_count INT NOT NULL DEFAULT 0;
ALTER TABLE emails ADD COLUMN IF NOT EXISTS last_event TEXT;

CREATE INDEX IF NOT EXISTS idx_emails_created ON emails (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails (status);
CREATE INDEX IF NOT EXISTS idx_emails_recipient ON emails (recipient);
CREATE INDEX IF NOT EXISTS idx_emails_type ON emails (message_type);
CREATE INDEX IF NOT EXISTS idx_emails_campaign ON emails (campaign_id);

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

-- LeadBot Pro: CRM leads from SEC / manual / import
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
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads (company);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads (source);
CREATE INDEX IF NOT EXISTS idx_leads_cik ON leads (cik);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads (email);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  cik TEXT UNIQUE,
  name TEXT NOT NULL,
  ticker TEXT,
  industry TEXT,
  website TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_name ON companies (name);
CREATE INDEX IF NOT EXISTS idx_companies_ticker ON companies (ticker);

-- Hard bounce / complaint suppression (never mail again)
CREATE TABLE IF NOT EXISTS suppressions (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL DEFAULT 'bounce',
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppressions_email ON suppressions (email);
