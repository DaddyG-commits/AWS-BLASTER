import { NextRequest, NextResponse } from 'next/server';
import {
  formatMailError,
  getMailConfig,
  isMailConfigured,
  sendMail,
} from '../../../lib/mail';
import { logEmail } from '../../../lib/store';

function generateOtp(length: number) {
  const n = Math.max(4, Math.min(8, length || 6));
  let code = '';
  for (let i = 0; i < n; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

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
    const fromName = (body.fromName || '').trim();
    const length = Number(body.length) || 6;
    const customMessage = (body.message || '').trim();

    if (!recipients.length) {
      return NextResponse.json(
        { error: 'Valid recipient email (to) is required' },
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

    const otp = generateOtp(length);
    const subject = body.subject?.trim() || 'Your verification code';

    const text =
      customMessage
        .replace(/\{\{otp\}\}/gi, otp)
        .replace(/\{\{code\}\}/gi, otp) ||
      `Your verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this, ignore this email.`;

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f6f8fa;padding:24px">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 12px;color:#111">Verification code</h2>
    <p style="color:#444;line-height:1.5">Use this one-time code to continue:</p>
    <p style="font-size:32px;letter-spacing:6px;font-weight:700;text-align:center;margin:24px 0;color:#0f172a">${otp}</p>
    <p style="color:#666;font-size:14px">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
  </div>
</body></html>`;

    const cfg = getMailConfig();
    const sender = cfg.fromEmail || cfg.user;
    const results: {
      recipient: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }[] = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      try {
        const info = await sendMail({
          to: recipient,
          subject,
          text,
          html,
          fromName: fromName || undefined,
        });
        const messageId = info.messageId || `otp-${Date.now()}`;
        try {
          await logEmail({
            sender,
            recipient,
            subject,
            text,
            html,
            messageType: 'otp',
            status: 'sent',
            messageId,
          });
        } catch (e) {
          console.error(e);
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
            messageType: 'otp',
            status: 'failed',
            error: errMsg,
          });
        } catch (e) {
          console.error(e);
        }
        results.push({ recipient, success: false, error: errMsg });
      }
    }

    const sent = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: sent > 0,
      otp,
      total: results.length,
      sent,
      failed: results.length - sent,
      results,
      message: `OTP sent to ${sent} of ${results.length}`,
    });
  } catch (error: unknown) {
    console.error('OTP send error:', error);
    return NextResponse.json(
      { success: false, error: formatMailError(error) },
      { status: 500 }
    );
  }
}
