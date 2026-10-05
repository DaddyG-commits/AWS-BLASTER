import { NextRequest, NextResponse } from 'next/server';
import {
  ensureLeadsTable,
  listLeads,
  upsertLead,
  leadStats,
} from '../../../lib/leads';
import { hasDatabase } from '../../../lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({
        success: true,
        leads: [],
        stats: { total: 0, byStatus: {} },
        note: 'Set DATABASE_URL and run schema.sql',
      });
    }
    await ensureLeadsTable();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const q = searchParams.get('q') || undefined;
    const limit = Number(searchParams.get('limit') || 200);
    const setup = searchParams.get('setup') === '1';

    if (setup) {
      const r = await ensureLeadsTable();
      return NextResponse.json({ success: r.ok, ...r });
    }

    const [leads, stats] = await Promise.all([
      listLeads({ status, q, limit }),
      leadStats(),
    ]);

    return NextResponse.json({ success: true, leads, stats, total: leads.length });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to list leads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json(
        { error: 'DATABASE_URL required' },
        { status: 400 }
      );
    }
    const body = await request.json();

    if (body.setup) {
      const r = await ensureLeadsTable();
      return NextResponse.json({ success: r.ok, ...r });
    }

    if (Array.isArray(body.leads)) {
      const saved = [];
      for (const item of body.leads.slice(0, 100)) {
        const lead = await upsertLead({
          name: String(item.name || item.email || 'Unknown'),
          title: item.title,
          company: item.company,
          email: item.email,
          source: item.source || 'import',
          score: item.score,
          tags: item.tags,
          status: item.status || 'NEW',
          cik: item.cik,
          filing_type: item.filing_type,
        });
        if (lead) saved.push(lead);
      }
      return NextResponse.json({
        success: true,
        saved: saved.length,
        leads: saved,
      });
    }

    if (!body.name && !body.email) {
      return NextResponse.json(
        { error: 'name or email required' },
        { status: 400 }
      );
    }

    const lead = await upsertLead({
      name: String(body.name || body.email),
      title: body.title,
      company: body.company,
      email: body.email,
      source: body.source || 'manual',
      score: body.score,
      tags: body.tags,
      status: body.status || 'NEW',
      notes: body.notes,
    });

    return NextResponse.json({ success: true, lead });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to save lead' },
      { status: 500 }
    );
  }
}
