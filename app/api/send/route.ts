import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, text, html, from } = body;

    // Validate required fields
    if (!to || !subject || (!text && !html)) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject, and text or html are required' },
        { status: 400 }
      );
    }

    // Check environment variables
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const defaultFrom = process.env.SMTP_FROM || user;

    if (!host || !user || !pass) {
      return NextResponse.json(
        { error: 'SMTP configuration missing. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables.' },
        { status: 500 }
      );
    }

    // Create transporter for Zoho Mail SMTP
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports (STARTTLS on 587)
      auth: {
        user,
        pass,
      },
      // Optional: increase timeout for Vercel serverless
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    // Send the email
    const info = await transporter.sendMail({
      from: from || defaultFrom,
      to,
      subject,
      text: text || undefined,
      html: html || undefined,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      response: info.response,
    });
  } catch (error: any) {
    console.error('SMTP Error:', error);

    // Provide helpful error messages
    let errorMessage = error.message || 'Failed to send email';

    if (errorMessage.includes('535') || errorMessage.includes('Authentication')) {
      errorMessage = 'Authentication failed. Check your SMTP_USER and SMTP_PASSWORD (use App-Specific Password if 2FA is enabled). Also verify you are using the correct host (smtp.zoho.com vs smtppro.zoho.com).';
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
      errorMessage = 'Could not connect to SMTP server. Check SMTP_HOST and SMTP_PORT.';
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// Optional: Health check / GET handler
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'AWS BLASTER - Zoho SMTP',
    endpoints: {
      send: 'POST /api/send',
    },
    requiredEnv: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'],
  });
}