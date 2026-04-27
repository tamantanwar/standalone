import type {
  AdCreativesResponse,
  AdSource,
  CompetitorsResponse,
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

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} from backend` };
    }

    const body = (await res.json()) as {
      status: string;
      version: string;
      environment: string;
    };

    return {
      ok: true,
      version: body.version,
      environment: body.environment,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, error: message };
  }
}

export async function getCompetitors(params: {
  domain: string;
  countryCode: string;
  timePeriod: number;
}): Promise<CompetitorsResponse> {
  const headers = await getServiceToServiceAuthHeaders(BACKEND_URL);
  const url = new URL(`${BACKEND_URL}/competitive-analysis/competitors`);
  url.searchParams.set('domain', params.domain);
  url.searchParams.set('countryCode', params.countryCode);
  url.searchParams.set('timePeriod', String(params.timePeriod));

  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as CompetitorsResponse;
}

export async function getAdCreatives(params: {
  domain: string;
  adSource: AdSource;
  countryCode?: string;
}): Promise<AdCreativesResponse> {
  const headers = await getServiceToServiceAuthHeaders(BACKEND_URL);
  const url = new URL(`${BACKEND_URL}/competitive-analysis/adCreatives`);
  url.searchParams.set('domain', params.domain);
  url.searchParams.set('adSource', params.adSource);
  if (params.countryCode) {
    url.searchParams.set('countryCode', params.countryCode);
  }

  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  const body = (await res.json()) as AdCreativesResponse;
  return { ...body, adSource: params.adSource } as AdCreativesResponse;
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
  if (process.env.NODE_ENV !== 'production') {
    return {};
  }

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
