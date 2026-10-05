import { NextRequest, NextResponse } from 'next/server';
import { getSql, hasDatabase } from '../../../lib/db';
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
    const sql = getSql();
    const days = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get('days') || 14), 1),
      90
    );

    const [stats, leads, daily, topRecipients, byType, openSeries] =
      await Promise.all([
        getStats(),
        leadStats(),
        sql`
          SELECT date_trunc('day', created_at)::date AS day,
            COUNT(*)::int AS total,
            COALESCE(SUM(CASE WHEN lower(status) IN ('sent','delivered','opened') THEN 1 ELSE 0 END),0)::int AS sent,
            COALESCE(SUM(CASE WHEN lower(status) = 'failed' THEN 1 ELSE 0 END),0)::int AS failed,
            COALESCE(SUM(CASE WHEN lower(status) = 'opened' THEN 1 ELSE 0 END),0)::int AS opened
          FROM emails
          WHERE created_at >= NOW() - (${days} || ' days')::interval
          GROUP BY 1
          ORDER BY 1 ASC
        `,
        sql`
          SELECT lower(recipient) AS email, COUNT(*)::int AS c
          FROM emails
          WHERE lower(status) IN ('sent','delivered','opened')
          GROUP BY 1
          ORDER BY c DESC
          LIMIT 15
        `,
        sql`
          SELECT message_type, COUNT(*)::int AS c
          FROM emails
          GROUP BY message_type
        `,
        sql`
          SELECT date_trunc('day', opened_at)::date AS day,
            COUNT(*)::int AS opens
          FROM emails
          WHERE opened_at IS NOT NULL
            AND opened_at >= NOW() - (${days} || ' days')::interval
          GROUP BY 1
          ORDER BY 1 ASC
        `,
      ]);

    const sent = stats.sent || 0;
    const opened = stats.opened || 0;
    const openRate = sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0;
    const failRate =
      stats.total > 0
        ? Math.round((stats.failed / stats.total) * 1000) / 10
        : 0;

    return NextResponse.json({
      success: true,
      days,
      overview: {
        ...stats,
        openRate,
        failRate,
        leadsTotal: leads.total,
        leadsByStatus: leads.byStatus,
      },
      daily: (daily as any[]).map((r) => ({
        day: r.day,
        total: n(r.total),
        sent: n(r.sent),
        failed: n(r.failed),
        opened: n(r.opened),
      })),
      opensByDay: (openSeries as any[]).map((r) => ({
        day: r.day,
        opens: n(r.opens),
      })),
      topRecipients: (topRecipients as any[]).map((r) => ({
        email: r.email,
        count: n(r.c),
      })),
      byType: (byType as any[]).map((r) => ({
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
