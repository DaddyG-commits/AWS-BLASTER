import { NextRequest, NextResponse } from 'next/server';
import {
  listCustomers,
  syncCustomersFromEmails,
  upsertCustomer,
} from '../../../lib/store';
import { hasDatabase } from '../../../lib/db';

export async function GET(request: NextRequest) {
  try {
    if (!hasDatabase()) {
      return NextResponse.json({
        customers: [],
        warning: 'DATABASE_URL not set',
      });
    }
    const q = new URL(request.url).searchParams.get('q') || undefined;
    const customers = await listCustomers(q);
    return NextResponse.json({ customers, count: customers.length });
  } catch (error) {
    return NextResponse.json(
      {
        customers: [],
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

    if (body.action === 'sync') {
      const added = await syncCustomersFromEmails();
      const customers = await listCustomers();
      return NextResponse.json({
        success: true,
        added,
        customers,
        message: `Synced. ${added} new customer(s) from sent inbox.`,
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
    return NextResponse.json({ success: true, customers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed' },
      { status: 500 }
    );
  }
}
