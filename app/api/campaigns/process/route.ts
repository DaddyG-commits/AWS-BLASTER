import { NextRequest, NextResponse } from 'next/server';
import { processCampaignBatch, getCampaignStatus } from '../../../../lib/queue';
import { isMailConfigured } from '../../../../lib/mail';
import { hasDatabase } from '../../../../lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Process one batch of a queued campaign (~15 recipients by default).
 * Safe for Vercel serverless — call repeatedly until remaining === 0.
 *
 * Body: { campaignId?: string, maxBatches?: number }
 * maxBatches (1–10) runs multiple batches in one request for faster drain.
 */
export async function POST(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({ error: 'DATABASE_URL required' }, { status: 400 });
    }
    if (!isMailConfigured()) {
      return NextResponse.json({ error: 'SMTP not configured' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const campaignId = body.campaignId ? String(body.campaignId) : undefined;
    const maxBatches = Math.min(Math.max(Number(body.maxBatches) || 1, 1), 10);

    const batches = [];
    let last = await processCampaignBatch(campaignId);
    batches.push(last);

    for (let i = 1; i < maxBatches && last.remaining > 0 && last.campaignId; i++) {
      last = await processCampaignBatch(last.campaignId);
      batches.push(last);
    }

    const status = last.campaignId
      ? await getCampaignStatus(last.campaignId)
      : null;

    return NextResponse.json({
      success: true,
      ...last,
      batchesRun: batches.length,
      campaign: status?.campaign || null,
      counts: status?.counts || null,
    });
  } catch (e: any) {
    console.error('process batch', e);
    return NextResponse.json(
      { error: e?.message || 'Process failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('campaignId');
  if (!id) {
    return NextResponse.json({
      usage: 'POST to process batch; GET ?campaignId= for status',
    });
  }
  const status = await getCampaignStatus(id);
  if (!status) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, ...status });
}
