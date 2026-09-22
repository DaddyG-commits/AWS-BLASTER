import { NextRequest, NextResponse } from 'next/server';
import * as brevo from '@getbrevo/brevo';

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

    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName =
      fromName || process.env.BREVO_SENDER_NAME || 'AWS BLASTER';

    if (!apiKey || !senderEmail) {
      return NextResponse.json(
        {
          error:
            'Brevo configuration missing. Set BREVO_API_KEY and BREVO_SENDER_EMAIL.',
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

    const html =
      body.html?.trim() ||
      `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f6f8fa;padding:24px">
  <div style="max-width:440px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
    <h2 style="margin:0 0 12px;color:#111">Verification code</h2>
    <p style="color:#444;line-height:1.5">Use this one-time code to continue:</p>
    <p style="font-size:32px;letter-spacing:6px;font-weight:700;text-align:center;margin:24px 0;color:#0f172a">${otp}</p>
    <p style="color:#666;font-size:14px">This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>
  </div>
</body></html>`;

    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      apiKey
    );

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.sender = { name: senderName, email: senderEmail };
    sendSmtpEmail.to = [{ email: to }];
    sendSmtpEmail.textContent = text;
    sendSmtpEmail.htmlContent = html;
    sendSmtpEmail.tags = ['otp'];

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

    return NextResponse.json({
      success: true,
      messageId: result.body?.messageId || 'sent',
      // Return OTP only for testing convenience — remove in strict production if needed
      otp,
      message: 'OTP email sent successfully',
    });
  } catch (error: any) {
    console.error('OTP send error:', error);
    let errorMessage = 'Failed to send OTP';
    if (error.response?.body?.message) {
      errorMessage = error.response.body.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
