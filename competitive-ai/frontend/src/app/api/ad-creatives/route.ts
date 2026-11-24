import { NextResponse } from 'next/server';

import { getAdCreatives } from '@/lib/backend-client';
import type { AdSource, AdStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  const adSource = searchParams.get('adSource');
  const countryCode = searchParams.get('countryCode') ?? undefined;
  const adStatus = searchParams.get('adStatus') ?? 'ALL';

  if (!domain || !adSource) {
    return NextResponse.json(
      { error: 'domain and adSource are required' },
      { status: 400 },
    );
  }

  if (adSource !== 'Google' && adSource !== 'Facebook' && adSource !== 'LinkedIn') {
    return NextResponse.json(
      { error: 'adSource must be Google, Facebook or LinkedIn' },
      { status: 400 },
    );
  }

  if (adStatus !== 'ACTIVE' && adStatus !== 'ALL') {
    return NextResponse.json(
      { error: 'adStatus must be ACTIVE or ALL' },
      { status: 400 },
    );
  }

  if (adSource === 'Facebook' && !countryCode) {
    return NextResponse.json(
      { error: 'countryCode is required for Facebook ads' },
      { status: 400 },
    );
  }

  try {
    const data = await getAdCreatives({
      domain,
      adSource: adSource as AdSource,
      countryCode,
      adStatus: adStatus as AdStatus,
    });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
