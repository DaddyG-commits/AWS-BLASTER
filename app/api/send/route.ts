import { NextRequest, NextResponse } from 'next/server';
import {
  formatMailError,
  isMailConfigured,
  sendMail,
} from '../../../lib/mail';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, text, html, fromName } = body;

    if (!to || !subject || (!text && !html)) {
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

    const info = await sendMail({
      to,
      subject,
      text,
      html,
      fromName,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId || 'sent',
      message: 'Email sent successfully via Gmail',
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
    endpoints: { send: 'POST /api/send' },
    requiredEnv: ['SMTP_USER', 'SMTP_PASS'],
    optionalEnv: ['MAIL_FROM', 'MAIL_FROM_NAME'],
    configured: isMailConfigured(),
  });
}
