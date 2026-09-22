import { NextResponse } from 'next/server';

const DAILY_LIMIT = 300;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'BREVO_API_KEY is not configured' },
      { status: 500 }
    );
  }

  const today = todayISO();
  const headers = {
    accept: 'application/json',
    'api-key': apiKey,
  };

  try {
    // Daily aggregated stats (requests + delivered, etc.)
    const reportRes = await fetch(
      `https://api.brevo.com/v3/smtp/statistics/reports?days=1&sort=desc`,
      { headers, cache: 'no-store' }
    );
    const reportData = reportRes.ok ? await reportRes.json() : null;

    let sentToday = 0;
    const reports: any[] = reportData?.reports || [];
    const todayReport =
      reports.find((r: any) => r.date === today) || reports[0];
    if (todayReport) {
      // requests ≈ emails accepted by Brevo for sending
      sentToday = Number(todayReport.requests || todayReport.sent || 0);
    }

    // Recent events for the inbox list
    const eventsRes = await fetch(
      `https://api.brevo.com/v3/smtp/statistics/events?limit=50&sort=desc&startDate=${today}&endDate=${today}`,
      { headers, cache: 'no-store' }
    );

    let events: any[] = [];
    if (eventsRes.ok) {
      const eventsData = await eventsRes.json();
      events = eventsData?.events || [];
    } else {
      // Fallback: last few days if today filter fails
      const fallback = await fetch(
        `https://api.brevo.com/v3/smtp/statistics/events?limit=40&sort=desc&days=7`,
        { headers, cache: 'no-store' }
      );
      if (fallback.ok) {
        const data = await fallback.json();
        events = data?.events || [];
      }
    }

    const messages = events.map((e: any) => ({
      email: e.email || e.to || '—',
      subject: e.subject || '(no subject)',
      event: e.event || e.eventName || 'sent',
      date: e.date || e.createdAt || e.ts || null,
      messageId: e.messageId || e.message_id || null,
      tag: e.tag || null,
      reason: e.reason || e.error || null,
    }));

    const remaining = Math.max(0, DAILY_LIMIT - sentToday);
    const percent = Math.min(100, Math.round((sentToday / DAILY_LIMIT) * 100));

    return NextResponse.json({
      success: true,
      quota: {
        limit: DAILY_LIMIT,
        used: sentToday,
        remaining,
        percent,
        date: today,
      },
      report: todayReport || null,
      messages,
      count: messages.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Failed to load inbox from Brevo',
      },
      { status: 500 }
    );
  }
}
