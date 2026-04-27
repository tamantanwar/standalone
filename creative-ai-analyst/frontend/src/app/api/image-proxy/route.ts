import { NextResponse } from 'next/server';

import { proxyAdImage } from '@/lib/backend-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Proxy ad-creative images through the backend so the browser doesn't have
// to talk to GCS / fbcdn directly. The backend already knows how to fetch
// these (authenticated GCS download for kedet-ad-images, curl-headers fallback
// for fbcdn) — reuse that path instead of duplicating logic here.
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  try {
    const { bytes, contentType } = await proxyAdImage(url);
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'private, max-age=600',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
