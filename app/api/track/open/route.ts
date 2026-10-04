import { NextRequest, NextResponse } from 'next/server';
import { recordOpen } from '../../../../lib/store';
import { TRANSPARENT_GIF } from '../../../../lib/tracking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function gifResponse() {
  return new NextResponse(new Uint8Array(TRANSPARENT_GIF), {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
      // Allow email image proxies (Gmail, etc.) to fetch the pixel
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function GET(request: NextRequest) {
  const id = (request.nextUrl.searchParams.get('id') || '').trim();

  if (id) {
    try {
      const ok = await recordOpen(id);
      console.log('[track/open]', id, ok ? 'recorded' : 'not-recorded');
    } catch (e) {
      console.error('[track/open] error', id, e);
    }
  } else {
    console.warn('[track/open] missing id');
  }

  return gifResponse();
}

// Some proxies probe with HEAD
export async function HEAD(request: NextRequest) {
  const id = (request.nextUrl.searchParams.get('id') || '').trim();
  if (id) {
    try {
      await recordOpen(id);
    } catch {
      /* ignore */
    }
  }
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store',
    },
  });
}
