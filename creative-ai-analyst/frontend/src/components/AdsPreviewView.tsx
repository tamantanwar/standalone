'use client';

import { memo, useEffect, useRef, useState } from 'react';

import type { Ad, AdPreview, AdPreviewsResponse } from '@/lib/types';

type Props = {
  ads: Ad[];
  previews: AdPreviewsResponse;
  selected: Set<string>;
  onToggle: (adId: string) => void;
};

const FORMAT_LABELS: Record<string, string> = {
  MOBILE_FEED_STANDARD: 'Mobile Feed',
  MARKETPLACE_MOBILE: 'Marketplace',
  RIGHT_COLUMN_STANDARD: 'Right Column',
  FACEBOOK_STORY_MOBILE: 'Story',
  INSTANT_ARTICLE_STANDARD: 'Instant Article',
};

// Render the Meta-returned HTML imperatively once per unique body so
// React never re-touches the DOM. This prevents the embedded iframe from
// reloading every time the parent re-renders (which used to make the
// previews appear to "refresh every 2–3 seconds").
const InnerPreview = memo(
  function InnerPreview({ html }: { html: string }) {
    const ref = useRef<HTMLDivElement | null>(null);
    const lastHtmlRef = useRef<string | null>(null);

    useEffect(() => {
      if (!ref.current) return;
      if (lastHtmlRef.current === html) return;
      ref.current.innerHTML = html;
      lastHtmlRef.current = html;
    }, [html]);

    return (
      <div
        ref={ref}
        className="h-[480px] overflow-y-auto bg-white p-3"
      />
    );
  },
  (prev, next) => prev.html === next.html,
);

function PreviewSlide({ preview }: { preview: AdPreview }) {
  if (preview.error) {
    return (
      <div className="flex h-[480px] items-center justify-center bg-[var(--color-cream-50)] p-4">
        <p className="text-xs text-red-700">{preview.error}</p>
      </div>
    );
  }
  if (!preview.preview?.body) {
    return (
      <div className="flex h-[480px] items-center justify-center bg-[var(--color-cream-50)] p-4">
        <p className="text-xs text-[var(--color-ink-500)]">No preview body</p>
      </div>
    );
  }
  return <InnerPreview html={preview.preview.body} />;
}

type CardProps = {
  adId: string;
  ad: Ad | undefined;
  previews: AdPreview[];
  isSelected: boolean;
  onToggle: (id: string) => void;
};

const AdPreviewCard = memo(function AdPreviewCard({
  adId,
  ad,
  previews,
  isSelected,
  onToggle,
}: CardProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const handleToggle = () => onToggle(adId);
  const safeIdx = Math.min(activeIdx, Math.max(previews.length - 1, 0));
  const active = previews[safeIdx];

  const ringClass = isSelected
    ? 'ring-2 ring-[var(--color-coral-400)]'
    : 'hover:shadow-md';

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--color-cream-200)] bg-white shadow-sm transition ${ringClass}`}
    >
      <header className="flex items-start justify-between gap-2 border-b border-[var(--color-cream-200)] bg-[var(--color-cream-50)] px-4 py-2.5">
        <div className="min-w-0 text-xs">
          <p className="truncate font-semibold text-[var(--color-ink-900)]">
            {ad?.title || ad?.ad_name || `Ad ${adId}`}
          </p>
          <p className="truncate text-[var(--color-ink-500)]">ID: {adId}</p>
        </div>
        <label className="flex shrink-0 items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleToggle}
            className="accent-[var(--color-coral-400)]"
          />
          <span className="text-[var(--color-ink-700)]">Select</span>
        </label>
      </header>

      {previews.length > 0 ? (
        <>
          <PreviewSlide preview={active} />

          <div className="flex items-center justify-between gap-2 border-t border-[var(--color-cream-200)] px-3 py-2 text-xs">
            <button
              type="button"
              onClick={() =>
                setActiveIdx((i) => (i - 1 + previews.length) % previews.length)
              }
              disabled={previews.length <= 1}
              className="rounded-full border border-[var(--color-cream-200)] px-2.5 py-1 text-[var(--color-ink-700)] hover:bg-[var(--color-cream-100)] disabled:opacity-50"
              aria-label="Previous format"
            >
              ←
            </button>
            <span className="text-[var(--color-ink-700)]">
              <span className="font-medium text-[var(--color-ink-900)]">
                {FORMAT_LABELS[active.ad_format] ?? active.ad_format}
              </span>
              <span className="ml-2 text-[var(--color-ink-500)]">
                {safeIdx + 1} / {previews.length}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setActiveIdx((i) => (i + 1) % previews.length)}
              disabled={previews.length <= 1}
              className="rounded-full border border-[var(--color-cream-200)] px-2.5 py-1 text-[var(--color-ink-700)] hover:bg-[var(--color-cream-100)] disabled:opacity-50"
              aria-label="Next format"
            >
              →
            </button>
          </div>
        </>
      ) : (
        <div className="flex h-[480px] items-center justify-center bg-[var(--color-cream-50)] text-sm text-[var(--color-ink-500)]">
          No preview formats returned for this ad.
        </div>
      )}
    </article>
  );
});

export default function AdsPreviewView({
  ads,
  previews,
  selected,
  onToggle,
}: Props) {
  const adById = new Map<string, Ad>();
  for (const ad of ads) {
    if (ad.ad_id) adById.set(ad.ad_id, ad);
  }
  const ids = Object.keys(previews);

  if (ids.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-cream-200)] bg-[var(--color-cream-50)] p-6 text-center text-sm text-[var(--color-ink-500)]">
        No previews available. Toggle off and back on to retry.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {ids.map((id) => (
        <AdPreviewCard
          key={id}
          adId={id}
          ad={adById.get(id)}
          previews={previews[id] ?? []}
          isSelected={selected.has(id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
