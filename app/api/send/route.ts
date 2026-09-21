import { NextRequest, NextResponse } from 'next/server';
import * as brevo from '@getbrevo/brevo';

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, text, html, fromName } = body;

    // Validate required fields
    if (!to || !subject || (!text && !html)) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, and text or html are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || 'AWS BLASTER';

    if (!apiKey || !senderEmail) {
      return NextResponse.json(
        { error: 'Brevo configuration missing. Please set BREVO_API_KEY and BREVO_SENDER_EMAIL environment variables.' },
        { status: 500 }
      );
    }

    // Prepare recipients (support single email or array)
    const recipients = Array.isArray(to)
      ? to.map((email: string) => ({ email: email.trim() }))
      : [{ email: to.trim() }];

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.sender = {
      name: fromName || senderName,
      email: senderEmail,
    };
    sendSmtpEmail.to = recipients;

    // Prefer HTML if provided, otherwise use text
    if (html) {
      sendSmtpEmail.htmlContent = html;
      if (text) {
        sendSmtpEmail.textContent = text;
      }
    } else {
      sendSmtpEmail.textContent = text;
      // Convert plain text to simple HTML as fallback
      sendSmtpEmail.htmlContent = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

    return NextResponse.json({
      success: true,
      messageId: result.body?.messageId || 'sent',
      message: 'Email sent successfully via Brevo',
    });
  } catch (error: any) {
    console.error('Brevo Error:', error);

    let errorMessage = 'Failed to send email';

    if (error.response?.body?.message) {
      errorMessage = error.response.body.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Helpful common errors
    if (errorMessage.includes('api-key') || errorMessage.includes('unauthorized')) {
      errorMessage = 'Invalid Brevo API key. Please check your BREVO_API_KEY.';
    } else if (errorMessage.includes('sender')) {
      errorMessage = 'Sender email not verified. Please verify the sender email in your Brevo account.';
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'AWS BLASTER - Brevo Email',
    endpoints: {
      send: 'POST /api/send',
    },
    requiredEnv: ['BREVO_API_KEY', 'BREVO_SENDER_EMAIL'],
  });
}