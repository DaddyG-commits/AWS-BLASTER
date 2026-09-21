# AWS BLASTER

Fully functional email service powered by **Brevo**, designed for deployment on **Vercel**.

## Features

- Send emails via Brevo Transactional API
- Full **HTML email** support
- Multiple recipients (comma-separated)
- Beautiful web UI for testing
- REST API endpoint (`POST /api/send`)
- Fully serverless – works perfectly on Vercel

## Setup

### 1. Create a Brevo Account

1. Sign up at [https://www.brevo.com](https://www.brevo.com)
2. Verify your email and complete account approval
3. Go to **SMTP & API → API Keys** and create a **v3 API key**
4. Verify a sender email address (or domain) in Brevo

### 2. Configure Environment Variables

Copy the example file:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
BREVO_API_KEY=your-brevo-api-v3-key
BREVO_SENDER_EMAIL=your-verified-email@yourdomain.com
BREVO_SENDER_NAME=AWS BLASTER
```

### 3. Install & Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Deploy to Vercel

1. Import the repo into Vercel
2. Add the same environment variables
3. Deploy

## API Usage

### Send Email

```http
POST /api/send
Content-Type: application/json

{
  "to": "recipient@example.com",
  "subject": "Hello from AWS BLASTER",
  "html": "<h1>Hello!</h1><p>This is an <strong>HTML</strong> email.</p>",
  "text": "Optional plain text version"
}
```

You can also send to multiple people:

```json
{
  "to": ["user1@example.com", "user2@example.com"],
  "subject": "Hello everyone",
  "html": "<p>Hi there!</p>"
}
```

**Response (success):**
```json
{
  "success": true,
  "messageId": "<message-id>",
  "message": "Email sent successfully via Brevo"
}
```

### Health Check

```http
GET /api/send
```

## Free Tier Limits (Brevo)

- **300 emails per day**
- Permanent free plan (no credit card required)
- Full transactional + marketing features

## License

MIT
