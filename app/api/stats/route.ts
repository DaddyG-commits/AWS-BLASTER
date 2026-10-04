import { NextResponse } from 'next/server';
import { getStats } from '../../../lib/store';
import { hasDatabase } from '../../../lib/db';
import { isMailConfigured } from '../../../lib/mail';

export async function GET() {
  try {
    const stats = await getStats();
    return NextResponse.json({
      ...stats,
      database: hasDatabase(),
      mailConfigured: isMailConfigured(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        total: 0,
        sent: 0,
        failed: 0,
        otp: 0,
        email: 0,
        today: 0,
        todaySent: 0,
        todayFailed: 0,
        database: hasDatabase(),
        mailConfigured: isMailConfigured(),
        error: error instanceof Error ? error.message : 'stats failed',
      },
      { status: 200 }
    );
  }
}
