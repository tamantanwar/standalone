import { NextResponse } from 'next/server';

import { getAds } from '@/lib/backend-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountName = searchParams.get('accountName');
  const objective = searchParams.get('objective');

  if (!accountName || !objective) {
    return NextResponse.json(
      { error: 'accountName and objective are required' },
      { status: 400 },
    );
  }

  try {
    const data = await getAds({
      accountName,
      objective,
      rankingMetric: searchParams.get('rankingMetric') ?? undefined,
      rankingType: searchParams.get('rankingType') ?? undefined,
      adsWithTitle: searchParams.get('adsWithTitle') === 'true',
      location: searchParams.get('location') ?? undefined,
      promotion: searchParams.get('promotion') ?? undefined,
    });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
