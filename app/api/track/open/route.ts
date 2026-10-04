import { NextRequest, NextResponse } from 'next/server';
import { recordOpen } from '../../../../lib/store';
import { TRANSPARENT_GIF } from '../../../../lib/tracking';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || '';

  if (id) {
    try {
      await recordOpen(id);
    } catch (e) {
      console.error('recordOpen', e);
    }
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(TRANSPARENT_GIF.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
