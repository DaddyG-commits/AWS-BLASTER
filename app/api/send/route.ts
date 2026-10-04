import { NextRequest, NextResponse } from 'next/server';
import {
  formatMailError,
  getMailConfig,
  isMailConfigured,
  sendMail,
} from '../../../lib/mail';
import { logEmail } from '../../../lib/store';

function parseRecipients(to: unknown): string[] {
  let list: string[] = [];
  if (Array.isArray(to)) {
    list = to.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  } else if (typeof to === 'string') {
    list = to
      .split(/[,;\s\n]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@'));
  }
  return Array.from(new Set(list));
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const recipients = parseRecipients(body.to);
    const subject = String(body.subject || '').trim();
    const text = body.text ? String(body.text) : undefined;
    const html = body.html ? String(body.html) : undefined;
    const fromName = body.fromName ? String(body.fromName).trim() : undefined;
    const campaignId = body.campaignId ? String(body.campaignId) : undefined;

    if (!recipients.length || !subject || (!text && !html)) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: to, subject, and text or html are required',
        },
        { status: 400 }
      );
    }

    if (!isMailConfigured()) {
      return NextResponse.json(
        {
          error:
            'Gmail not configured. Set SMTP_USER and SMTP_PASS (Google App Password) on Vercel.',
        },
        { status: 500 }
      );
    }

    const cfg = getMailConfig();
    const sender = cfg.fromEmail || cfg.user;
    const results: {
      recipient: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }[] = [];

    for (const recipient of recipients) {
      try {
        const info = await sendMail({
          to: recipient,
          subject,
          text,
          html,
          fromName,
        });
        const messageId = info.messageId || `sent-${Date.now()}`;
        try {
          await logEmail({
            sender,
            recipient,
            subject,
            text,
            html,
            messageType: 'email',
            status: 'sent',
            messageId,
            campaignId,
          });
        } catch (dbErr) {
          console.error('logEmail sent failed', dbErr);
        }
        results.push({ recipient, success: true, messageId });
      } catch (error) {
        const errMsg = formatMailError(error);
        try {
          await logEmail({
            sender,
            recipient,
            subject,
            text,
            html,
            messageType: 'email',
            status: 'failed',
            error: errMsg,
            campaignId,
          });
        } catch (dbErr) {
          console.error('logEmail failed', dbErr);
        }
        results.push({ recipient, success: false, error: errMsg });
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.length - sent;

    return NextResponse.json({
      success: sent > 0,
      total: results.length,
      sent,
      failed,
      results,
      message: `Sent ${sent} of ${results.length}`,
    });
  } catch (error: unknown) {
    console.error('Gmail send error:', error);
    return NextResponse.json(
      { success: false, error: formatMailError(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'AWS BLASTER - Gmail SMTP',
    endpoints: {
      send: 'POST /api/send',
      otp: 'POST /api/otp',
      emails: 'GET /api/emails',
      stats: 'GET /api/stats',
    },
    requiredEnv: ['SMTP_USER', 'SMTP_PASS'],
    optionalEnv: ['MAIL_FROM', 'MAIL_FROM_NAME', 'DATABASE_URL'],
    configured: isMailConfigured(),
  });
}
