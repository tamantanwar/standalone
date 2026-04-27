import { NextResponse } from 'next/server';

import { compareCreatives } from '@/lib/backend-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

type ComparePayload = {
  imageUrls?: string[];
  prompt?: string;
};

export async function POST(req: Request) {
  let payload: ComparePayload;
  try {
    payload = (await req.json()) as ComparePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const imageUrls = payload.imageUrls ?? [];
  if (imageUrls.length !== 2) {
    return NextResponse.json(
      { error: 'imageUrls must contain exactly 2 URLs' },
      { status: 400 },
    );
  }

  try {
    const data = await compareCreatives({
      imageUrls,
      prompt: payload.prompt,
    });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
