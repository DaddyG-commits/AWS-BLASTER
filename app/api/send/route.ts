import { NextRequest, NextResponse } from 'next/server';
import {
  formatMailError,
  getMailConfig,
  isMailConfigured,
  sendMail,
} from '../../../lib/mail';
import { logEmail } from '../../../lib/store';
import { getSql, hasDatabase } from '../../../lib/db';

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

/** Prevent accidental double-send of same recipient+subject within 30 minutes */
async function wasRecentlySent(recipient: string, subject: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id FROM emails
      WHERE lower(recipient) = ${recipient.toLowerCase()}
        AND subject = ${subject}
        AND lower(trim(status)) = 'sent'
        AND created_at > NOW() - INTERVAL '30 minutes'
      LIMIT 1
    `;
    return (rows as any[]).length > 0;
  } catch {
    return false;
  }
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
    // Allow forced resend if client sets force: true
    const force = Boolean(body.force);

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

    // Soft safety: warn if batch is huge (Gmail ~500/day)
    if (recipients.length > 200 && !force) {
      return NextResponse.json(
        {
          error: `Batch is ${recipients.length} recipients. Gmail free limit is ~500/day. Split the list or pass force:true if you are sure.`,
          total: recipients.length,
        },
        { status: 400 }
      );
    }

    const dbReady = hasDatabase();
    const cfg = getMailConfig();
    const sender = cfg.fromEmail || cfg.user;
    const results: {
      recipient: string;
      success: boolean;
      messageId?: string;
      error?: string;
      logged?: boolean;
      skipped?: boolean;
    }[] = [];
    let loggedCount = 0;
    let skipped = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];

      if (!force) {
        const dup = await wasRecentlySent(recipient, subject);
        if (dup) {
          skipped++;
          results.push({
            recipient,
            success: true,
            skipped: true,
            error: 'Skipped: already sent same subject in last 30 minutes',
          });
          continue;
        }
      }

      try {
        const info = await sendMail({
          to: recipient,
          subject,
          text,
          html,
          fromName,
        });
        const messageId = info.messageId || `sent-${Date.now()}`;
        let logged = false;
        if (dbReady) {
          try {
            const id = await logEmail({
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
            logged = Boolean(id);
            if (logged) loggedCount++;
          } catch (dbErr) {
            console.error('logEmail sent failed', dbErr);
          }
        }
        results.push({ recipient, success: true, messageId, logged });
      } catch (error) {
        const errMsg = formatMailError(error);
        let logged = false;
        if (dbReady) {
          try {
            const id = await logEmail({
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
            logged = Boolean(id);
            if (logged) loggedCount++;
          } catch (dbErr) {
            console.error('logEmail failed', dbErr);
          }
        }
        results.push({ recipient, success: false, error: errMsg, logged });
      }
    }

    const sent = results.filter((r) => r.success && !r.skipped).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: sent > 0 || skipped > 0,
      total: results.length,
      sent,
      failed,
      skipped,
      results,
      database: dbReady,
      logged: dbReady && loggedCount > 0,
      loggedCount,
      message: `Sent ${sent} · Skipped ${skipped} · Failed ${failed} · Total ${results.length}`,
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
    database: hasDatabase(),
  });
}
