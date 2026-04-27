import { NextResponse } from 'next/server';

import { askBackend } from '@/lib/backend-client';
import type { AskRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// OpenAI calls + BigQuery can take 20-30s. Cloud Run default timeout is 5min.
export const maxDuration = 120;

export async function POST(req: Request) {
  let payload: AskRequest;
  try {
    payload = (await req.json()) as AskRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!payload.userQuestion || typeof payload.userQuestion !== 'string') {
    return NextResponse.json(
      { error: 'userQuestion is required' },
      { status: 400 },
    );
  }

  try {
    const data = await askBackend(payload);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
