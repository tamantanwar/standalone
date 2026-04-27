import type { Ad } from './types';

/**
 * Coerce common image-URL shapes to a browser-fetchable HTTPS URL.
 * Mirrors the backend `_normalize_image_url` helper.
 *
 * Returns null for empty / unsupported inputs so callers can decide whether
 * to render a placeholder.
 */
export function normalizeImageUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const stripped = url.trim();
  if (!stripped) return null;
  if (stripped.startsWith('https://') || stripped.startsWith('http://')) {
    return stripped;
  }
  if (stripped.startsWith('//')) return `https:${stripped}`;
  if (stripped.startsWith('gs://')) {
    return `https://storage.googleapis.com/${stripped.slice('gs://'.length)}`;
  }
  if (stripped.startsWith('kedet-ad-images/')) {
    return `https://storage.googleapis.com/${stripped}`;
  }
  return null;
}

/**
 * Pick the best image URL for an ad: prefer the stored GCS copy, then any
 * legacy display URL, then the original (often-expired) Facebook CDN URL.
 * Returns null when no displayable URL is available.
 */
export function bestAdImageUrl(ad: Ad): string | null {
  return (
    normalizeImageUrl(ad.stored_image_url) ??
    normalizeImageUrl(ad.display_image_url) ??
    normalizeImageUrl(ad.image_url) ??
    null
  );
}
