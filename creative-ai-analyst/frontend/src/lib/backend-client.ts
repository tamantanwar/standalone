import type {
  Ad,
  AdPreviewsResponse,
  AdsResponse,
  GenerateAiAdsResponse,
} from '@/lib/types';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000';

type HealthOk = { ok: true; version: string; environment: string };
type HealthErr = { ok: false; error: string };

export async function getBackendHealth(): Promise<HealthOk | HealthErr> {
  try {
    const headers = await getServiceToServiceAuthHeaders(BACKEND_URL);
    const res = await fetch(`${BACKEND_URL}/health`, {
      cache: 'no-store',
      headers,
    });

    if (!res.ok) return { ok: false, error: `HTTP ${res.status} from backend` };

    const body = (await res.json()) as {
      status: string;
      version: string;
      environment: string;
    };
    return { ok: true, version: body.version, environment: body.environment };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, error: message };
  }
}

export async function getCreativeAccounts(): Promise<string[]> {
  return await proxyGet<string[]>('/creative-ai/accounts');
}

export async function getCampaignObjectives(
  accountName: string,
): Promise<string[]> {
  return await proxyGet<string[]>('/creative-ai/campaign-objectives', {
    accountName,
  });
}

export async function getAds(params: {
  accountName: string;
  objective: string;
  rankingMetric?: string;
  rankingType?: string;
  adsWithTitle?: boolean;
  location?: string;
  promotion?: string;
}): Promise<AdsResponse> {
  return await proxyGet<AdsResponse>('/creative-ai/ads', {
    accountName: params.accountName,
    objective: params.objective,
    ...(params.rankingMetric ? { rankingMetric: params.rankingMetric } : {}),
    ...(params.rankingType ? { rankingType: params.rankingType } : {}),
    ...(params.adsWithTitle ? { adsWithTitle: 'true' } : {}),
    ...(params.location ? { location: params.location } : {}),
    ...(params.promotion ? { promotion: params.promotion } : {}),
  });
}

export async function getAdPreviews(
  ads: { ad_id: string }[],
): Promise<AdPreviewsResponse> {
  return await proxyPost<AdPreviewsResponse>('/creative-ai/ad-preview', { ads });
}

export async function generateAiAds(payload: {
  ads: Ad[];
  objective: string;
  location?: string;
  promotion?: string;
}): Promise<GenerateAiAdsResponse> {
  return await proxyPost<GenerateAiAdsResponse>(
    '/creative-ai/generate-ai-ads',
    payload,
  );
}

// ---------- internals ----------

async function proxyGet<T>(
  path: string,
  query: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${BACKEND_URL}${path}`);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.set(k, v);
  }
  const headers = await getServiceToServiceAuthHeaders(BACKEND_URL);

  const res = await fetch(url, { cache: 'no-store', headers });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as T;
}

async function proxyPost<T>(path: string, body: unknown): Promise<T> {
  const headers = await getServiceToServiceAuthHeaders(BACKEND_URL);
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  return (await res.json()) as T;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string; error?: string };
    return body.detail || body.error || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function getServiceToServiceAuthHeaders(
  audience: string,
): Promise<HeadersInit> {
  if (process.env.NODE_ENV !== 'production') return {};

  const metadataUrl =
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity' +
    `?audience=${encodeURIComponent(audience)}`;
  const res = await fetch(metadataUrl, {
    headers: { 'Metadata-Flavor': 'Google' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(
      `Metadata server returned HTTP ${res.status} when minting OIDC token`,
    );
  }
  const idToken = await res.text();
  return { Authorization: `Bearer ${idToken}` };
}
