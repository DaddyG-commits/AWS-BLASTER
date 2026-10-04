import { NextRequest, NextResponse } from 'next/server';
import { recordOpen } from '../../../../lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const id = (request.nextUrl.searchParams.get('id') || '').trim();
  const u = request.nextUrl.searchParams.get('u') || '';

  let target = 'https://www.google.com';
  try {
    const parsed = new URL(u);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      target = parsed.toString();
    }
  } catch {
    /* keep default */
  }

  // A click also counts as engagement / opened
  if (id) {
    try {
      await recordOpen(id);
      console.log('[track/click]', id, target);
    } catch (e) {
      console.error('[track/click]', e);
    }
  }

  return NextResponse.redirect(target, 302);
}
