import { NextResponse } from 'next/server';

import { getAdPreviews } from '@/lib/backend-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  let payload: { ads?: { ad_id: string }[] };
  try {
    payload = (await req.json()) as { ads?: { ad_id: string }[] };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!payload.ads || !Array.isArray(payload.ads) || payload.ads.length === 0) {
    return NextResponse.json(
      { error: 'ads must be a non-empty array' },
      { status: 400 },
    );
  }

  try {
    const data = await getAdPreviews(payload.ads);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
