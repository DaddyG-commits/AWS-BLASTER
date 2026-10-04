# AWS BLASTER (CryptoByt mail)

Advanced email ops console — Gmail SMTP + Neon log — similar to LeadBot Pro.

## Features

- **Dashboard** — total / sent / failed / today counts + success rate
- **Send Email** — HTML or plain, multi-recipient, per-recipient results
- **Campaigns** — bulk blast with live sent/failed list
- **Sent Inbox** — full history, filter by status (sent/failed), type (email/otp), search
- **OTP Sender** — multi-recipient codes, logged in inbox
- **Email Extractor** · **Customers** · **Validator**
- Every delivery writes a DB row (`sent` or `failed` + error message)

## Setup

### 1. Gmail App Password

1. Enable **2-Step Verification**
2. Create App Password: https://myaccount.google.com/apppasswords
3. Set on Vercel:

```env
SMTP_USER=you@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
MAIL_FROM=you@gmail.com
MAIL_FROM_NAME=CryptoByt
```

### 2. Neon database (inbox + stats)

1. Create a free project at [console.neon.tech](https://console.neon.tech)
2. Copy the connection string → `DATABASE_URL` on Vercel
3. In Neon SQL Editor, run the contents of `schema.sql`
4. Redeploy

Without `DATABASE_URL`, sending still works; inbox/stats stay empty.

### 3. Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/send` | Send to one or many; returns `sent` / `failed` counts + `results[]` |
| POST | `/api/otp` | OTP to one or many; logs each |
| GET | `/api/emails?status=sent\|failed&type=email\|otp&q=` | Inbox list |
| GET | `/api/stats` | Aggregate counts |

## Notes

- Gmail free accounts are typically limited to ~500 sends/day.
- Failed rows store the SMTP error so you can debug in **Sent Inbox**.
