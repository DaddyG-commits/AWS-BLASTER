# AWS BLASTER (CryptoByt)

LeadBot Pro–grade email ops console: SEC extract → verify → CRM leads → personalized campaigns → open/click tracking → inbox.

Works with **Gmail SMTP** or **Amazon SES SMTP** (or any SMTP provider).

## Features

| Area | Capability |
|------|------------|
| **Send** | HTML/text, multi-recipient, personalization `{{name}}` `{{company}}` `{{title}}` `{{email}}` |
| **Campaigns** | Manual list or **from Leads**, dry-run, suppression skip, rate delay |
| **Leads CRM** | SEC EDGAR executives, import, status pipeline (NEW → VERIFIED → CONTACTED) |
| **SEC Extract** | Company search + 10-K / DEF 14A / 10-Q executive parse + email patterns |
| **Verify** | Syntax + MX + disposable/role; optional ZeroBounce |
| **Tracking** | Open pixel + click rewrite |
| **Inbox / Customers** | Full history, filters, unique contacts |
| **OTP** | Multi-recipient codes |
| **SMTP** | Connection pool, SES/Gmail-aware limits, List-Unsubscribe, envelope From |

## Setup

### 1. SMTP

**Gmail**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
MAIL_FROM=you@gmail.com
MAIL_FROM_NAME=CryptoByt
```

**Amazon SES**
```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=AKIA...
SMTP_PASS=...
MAIL_FROM=noreply@your-verified-domain.com
MAIL_FROM_NAME=CryptoByt
SMTP_MAX_CONNECTIONS=5
SMTP_SEND_DELAY_MS=50
```

### 2. Neon + schema

1. Create Neon project → set `DATABASE_URL`
2. Run entire `schema.sql` in Neon SQL Editor
3. Redeploy

### 3. Tracking + SEC

```env
APP_URL=https://your-app.vercel.app
SEC_USER_AGENT=CryptoByt (you@yourdomain.com)
```

Optional: `ZEROBOUNCE_API_KEY`, `SMTP_UNSUBSCRIBE_URL`

### 4. Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

## API highlights

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/send` | `{ to }` or `{ mode:"leads", status:"NEW" }` + subject/html · `dryRun` · personalization |
| GET/POST | `/api/leads` | CRM list / upsert / setup |
| POST | `/api/sec/extract` | `{ cik }` → executives + email candidates |
| GET | `/api/sec/extract?q=` | Company search |
| POST | `/api/verify` | `{ email }` \| `{ emails[] }` \| `{ fromLeads:true }` |
| GET | `/api/emails` | Inbox |
| GET | `/api/stats` | Aggregates |
| GET | `/api/track/open?id=` | Open pixel |
| GET | `/api/track/click?id=&u=` | Click redirect |

## Flow (LeadBot parity)

1. **SEC Extract** → save leads  
2. **Verify** → mark VERIFIED / INVALID  
3. **Campaigns** → mode “From Leads” · personalize · track opens  
4. **Sent Inbox** + **Customers** → monitor  

## Notes

- Gmail free ≈ 500/day; SES is built for volume (verify domain + move out of sandbox).
- Suppression table blocks known bounces when populated.
- Duplicate same subject to same address within 30 minutes is skipped (pass `force:true` to override).
