# AWS BLASTER

Fully functional SMTP email service using **Zoho Mail**, designed for deployment on **Vercel**.

## Features

- Send emails via Zoho Mail SMTP using Nodemailer
- Beautiful web UI for testing
- REST API endpoint (`POST /api/send`)
- Fully serverless – works perfectly on Vercel
- Secure configuration via environment variables

## Zoho Mail SMTP Settings

| Setting       | Personal / Free          | Organization / Paid Custom Domain |
|---------------|--------------------------|-----------------------------------|
| **Host**      | `smtp.zoho.com`          | `smtppro.zoho.com`                |
| **Port**      | `587` (TLS) or `465` (SSL) | Same                              |
| **Username**  | Full email address       | Full email address or alias       |
| **Password**  | App-Specific Password    | App-Specific Password             |

> **Important:** If you have 2FA enabled (recommended), you **must** generate an **App-Specific Password** in your Zoho account security settings. Regular passwords will not work.

Regional hosts (if your account is not US):
- EU: `smtp.zoho.eu` / `smtppro.zoho.eu`
- India: `smtp.zoho.in` / `smtppro.zoho.in`
- Australia: `smtp.zoho.com.au` / `smtppro.zoho.com.au`

You can find the exact settings in Zoho Mail → Settings → Mail Accounts → Server Configuration Details.

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/DaddyG-commits/AWS-BLASTER.git
cd AWS-BLASTER
npm install
```

### 2. Configure environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-app-specific-password
SMTP_FROM=your-email@yourdomain.com
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Deploy to Vercel

1. Push this repo to GitHub (already done).
2. Go to [vercel.com](https://vercel.com) → New Project → Import `AWS-BLASTER`.
3. Add the same environment variables in the Vercel project settings.
4. Deploy.

Your service will be live at `https://your-project.vercel.app`.

## API Usage

### Send Email

```http
POST /api/send
Content-Type: application/json

{
  "to": "recipient@example.com",
  "subject": "Hello from AWS BLASTER",
  "text": "Plain text body",
  "html": "<p>Optional HTML body</p>"
}
```

**Response (success):**
```json
{
  "success": true,
  "messageId": "<message-id@zoho.com>",
  "response": "250 Message received"
}
```

### Health Check

```http
GET /api/send
```

## Security Notes

- Never commit your `.env` or real passwords.
- Use App-Specific Passwords.
- Restrict the API if needed (add authentication middleware for production).
- Vercel blocks outbound port 25; we use 587/465 which are allowed.

## License

MIT
