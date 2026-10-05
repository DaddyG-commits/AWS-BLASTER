/**
 * Background campaign queue — process in small batches so serverless
 * never times out. Call POST /api/campaigns/process repeatedly (or via cron)
 * until remaining === 0.
 */
import { randomUUID } from 'crypto';
import { getSql, hasDatabase } from './db';
import {
  sendMail,
  personalize,
  sendDelayMs,
  delay,
  getMailConfig,
  formatMailError,
} from './mail';
import { logEmail } from './store';
import { injectOpenPixel, injectClickTracking } from './tracking';
import { isSuppressed, updateLeadStatus } from './leads';

const BATCH_SIZE = Math.min(
  Math.max(parseInt(process.env.QUEUE_BATCH_SIZE || '15', 10), 1),
  40
);

export async function ensureQueueTables() {
  if (!hasDatabase()) return { ok: false as const, error: 'No DATABASE_URL' };
  const sql = getSql();
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        total INT NOT NULL DEFAULT 0,
        sent INT NOT NULL DEFAULT 0,
        failed INT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMPTZ
      )
    `;
    // Extra columns for queue body templates
    try {
      await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS html_body TEXT`;
      await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS text_body TEXT`;
      await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS from_name TEXT`;
      await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'manual'`;
    } catch {
      /* older neon may not support IF NOT EXISTS on ADD COLUMN the same way */
    }

    await sql`
      CREATE TABLE IF NOT EXISTS campaign_recipients (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        company TEXT,
        title TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        email_log_id TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_cr_campaign_status ON campaign_recipients (campaign_id, status)`;
    return { ok: true as const };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || String(e) };
  }
}

export type QueueRecipient = {
  email: string;
  name?: string;
  company?: string;
  title?: string;
};

export async function enqueueCampaign(opts: {
  name: string;
  subject: string;
  html?: string;
  text?: string;
  fromName?: string;
  mode?: string;
  recipients: QueueRecipient[];
}): Promise<{ campaignId: string; total: number }> {
  if (!hasDatabase()) throw new Error('DATABASE_URL required for queue');
  await ensureQueueTables();
  const sql = getSql();
  const campaignId = randomUUID();
  const total = opts.recipients.length;

  await sql`
    INSERT INTO campaigns (id, name, subject, status, total, sent, failed, html_body, text_body, from_name, mode)
    VALUES (
      ${campaignId},
      ${opts.name},
      ${opts.subject},
      'queued',
      ${total},
      0,
      0,
      ${opts.html || null},
      ${opts.text || null},
      ${opts.fromName || null},
      ${opts.mode || 'manual'}
    )
  `;

  // Insert recipients in chunks of 100
  for (let i = 0; i < opts.recipients.length; i += 100) {
    const slice = opts.recipients.slice(i, i + 100);
    for (const r of slice) {
      const id = randomUUID();
      await sql`
        INSERT INTO campaign_recipients (id, campaign_id, email, name, company, title, status)
        VALUES (
          ${id},
          ${campaignId},
          ${r.email.toLowerCase()},
          ${r.name || null},
          ${r.company || null},
          ${r.title || null},
          'pending'
        )
      `;
    }
  }

  return { campaignId, total };
}

function prepareTrackedHtml(html: string | undefined, emailId: string) {
  if (!html) return undefined;
  let out = injectOpenPixel(html, emailId);
  out = injectClickTracking(out, emailId);
  return out;
}

/** Process up to BATCH_SIZE pending recipients for one campaign (or next queued). */
export async function processCampaignBatch(campaignId?: string): Promise<{
  campaignId: string | null;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
  status: string;
}> {
  if (!hasDatabase()) {
    return {
      campaignId: null,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      remaining: 0,
      status: 'no-db',
    };
  }
  await ensureQueueTables();
  const sql = getSql();

  let id = campaignId;
  if (!id) {
    const rows = await sql`
      SELECT id FROM campaigns
      WHERE status IN ('queued', 'sending')
      ORDER BY created_at ASC
      LIMIT 1
    `;
    id = (rows as any[])[0]?.id;
  }
  if (!id) {
    return {
      campaignId: null,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      remaining: 0,
      status: 'idle',
    };
  }

  const camps = await sql`
    SELECT id, name, subject, html_body, text_body, from_name, mode, status, sent, failed, total
    FROM campaigns WHERE id = ${id} LIMIT 1
  `;
  const campaign = (camps as any[])[0];
  if (!campaign) {
    return {
      campaignId: id,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      remaining: 0,
      status: 'not-found',
    };
  }

  await sql`UPDATE campaigns SET status = 'sending' WHERE id = ${id}`;

  const recipients = await sql`
    SELECT id, email, name, company, title
    FROM campaign_recipients
    WHERE campaign_id = ${id} AND status = 'pending'
    ORDER BY created_at ASC
    LIMIT ${BATCH_SIZE}
  `;

  const list = recipients as {
    id: string;
    email: string;
    name: string | null;
    company: string | null;
    title: string | null;
  }[];

  if (list.length === 0) {
    await sql`
      UPDATE campaigns SET status = 'completed', finished_at = NOW()
      WHERE id = ${id}
    `;
    return {
      campaignId: id,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      remaining: 0,
      status: 'completed',
    };
  }

  const cfg = getMailConfig();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const email = r.email.toLowerCase();

    if (await isSuppressed(email)) {
      await sql`
        UPDATE campaign_recipients
        SET status = 'skipped', error_message = 'suppressed'
        WHERE id = ${r.id}
      `;
      skipped++;
      continue;
    }

    const vars = {
      name: r.name || email.split('@')[0],
      company: r.company || undefined,
      title: r.title || undefined,
      email,
    };
    const subject = personalize(String(campaign.subject || ''), vars);
    const htmlTpl = campaign.html_body ? String(campaign.html_body) : undefined;
    const textTpl = campaign.text_body ? String(campaign.text_body) : undefined;
    const personalizedHtml = htmlTpl ? personalize(htmlTpl, vars) : undefined;
    const personalizedText = textTpl ? personalize(textTpl, vars) : undefined;
    const emailLogId = randomUUID();
    const trackedHtml = prepareTrackedHtml(personalizedHtml, emailLogId);

    try {
      const info = await sendMail({
        to: email,
        subject,
        text: personalizedText,
        html: trackedHtml || personalizedHtml,
        fromName: campaign.from_name || undefined,
      });

      await logEmail({
        id: emailLogId,
        sender: cfg.fromEmail || cfg.user,
        recipient: email,
        subject,
        text: personalizedText,
        html: trackedHtml || personalizedHtml,
        messageType: 'email',
        status: 'delivered',
        messageId: info.messageId,
        campaignId: id,
      });

      await sql`
        UPDATE campaign_recipients
        SET status = 'sent', sent_at = NOW(), email_log_id = ${emailLogId}
        WHERE id = ${r.id}
      `;

      if (campaign.mode === 'leads') {
        await updateLeadStatus(email, 'CONTACTED');
      }

      sent++;
    } catch (e) {
      const errMsg = formatMailError(e);
      await logEmail({
        id: emailLogId,
        sender: cfg.fromEmail || cfg.user,
        recipient: email,
        subject,
        text: personalizedText,
        html: trackedHtml || personalizedHtml,
        messageType: 'email',
        status: 'failed',
        error: errMsg,
        campaignId: id,
      });
      await sql`
        UPDATE campaign_recipients
        SET status = 'failed', error_message = ${errMsg}
        WHERE id = ${r.id}
      `;
      failed++;
    }

    if (i < list.length - 1) {
      await delay(sendDelayMs());
    }
  }

  // Update campaign counters
  await sql`
    UPDATE campaigns SET
      sent = sent + ${sent},
      failed = failed + ${failed}
    WHERE id = ${id}
  `;

  const rem = await sql`
    SELECT COUNT(*)::int AS c FROM campaign_recipients
    WHERE campaign_id = ${id} AND status = 'pending'
  `;
  const remaining = Number((rem as any[])[0]?.c || 0);

  if (remaining === 0) {
    await sql`
      UPDATE campaigns SET status = 'completed', finished_at = NOW()
      WHERE id = ${id}
    `;
  }

  return {
    campaignId: id,
    processed: list.length,
    sent,
    failed,
    skipped,
    remaining,
    status: remaining === 0 ? 'completed' : 'sending',
  };
}

export async function getCampaignStatus(campaignId: string) {
  if (!hasDatabase()) return null;
  const sql = getSql();
  const rows = await sql`SELECT * FROM campaigns WHERE id = ${campaignId} LIMIT 1`;
  const c = (rows as any[])[0];
  if (!c) return null;
  const counts = await sql`
    SELECT status, COUNT(*)::int AS c FROM campaign_recipients
    WHERE campaign_id = ${campaignId}
    GROUP BY status
  `;
  return { campaign: c, counts };
}

export async function listCampaigns(limit = 50) {
  if (!hasDatabase()) return [];
  await ensureQueueTables();
  const sql = getSql();
  return (await sql`
    SELECT * FROM campaigns ORDER BY created_at DESC LIMIT ${limit}
  `) as any[];
}
