import { NextResponse } from 'next/server';

import { generateVariant } from '@/lib/backend-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// gpt-image-2 takes 30–90s per image; cap at 5min for batches.
export const maxDuration = 300;

type Payload = {
  imageUrls?: string[];
  prompt?: string;
  accountName?: string;
  adId?: string;
};

export async function POST(req: Request) {
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!payload.imageUrls || payload.imageUrls.length === 0) {
    return NextResponse.json(
      { error: 'imageUrls must be a non-empty array' },
      { status: 400 },
    );
  }
  if (!payload.accountName) {
    return NextResponse.json(
      { error: 'accountName is required' },
      { status: 400 },
    );
  }

  try {
    const data = await generateVariant({
      imageUrls: payload.imageUrls,
      prompt: payload.prompt,
      accountName: payload.accountName,
      adId: payload.adId,
    });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
