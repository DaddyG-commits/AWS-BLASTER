import { NextRequest, NextResponse } from 'next/server';
import {
  formatMailError,
  isMailConfigured,
  sendMail,
} from '../../../lib/mail';

function generateOtp(length: number) {
  const n = Math.max(4, Math.min(8, length || 6));
  let code = '';
  for (let i = 0; i < n; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const to = (body.to || '').trim();
    const fromName = (body.fromName || '').trim();
    const length = Number(body.length) || 6;
    const customMessage = (body.message || '').trim();

    if (!to || !to.includes('@')) {
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

    const info = await sendMail({
      to,
      subject,
      text,
      html,
      fromName: fromName || undefined,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId || 'sent',
      otp,
      message: 'OTP email sent successfully via Gmail',
    });
  } catch (error: unknown) {
    console.error('OTP send error:', error);
    return NextResponse.json(
      { success: false, error: formatMailError(error) },
      { status: 500 }
    );
  }
}
