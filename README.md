# AWS BLASTER

Email service powered by **Gmail SMTP** (Google App Password), deployed on **Vercel**.

## Features

- Send HTML / plain email via Gmail
- Inbox status page (quota notes + Gmail Sent guidance)
- Email extractor & validator
- OTP sender
- Dropdown navigation

## Setup

### 1. Google App Password

1. Use account: `lawofficeclientdesk@gmail.com` (or your own)
2. Enable **2-Step Verification**
3. Create an App Password: https://myaccount.google.com/apppasswords
4. Copy the 16-character password

### 2. Vercel environment variables

```env
SMTP_USER=lawofficeclientdesk@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
MAIL_FROM=lawofficeclientdesk@gmail.com
MAIL_FROM_NAME=AWS BLASTER
```

Spaces in the App Password are fine (stripped automatically).

Redeploy after saving env vars.

### 3. Local

```bash
cp .env.example .env.local
npm install
npm run dev
```

## API

- `POST /api/send` — send email
- `POST /api/otp` — send OTP
- `GET /api/inbox` — provider status
- `GET /api/send` — health check

## Notes

- Gmail free accounts are typically limited to ~500 sends/day.
- Sent history is in **Gmail → Sent**, not in Brevo.
