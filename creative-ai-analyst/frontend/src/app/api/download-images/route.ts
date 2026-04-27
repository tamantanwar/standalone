import { downloadImagesZip } from '@/lib/backend-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Payload = {
  imageUrls?: string[];
};

export async function POST(req: Request) {
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!payload.imageUrls || payload.imageUrls.length === 0) {
    return new Response(
      JSON.stringify({ error: 'imageUrls must be a non-empty array' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const buf = await downloadImagesZip(payload.imageUrls);
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="ad_preview_images.zip"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
