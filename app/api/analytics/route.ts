import { NextRequest, NextResponse } from 'next/server';
import { getSql, hasDatabase, ensureEmailTrackingColumns } from '../../../lib/db';
import { getStats } from '../../../lib/store';
import { leadStats } from '../../../lib/leads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

export async function GET(request: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({
      success: false,
      error: 'DATABASE_URL not set',
      overview: null,
    });
  }

  try {
    // Migrate columns if production DB is older than schema.sql
    await ensureEmailTrackingColumns();

    const sql = getSql();
    const days = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get('days') || 14), 1),
      90
    );

    const [stats, leads] = await Promise.all([getStats(), leadStats()]);

    let daily: any[] = [];
    try {
      daily = (await sql`
        SELECT date_trunc('day', created_at)::date AS day,
          COUNT(*)::int AS total,
          COALESCE(SUM(CASE WHEN lower(status) IN ('sent','delivered','opened') THEN 1 ELSE 0 END),0)::int AS sent,
          COALESCE(SUM(CASE WHEN lower(status) = 'failed' THEN 1 ELSE 0 END),0)::int AS failed,
          COALESCE(SUM(CASE WHEN lower(status) = 'opened' OR opened_at IS NOT NULL THEN 1 ELSE 0 END),0)::int AS opened,
          COALESCE(SUM(CASE WHEN lower(COALESCE(last_event,'')) = 'clicked' OR COALESCE(click_count, 0) > 0 THEN 1 ELSE 0 END),0)::int AS clicked
        FROM emails
        WHERE created_at >= NOW() - (${days} || ' days')::interval
        GROUP BY 1
        ORDER BY 1 ASC
      `) as any[];
    } catch (e) {
      console.warn('analytics daily with click cols failed, fallback', e);
      try {
        daily = (await sql`
          SELECT date_trunc('day', created_at)::date AS day,
            COUNT(*)::int AS total,
            COALESCE(SUM(CASE WHEN lower(status) IN ('sent','delivered','opened') THEN 1 ELSE 0 END),0)::int AS sent,
            COALESCE(SUM(CASE WHEN lower(status) = 'failed' THEN 1 ELSE 0 END),0)::int AS failed,
            COALESCE(SUM(CASE WHEN lower(status) = 'opened' THEN 1 ELSE 0 END),0)::int AS opened,
            0::int AS clicked
          FROM emails
          WHERE created_at >= NOW() - (${days} || ' days')::interval
          GROUP BY 1
          ORDER BY 1 ASC
        `) as any[];
      } catch (e2) {
        console.warn('analytics daily fallback', e2);
        daily = [];
      }
    }

    let topRecipients: any[] = [];
    try {
      topRecipients = (await sql`
        SELECT lower(recipient) AS email, COUNT(*)::int AS c
        FROM emails
        WHERE lower(status) IN ('sent','delivered','opened')
        GROUP BY 1
        ORDER BY c DESC
        LIMIT 15
      `) as any[];
    } catch {
      topRecipients = [];
    }

    let byType: any[] = [];
    try {
      byType = (await sql`
        SELECT message_type, COUNT(*)::int AS c
        FROM emails
        GROUP BY message_type
      `) as any[];
    } catch {
      byType = [];
    }

    let openSeries: any[] = [];
    try {
      openSeries = (await sql`
        SELECT date_trunc('day', opened_at)::date AS day,
          COUNT(*)::int AS opens
        FROM emails
        WHERE opened_at IS NOT NULL
          AND opened_at >= NOW() - (${days} || ' days')::interval
        GROUP BY 1
        ORDER BY 1 ASC
      `) as any[];
    } catch {
      openSeries = [];
    }

    const sent = stats.sent || 0;
    const opened = stats.opened || 0;
    const clicked = stats.clicked || 0;
    const openRate = sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0;
    const clickRate =
      opened > 0 ? Math.round((clicked / opened) * 1000) / 10 : 0;
    const failRate =
      stats.total > 0
        ? Math.round((stats.failed / stats.total) * 1000) / 10
        : 0;

    return NextResponse.json({
      success: true,
      days,
      overview: {
        ...stats,
        clicked,
        openRate,
        clickRate,
        failRate,
        leadsTotal: leads.total,
        leadsByStatus: leads.byStatus,
      },
      daily: daily.map((r) => ({
        day: r.day,
        total: n(r.total),
        sent: n(r.sent),
        failed: n(r.failed),
        opened: n(r.opened),
        clicked: n(r.clicked),
      })),
      opensByDay: openSeries.map((r) => ({
        day: r.day,
        opens: n(r.opens),
      })),
      topRecipients: topRecipients.map((r) => ({
        email: r.email,
        count: n(r.c),
      })),
      byType: byType.map((r) => ({
        type: r.message_type,
        count: n(r.c),
      })),
    });
  } catch (e: any) {
    console.error('analytics', e);
    return NextResponse.json(
      { success: false, error: e?.message || 'Analytics failed' },
      { status: 500 }
    );
  }
}
