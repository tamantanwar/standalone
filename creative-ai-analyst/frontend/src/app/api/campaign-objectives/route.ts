import { NextResponse } from 'next/server';

import { getCampaignObjectives } from '@/lib/backend-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountName = searchParams.get('accountName');
  if (!accountName) {
    return NextResponse.json(
      { error: 'accountName is required' },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await getCampaignObjectives(accountName));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
