import { NextResponse } from 'next/server';

import { getCompetitors } from '@/lib/backend-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  const countryCode = searchParams.get('countryCode');
  const timePeriodRaw = searchParams.get('timePeriod') ?? '1';

  if (!domain || !countryCode) {
    return NextResponse.json(
      { error: 'domain and countryCode are required' },
      { status: 400 },
    );
  }

  const timePeriod = Number.parseInt(timePeriodRaw, 10);
  if (!Number.isFinite(timePeriod) || timePeriod < 1) {
    return NextResponse.json({ error: 'invalid timePeriod' }, { status: 400 });
  }

  try {
    const data = await getCompetitors({ domain, countryCode, timePeriod });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
