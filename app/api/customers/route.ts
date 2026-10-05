import { NextRequest, NextResponse } from 'next/server';
import {
  listCustomers,
  syncCustomersFromEmails,
  upsertCustomer,
  getStats,
} from '../../../lib/store';
import { hasDatabase } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({
        customers: [],
        contacts: [],
        totalUnique: 0,
        warning: 'DATABASE_URL not set',
      });
    }
    const q = new URL(request.url).searchParams.get('q') || undefined;
    const customers = await listCustomers(q);
    const stats = await getStats().catch(() => null);
    return NextResponse.json({
      customers,
      contacts: customers,
      count: customers.length,
      totalUnique: customers.length,
      totalSentLogs: stats?.sent || 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        customers: [],
        contacts: [],
        totalUnique: 0,
        error: error instanceof Error ? error.message : 'Failed',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json(
        { error: 'DATABASE_URL not set' },
        { status: 500 }
      );
    }
    const body = await request.json();

    if (body.action === 'sync' || body.sync === true) {
      const added = await syncCustomersFromEmails();
      const customers = await listCustomers();
      return NextResponse.json({
        success: true,
        added,
        customers,
        contacts: customers,
        totalUnique: customers.length,
        message: `Synced. ${added} new contact(s) from sent inbox.`,
      });
    }

    const email = String(body.email || '').trim().toLowerCase();
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    await upsertCustomer(email, {
      name: body.name ? String(body.name) : '',
      note: body.note ? String(body.note) : '',
    });

    const customers = await listCustomers();
    return NextResponse.json({
      success: true,
      customers,
      contacts: customers,
      totalUnique: customers.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
