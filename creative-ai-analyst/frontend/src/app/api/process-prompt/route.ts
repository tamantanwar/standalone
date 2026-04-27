import { NextResponse } from 'next/server';

import { processPrompt } from '@/lib/backend-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Payload = {
  prompt?: string;
  imageUrls?: string[];
  videoUrls?: string[];
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

  if (!payload.prompt || payload.prompt.trim().length < 3) {
    return NextResponse.json(
      { error: 'prompt is required (min 3 characters)' },
      { status: 400 },
    );
  }

  try {
    const data = await processPrompt({
      prompt: payload.prompt,
      imageUrls: payload.imageUrls,
      videoUrls: payload.videoUrls,
      accountName: payload.accountName,
      adId: payload.adId,
    });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
