import { NextRequest, NextResponse } from 'next/server';
import {
  enqueueCampaign,
  listCampaigns,
  ensureQueueTables,
  type QueueRecipient,
} from '../../../lib/queue';
import { listLeads } from '../../../lib/leads';
import { hasDatabase } from '../../../lib/db';
import { isMailConfigured } from '../../../lib/mail';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function parseRecipients(to: unknown): QueueRecipient[] {
  let list: string[] = [];
  if (Array.isArray(to)) list = to.map(String);
  else if (typeof to === 'string') list = to.split(/[,;\n]+/);

  const out: QueueRecipient[] = [];
  const seen = new Set<string>();
  for (const part of list) {
    const p = part.trim();
    if (!p) continue;
    const angle = p.match(/^(.*?)\s*<\s*([^>]+)\s*>$/);
    let email = p;
    let name: string | undefined;
    if (angle) {
      name = angle[1].replace(/^["']|["']$/g, '').trim() || undefined;
      email = angle[2].trim();
    }
    email = email.toLowerCase();
    if (!email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, name: name || email.split('@')[0] });
  }
  return out;
}

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ campaigns: [], database: false });
  }
  await ensureQueueTables();
  const campaigns = await listCampaigns(100);
  return NextResponse.json({ success: true, campaigns, database: true });
}

/** Enqueue a large campaign (does not send yet — call /api/campaigns/process). */
export async function POST(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json(
        { error: 'DATABASE_URL required for background queue' },
        { status: 400 }
      );
    }
    if (!isMailConfigured()) {
      return NextResponse.json(
        { error: 'SMTP not configured' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const name = String(body.name || 'Campaign').trim();
    const subject = String(body.subject || '').trim();
    const html = body.html ? String(body.html) : undefined;
    const text = body.text ? String(body.text) : undefined;
    const fromName = body.fromName ? String(body.fromName) : undefined;
    const mode = body.mode === 'leads' ? 'leads' : 'manual';
    const limit = Math.min(Math.max(Number(body.limit) || 5000, 1), 10000);

    if (!subject || (!html && !text)) {
      return NextResponse.json(
        { error: 'subject and html or text required' },
        { status: 400 }
      );
    }

    let recipients: QueueRecipient[] = [];
    if (mode === 'leads') {
      const leads = await listLeads({
        status: body.status || 'NEW',
        limit,
      });
      recipients = leads
        .filter((l) => l.email)
        .map((l) => ({
          email: l.email as string,
          name: l.name,
          company: l.company || undefined,
          title: l.title || undefined,
        }));
    } else {
      recipients = parseRecipients(body.to || body.recipients).slice(0, limit);
    }

    if (!recipients.length) {
      return NextResponse.json(
        { error: 'No recipients' },
        { status: 400 }
      );
    }

    const { campaignId, total } = await enqueueCampaign({
      name,
      subject,
      html,
      text,
      fromName,
      mode,
      recipients,
    });

    return NextResponse.json({
      success: true,
      queued: true,
      campaignId,
      total,
      message: `Queued ${total} recipients. Call POST /api/campaigns/process (or use Campaigns UI) until complete.`,
      processUrl: '/api/campaigns/process',
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: e?.message || 'Enqueue failed' },
      { status: 500 }
    );
  }
}
