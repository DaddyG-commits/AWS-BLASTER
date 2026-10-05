# AWS BLASTER (CryptoByt)

Email ops console: send → track → leads from sent inbox → campaigns (background queue) → analytics.

Works with **Gmail SMTP** or **Amazon SES SMTP**.

## Features

| Area | Capability |
|------|------------|
| **Send** | HTML/text, multi-recipient, `{{name}}` `{{email}}` personalization |
| **Campaigns** | Manual list or from Leads (sent inbox), background queue for 1k+, dry-run |
| **Leads** | Unique contacts built from successful sends |
| **Verify** | Syntax + MX + disposable/role; optional ZeroBounce |
| **Tracking** | Open pixel + click rewrite |
| **Inbox / Customers** | Full history, filters |
| **Analytics** | Open rate, daily volume, top recipients |
| **OTP** | Multi-recipient codes |
| **SMTP** | Pool, SES/Gmail-aware limits, List-Unsubscribe |

## Setup

### SMTP

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
MAIL_FROM=you@gmail.com
MAIL_FROM_NAME=CryptoByt
```

**SES:** set `SMTP_HOST=email-smtp.us-east-1.amazonaws.com` and SES SMTP credentials.

### Database + tracking

```env
DATABASE_URL=...
APP_URL=https://your-app.vercel.app
```

Run `schema.sql` on Neon, then redeploy.

## Queue (1k+ sends)

1. Campaigns → enable **Background queue**
2. **Queue & process** — batches run until done (no single-request timeout)
3. Resume from “Recent queued campaigns” if interrupted

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/send` | Immediate send |
| POST | `/api/campaigns` | Enqueue large blast |
| POST | `/api/campaigns/process` | Process batch |
| GET | `/api/customers` | Leads from sent inbox |
| GET | `/api/analytics` | Stats |
| POST | `/api/verify` | Verify emails |
| GET | `/api/emails` | Inbox |
| GET | `/api/track/open?id=` | Open pixel |
