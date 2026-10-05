import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  formatMailError,
  getMailConfig,
  isMailConfigured,
  sendMail,
  personalize,
  sendDelayMs,
  delay,
  verifyMailConnection,
} from '../../../lib/mail';
import { logEmail } from '../../../lib/store';
import { getSql, hasDatabase } from '../../../lib/db';
import {
  injectClickTracking,
  injectOpenPixel,
  getAppBaseUrl,
} from '../../../lib/tracking';
import {
  listLeads,
  updateLeadStatus,
  isSuppressed,
} from '../../../lib/leads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type Recipient = {
  email: string;
  name?: string;
  company?: string;
  title?: string;
};

function parseRecipients(to: unknown): Recipient[] {
  let list: string[] = [];
  if (Array.isArray(to)) {
    list = to.map((e) => String(e).trim()).filter(Boolean);
  } else if (typeof to === 'string') {
    list = to.split(/[,;\n]+/).map((e) => e.trim()).filter(Boolean);
  }

  const out: Recipient[] = [];
  const seen = new Set<string>();

  for (const part of list) {
    const angle = part.match(/^(.*?)\s*<\s*([^>]+)\s*>$/);
    let email = part;
    let name: string | undefined;
    if (angle) {
      name = angle[1].replace(/^["']|["']$/g, '').trim() || undefined;
      email = angle[2].trim();
    }
    email = email.toLowerCase();
    if (!email.includes('@')) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push({
      email,
      name: name || email.split('@')[0],
    });
  }
  return out;
}

async function wasRecentlySent(recipient: string, subject: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id FROM emails
      WHERE lower(recipient) = ${recipient.toLowerCase()}
        AND subject = ${subject}
        AND lower(trim(status)) IN ('sent', 'delivered', 'opened')
        AND created_at > NOW() - INTERVAL '30 minutes'
      LIMIT 1
    `;
    return (rows as any[]).length > 0;
  } catch {
    return false;
  }
}

function prepareTrackedHtml(html: string | undefined, emailId: string) {
  if (!html) return undefined;
  let out = injectOpenPixel(html, emailId);
  out = injectClickTracking(out, emailId);
  return out;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const subjectTemplate = String(body.subject || '').trim();
    const textTemplate = body.text ? String(body.text) : undefined;
    const htmlTemplate = body.html ? String(body.html) : undefined;
    const fromName = body.fromName ? String(body.fromName).trim() : undefined;
    const campaignId = body.campaignId ? String(body.campaignId) : undefined;
    const force = Boolean(body.force);
    const dryRun = Boolean(body.dryRun);
    const mode = body.mode === 'leads' ? 'leads' : 'manual';
    const statusFilter = body.status || 'NEW';
    const limit = Math.min(Math.max(Number(body.limit) || 500, 1), 500);

    if (!subjectTemplate || (!textTemplate && !htmlTemplate)) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: subject, and text or html are required',
        },
        { status: 400 }
      );
    }

    if (!isMailConfigured()) {
      return NextResponse.json(
        {
          error:
            'SMTP not configured. Set SMTP_USER and SMTP_PASS (Gmail App Password or SES SMTP credentials).',
        },
        { status: 500 }
      );
    }

    let recipients: Recipient[] = [];

    if (mode === 'leads') {
      if (!hasDatabase()) {
        return NextResponse.json(
          { error: 'DATABASE_URL required for mode=leads' },
          { status: 400 }
        );
      }
      const leads = await listLeads({ status: statusFilter, limit });
      recipients = leads
        .filter((l) => l.email)
        .map((l) => ({
          email: l.email as string,
          name: l.name,
          company: l.company || undefined,
          title: l.title || undefined,
        }));
      if (!recipients.length) {
        return NextResponse.json({
          success: true,
          sent: 0,
          failed: 0,
          message: `No leads with status ${statusFilter}`,
        });
      }
    } else {
      recipients = parseRecipients(body.to).slice(0, limit);
      if (!recipients.length) {
        return NextResponse.json(
          { error: 'At least one valid recipient required in to' },
          { status: 400 }
        );
      }
    }

    if (recipients.length > 200 && !force && mode === 'manual') {
      return NextResponse.json(
        {
          error: `Batch is ${recipients.length} recipients. Pass force:true if you are sure (SES recommended for volume).`,
          total: recipients.length,
        },
        { status: 400 }
      );
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        mode,
        wouldSend: recipients.length,
        recipients: recipients.map((r) => ({
          email: r.email,
          name: r.name,
          subject: personalize(subjectTemplate, {
            name: r.name,
            company: r.company,
            email: r.email,
            title: r.title,
          }),
        })),
        appUrl: getAppBaseUrl(),
      });
    }

    const dbReady = hasDatabase();
    const cfg = getMailConfig();
    const sender = cfg.fromEmail || cfg.user;
    const results: {
      recipient: string;
      success: boolean;
      messageId?: string;
      emailId?: string;
      error?: string;
      logged?: boolean;
      skipped?: boolean;
      status?: string;
      suppressed?: boolean;
    }[] = [];
    let loggedCount = 0;
    let skipped = 0;

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];

      if (await isSuppressed(r.email)) {
        skipped++;
        results.push({
          recipient: r.email,
          success: true,
          skipped: true,
          suppressed: true,
          error: 'Suppressed (bounce/complaint list)',
        });
        continue;
      }

      const vars = {
        name: r.name,
        company: r.company,
        email: r.email,
        title: r.title,
      };
      const subject = personalize(subjectTemplate, vars);

      if (!force) {
        const dup = await wasRecentlySent(r.email, subject);
        if (dup) {
          skipped++;
          results.push({
            recipient: r.email,
            success: true,
            skipped: true,
            error: 'Skipped: already sent same subject in last 30 minutes',
          });
          continue;
        }
      }

      const emailId = randomUUID();
      const personalizedHtml = htmlTemplate
        ? personalize(htmlTemplate, vars)
        : undefined;
      const personalizedText = textTemplate
        ? personalize(textTemplate, vars)
        : undefined;
      const trackedHtml = prepareTrackedHtml(personalizedHtml, emailId);

      try {
        const info = await sendMail({
          to: r.email,
          subject,
          text: personalizedText,
          html: trackedHtml || personalizedHtml,
          fromName,
        });
        const messageId = info.messageId || `sent-${Date.now()}`;
        let logged = false;
        if (dbReady) {
          try {
            const id = await logEmail({
              id: emailId,
              sender,
              recipient: r.email,
              subject,
              text: personalizedText,
              html: trackedHtml || personalizedHtml,
              messageType: 'email',
              status: 'delivered',
              messageId,
              campaignId,
            });
            logged = Boolean(id);
            if (logged) loggedCount++;
          } catch (dbErr) {
            console.error('logEmail sent failed', dbErr);
          }
        }

        if (mode === 'leads') {
          await updateLeadStatus(r.email, 'CONTACTED');
        }

        results.push({
          recipient: r.email,
          success: true,
          messageId,
          emailId,
          logged,
          status: 'delivered',
        });
      } catch (error) {
        const errMsg = formatMailError(error);
        let logged = false;
        if (dbReady) {
          try {
            const id = await logEmail({
              id: emailId,
              sender,
              recipient: r.email,
              subject,
              text: personalizedText,
              html: trackedHtml || personalizedHtml,
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
        results.push({
          recipient: r.email,
          success: false,
          error: errMsg,
          logged,
          emailId,
          status: 'failed',
        });
      }

      if (i < recipients.length - 1) {
        await delay(sendDelayMs());
      }
    }

    const sent = results.filter((r) => r.success && !r.skipped).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: sent > 0 || skipped > 0,
      mode,
      total: results.length,
      sent,
      failed,
      skipped,
      results,
      database: dbReady,
      logged: dbReady && loggedCount > 0,
      loggedCount,
      appUrl: getAppBaseUrl(),
      message: `Sent ${sent} · Skipped ${skipped} · Failed ${failed} · Total ${results.length}`,
    });
  } catch (error: unknown) {
    console.error('Send error:', error);
    return NextResponse.json(
      { success: false, error: formatMailError(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const configured = isMailConfigured();
  let verified = false;
  let error: string | undefined;
  if (configured) {
    const r = await verifyMailConnection();
    verified = r.ok;
    error = r.error;
  }
  const cfg = getMailConfig();
  return NextResponse.json({
    status: 'ok',
    service: 'AWS BLASTER — LeadBot-grade SMTP',
    configured,
    verified,
    error,
    host: cfg.host,
    from: cfg.fromEmail,
    fromName: cfg.fromName,
    isSes: cfg.isSes,
    isGmail: cfg.isGmail,
    appUrl: getAppBaseUrl(),
    database: hasDatabase(),
    endpoints: {
      send: 'POST /api/send  { to|mode:"leads", subject, html|text, dryRun?, force? }',
      leads: 'GET/POST /api/leads',
      secExtract: 'POST /api/sec/extract { cik }',
      verify: 'POST /api/verify { email|emails[]|fromLeads }',
      trackOpen: 'GET /api/track/open?id=',
      trackClick: 'GET /api/track/click?id=&u=',
    },
  });
}
