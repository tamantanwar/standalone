import { NextResponse } from 'next/server';

import { generateAiAds } from '@/lib/backend-client';
import type { Ad } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: Request) {
  let payload: {
    ads?: Ad[];
    objective?: string;
    location?: string;
    promotion?: string;
  };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!payload.ads || !Array.isArray(payload.ads) || !payload.objective) {
    return NextResponse.json(
      { error: 'ads array and objective are required' },
      { status: 400 },
    );
  }

  try {
    const data = await generateAiAds({
      ads: payload.ads,
      objective: payload.objective,
      location: payload.location,
      promotion: payload.promotion,
    });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
