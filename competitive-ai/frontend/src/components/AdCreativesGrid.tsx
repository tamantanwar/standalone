'use client';

import { useState } from 'react';

import type {
  AdCreativesResponse,
  FacebookAdCreative,
  GoogleAdCreative,
} from '@/lib/types';
import FacebookAdPreviewModal from '@/components/FacebookAdPreviewModal';

type Props = { data: AdCreativesResponse };

export default function AdCreativesGrid({ data }: Props) {
  const { adCreatives, adSource } = data;
  const [previewAd, setPreviewAd] = useState<FacebookAdCreative | null>(null);

  if (!adCreatives || adCreatives.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-cream-200)] bg-[var(--color-cream-50)] p-4 text-sm text-[var(--color-ink-700)]">
        No ad creatives found for this competitor.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-ink-900)]">
          {adSource === 'Google' ? 'Google Ad Creatives' : 'Facebook Ad Creatives'}
        </h2>
        <span className="rounded-full bg-[var(--color-coral-300)]/40 px-2 py-0.5 text-xs font-medium text-[var(--color-coral-500)]">
          {adCreatives.length} Ads Found
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {adSource === 'Google'
          ? (adCreatives as GoogleAdCreative[]).map((ad, idx) => (
              <GoogleAdCard key={ad.ad_creative_id ?? idx} ad={ad} />
            ))
          : (adCreatives as FacebookAdCreative[]).map((ad, idx) => (
              <FacebookAdCard
                key={ad.id ?? idx}
                ad={ad}
                onPreview={() => setPreviewAd(ad)}
              />
            ))}
      </div>

      {previewAd && (
        <FacebookAdPreviewModal
          ad={previewAd}
          onClose={() => setPreviewAd(null)}
        />
      )}
    </div>
  );
}

function GoogleAdCard({ ad }: { ad: GoogleAdCreative }) {
  const firstShown =
    ad.first_shown != null ? new Date(ad.first_shown * 1000) : null;
  const lastShown =
    ad.last_shown != null ? new Date(ad.last_shown * 1000) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-cream-200)] bg-white transition hover:-translate-y-0.5 hover:shadow-md">
      {ad.image && (
        <div className="relative border-b border-[var(--color-cream-200)] bg-[var(--color-cream-50)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ad.image}
            alt="Google ad creative"
            className="max-h-80 w-full object-contain"
          />
          <span className="absolute left-2 top-2 rounded bg-black/80 px-2 py-0.5 text-xs font-medium text-white">
            Google Ad
          </span>
        </div>
      )}

      <div className="space-y-2 p-4 text-sm">
        <div>
          <p className="font-semibold text-[var(--color-ink-900)]">
            {ad.advertiser ?? '—'}
          </p>
          <p className="text-xs text-[var(--color-ink-500)]">
            {ad.target_domain ?? ''}
          </p>
        </div>

        <div className="rounded-md border border-[var(--color-cream-200)] bg-[var(--color-cream-50)] p-3 text-xs text-[var(--color-ink-700)]">
          <div className="flex justify-between">
            <span>Format: {(ad.format ?? '').toUpperCase()}</span>
            {ad.total_days_shown != null && (
              <span>{ad.total_days_shown} days shown</span>
            )}
          </div>
          <div className="mt-1 flex justify-between">
            {firstShown && <span>First: {firstShown.toLocaleDateString()}</span>}
            {lastShown && <span>Last: {lastShown.toLocaleDateString()}</span>}
          </div>
          {ad.width && ad.height && (
            <div className="mt-1 text-center">
              Size: {ad.width}×{ad.height}px
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          {ad.details_link && (
            <a
              href={ad.details_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-full border border-[var(--color-coral-400)] px-3 py-1 text-center text-xs font-medium text-[var(--color-coral-500)] hover:bg-[var(--color-cream-100)]"
            >
              Details
            </a>
          )}
          {ad.format === 'video' && ad.link && (
            <a
              href={ad.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-full bg-[var(--color-coral-400)] px-3 py-1 text-center text-xs font-medium text-white hover:bg-[var(--color-coral-500)]"
            >
              Watch
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function FacebookAdCard({
  ad,
  onPreview,
}: {
  ad: FacebookAdCreative;
  onPreview: () => void;
}) {
  const start = ad.ad_delivery_start_time
    ? new Date(ad.ad_delivery_start_time)
    : null;
  const stop = ad.ad_delivery_stop_time
    ? new Date(ad.ad_delivery_stop_time)
    : null;

  const fbLibraryUrl = `https://www.facebook.com/ads/library/?id=${ad.id}`;

  return (
    <button
      type="button"
      onClick={onPreview}
      className="overflow-hidden rounded-xl border border-[var(--color-cream-200)] bg-white text-left transition hover:-translate-y-0.5 hover:shadow-md"
      aria-label="Open ad preview"
    >
      <div className="space-y-3 p-4 text-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[var(--color-ink-500)]">Page</p>
            <p className="font-semibold text-[var(--color-ink-900)]">
              {ad.page_name ?? ad.page_id ?? '—'}
            </p>
            <p className="text-xs text-[var(--color-ink-500)]">
              ID: {ad.page_id}
            </p>
          </div>
          <span className="rounded bg-[var(--color-accent-blue)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-accent-blue)]">
            Facebook
          </span>
        </div>

        {ad.ad_creative_link_titles && ad.ad_creative_link_titles.length > 0 && (
          <p className="font-medium text-[var(--color-ink-700)]">
            {ad.ad_creative_link_titles[0]}
          </p>
        )}

        {ad.ad_creative_bodies && ad.ad_creative_bodies.length > 0 && (
          <p className="text-xs text-[var(--color-ink-700)] line-clamp-4">
            {ad.ad_creative_bodies[0]}
          </p>
        )}

        <div className="rounded-md border border-[var(--color-cream-200)] bg-[var(--color-cream-50)] p-3 text-xs text-[var(--color-ink-700)]">
          {start && <p>Start: {start.toLocaleDateString()}</p>}
          {stop && <p>End: {stop.toLocaleDateString()}</p>}
        </div>

        <p className="text-xs text-[var(--color-ink-500)]">Ad ID: {ad.id}</p>

        <div className="flex gap-2">
          <span className="flex-1 rounded-full bg-[var(--color-coral-400)] px-3 py-2 text-center text-xs font-medium text-white">
            Preview
          </span>
          <a
            href={fbLibraryUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded-full border border-[var(--color-cream-200)] px-3 py-2 text-center text-xs font-medium text-[var(--color-ink-900)] hover:bg-[var(--color-cream-100)]"
          >
            Open in Library ↗
          </a>
        </div>
      </div>
    </button>
  );
}
