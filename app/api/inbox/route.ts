import { NextResponse } from 'next/server';

const DAILY_LIMIT = 300;
/** Project started ~ Sep 21 2026 — load from the day before so nothing is missed */
const HISTORY_START = '2026-09-20';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  const a = new Date(start + 'T12:00:00Z').getTime();
  const b = new Date(end + 'T12:00:00Z').getTime();
  return Math.max(0, Math.round((b - a) / 86400000));
}

/** Brevo date filters are limited to ~30 days per request — walk the full range in chunks */
function dateChunks(start: string, end: string, maxDays = 30) {
  const chunks: { start: string; end: string }[] = [];
  let cursor = start;
  while (cursor <= end) {
    const span = daysBetween(cursor, end);
    const chunkEnd =
      span <= maxDays - 1 ? end : addDays(cursor, maxDays - 1);
    chunks.push({ start: cursor, end: chunkEnd });
    if (chunkEnd >= end) break;
    cursor = addDays(chunkEnd, 1);
  }
  return chunks;
}

async function fetchEventsForRange(
  headers: Record<string, string>,
  startDate: string,
  endDate: string
) {
  const all: any[] = [];
  let offset = 0;
  const limit = 1000;

  for (let page = 0; page < 20; page++) {
    const url =
      `https://api.brevo.com/v3/smtp/statistics/events` +
      `?limit=${limit}&offset=${offset}&sort=desc` +
      `&startDate=${startDate}&endDate=${endDate}`;

    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      // days= fallback for single-window if date filter fails
      if (page === 0) {
        const days = Math.min(30, daysBetween(startDate, endDate) + 1);
        const fb = await fetch(
          `https://api.brevo.com/v3/smtp/statistics/events?limit=${limit}&sort=desc&days=${days}`,
          { headers, cache: 'no-store' }
        );
        if (fb.ok) {
          const data = await fb.json();
          return data?.events || [];
        }
      }
      break;
    }

    const data = await res.json();
    const batch = data?.events || [];
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return all;
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
    // —— Today's quota (300/day) ——
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
      sentToday = Number(todayReport.requests || todayReport.sent || 0);
    }

    // —— Full history from project start → today (all events including fails) ——
    const start = HISTORY_START <= today ? HISTORY_START : today;
    const chunks = dateChunks(start, today, 30);
    const events: any[] = [];

    for (const chunk of chunks) {
      const batch = await fetchEventsForRange(
        headers,
        chunk.start,
        chunk.end
      );
      events.push(...batch);
    }

    // Dedupe by messageId + event + email + date
    const seen = new Set<string>();
    const unique = events.filter((e) => {
      const key = [
        e.messageId || e.message_id || '',
        e.event || e.eventName || '',
        e.email || e.to || '',
        e.date || e.createdAt || '',
      ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => {
      const da = new Date(a.date || a.createdAt || 0).getTime();
      const db = new Date(b.date || b.createdAt || 0).getTime();
      return db - da;
    });

    const messages = unique.map((e: any) => ({
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
      history: {
        from: start,
        to: today,
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
