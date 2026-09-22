import { NextResponse } from 'next/server';
import { isMailConfigured, getMailConfig } from '../../../lib/mail';

/** Personal Gmail typical daily limit (not exact — Google does not publish a fixed API) */
const DAILY_LIMIT = 500;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const today = todayISO();
  const configured = isMailConfigured();
  const cfg = getMailConfig();

  return NextResponse.json({
    success: true,
    provider: 'gmail',
    configured,
    account: configured ? cfg.user : null,
    quota: {
      limit: DAILY_LIMIT,
      used: null,
      remaining: null,
      percent: null,
      date: today,
      note: 'Gmail does not expose send counts via API. Check Gmail → Sent for history. Typical free limit is ~500/day.',
    },
    history: {
      from: null,
      to: today,
      note: 'Send history lives in the Gmail Sent folder for this account. Live event feed was Brevo-only.',
    },
    messages: [],
    count: 0,
  });
}
