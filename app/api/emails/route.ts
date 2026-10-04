import { NextRequest, NextResponse } from 'next/server';
import { listEmails } from '../../../lib/store';
import { hasDatabase } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({
        emails: [],
        warning:
          'DATABASE_URL not set. Add Neon Postgres and run schema.sql to enable inbox history.',
      });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const type = searchParams.get('type') || undefined;
    const q = searchParams.get('q') || undefined;
    const limit = Number(searchParams.get('limit') || 100);

    const emails = await listEmails({ status, type, q, limit });

    return NextResponse.json({ emails, count: emails.length });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load emails',
        emails: [],
      },
      { status: 500 }
    );
  }
}
