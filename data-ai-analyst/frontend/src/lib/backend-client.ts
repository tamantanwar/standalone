import type { AskRequest, AskResponse } from '@/lib/types';

/**
 * Backend client. Runs server-side only (Next.js server components / route handlers).
 *
 * - In local dev: BACKEND_URL points at http://localhost:8000, no auth headers.
 * - In Cloud Run: BACKEND_URL points at the backend service URL. We mint an
 *   OIDC ID token from the metadata server (audience = backend URL) and pass
 *   it as `Authorization: Bearer <token>`. Cloud Run validates the token at
 *   the infrastructure layer before the request reaches the backend.
 */

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

export async function askBackend(payload: AskRequest): Promise<AskResponse> {
  const headers = await getServiceToServiceAuthHeaders(BACKEND_URL);

  const res = await fetch(`${BACKEND_URL}/ai/ask`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string; error?: string };
      detail = body.detail || body.error || detail;
    } catch {
      // ignore body-parse failures
    }
    throw new Error(detail);
  }

  return (await res.json()) as AskResponse;
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
