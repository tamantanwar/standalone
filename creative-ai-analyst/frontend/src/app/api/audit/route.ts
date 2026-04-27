import { NextResponse } from 'next/server';

import { auditCreatives } from '@/lib/backend-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// gpt-5.4 vision + Gemini video upload can be slow; allow up to 5 min.
export const maxDuration = 300;

type AuditPayload = {
  imageUrls?: string[];
  videoUrls?: string[];
  prompt?: string;
  adIds?: string[];
};

export async function POST(req: Request) {
  let payload: AuditPayload;
  try {
    payload = (await req.json()) as AuditPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const imageUrls = payload.imageUrls ?? [];
  const videoUrls = payload.videoUrls ?? [];
  if (imageUrls.length === 0 && videoUrls.length === 0) {
    return NextResponse.json(
      { error: 'imageUrls or videoUrls must be a non-empty array' },
      { status: 400 },
    );
  }

  try {
    const data = await auditCreatives({
      imageUrls,
      videoUrls,
      prompt: payload.prompt,
      adIds: payload.adIds,
    });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
