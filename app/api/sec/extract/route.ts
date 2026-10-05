import { NextResponse } from 'next/server';

/** SEC extract removed from AWS BLASTER. */
export async function GET() {
  return NextResponse.json(
    {
      error: 'SEC extract has been removed',
      alternative: 'Use /leads (sent inbox contacts) and /extractor (paste emails)',
    },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'SEC extract has been removed',
      alternative: 'Use /leads (sent inbox contacts) and /extractor (paste emails)',
    },
    { status: 410 }
  );
}
