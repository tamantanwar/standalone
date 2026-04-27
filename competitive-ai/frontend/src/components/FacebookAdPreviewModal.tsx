'use client';

import type { FacebookAdCreative, MetaRange } from '@/lib/types';

type Props = {
  ad: FacebookAdCreative;
  onClose: () => void;
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  audience_network: 'Audience Network',
  messenger: 'Messenger',
  threads: 'Threads',
};

function formatRange(range: MetaRange | undefined, currency?: string): string {
  if (!range || (!range.lower_bound && !range.upper_bound)) return '—';
  const fmt = (v?: string) => {
    if (!v) return '?';
    const n = Number(v);
    if (!Number.isFinite(n)) return v;
    if (currency) {
      return n.toLocaleString(undefined, {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      });
    }
    return n.toLocaleString();
  };
  if (range.lower_bound && range.upper_bound) {
    return `${fmt(range.lower_bound)} – ${fmt(range.upper_bound)}`;
  }
  return fmt(range.lower_bound ?? range.upper_bound);
}

export default function FacebookAdPreviewModal({ ad, onClose }: Props) {
  const start = ad.ad_delivery_start_time
    ? new Date(ad.ad_delivery_start_time)
    : null;
  const stop = ad.ad_delivery_stop_time
    ? new Date(ad.ad_delivery_stop_time)
    : null;

  const adLibraryUrl = `https://www.facebook.com/ads/library/?id=${ad.id}`;
  const snapshotUrl = ad.ad_snapshot_url;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[var(--color-cream-50)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--color-cream-200)] bg-white px-5 py-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-[var(--color-accent-blue)]">
              Facebook Ad Library
            </p>
            <h2 className="truncate text-base font-semibold text-[var(--color-ink-900)]">
              {ad.page_name ?? `Page ${ad.page_id ?? '—'}`}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={adLibraryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[var(--color-accent-blue)] px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
            >
              Open in Ad Library ↗
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[var(--color-ink-500)] hover:bg-[var(--color-cream-100)] hover:text-[var(--color-ink-900)]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {/* Title & body */}
          {(ad.ad_creative_link_titles?.length ||
            ad.ad_creative_bodies?.length) && (
            <section className="rounded-xl border border-[var(--color-cream-200)] bg-white p-4">
              {ad.ad_creative_link_titles?.[0] && (
                <h3 className="text-base font-semibold text-[var(--color-ink-900)]">
                  {ad.ad_creative_link_titles[0]}
                </h3>
              )}
              {ad.ad_creative_link_descriptions?.[0] && (
                <p className="mt-1 text-sm text-[var(--color-ink-700)]">
                  {ad.ad_creative_link_descriptions[0]}
                </p>
              )}
              {ad.ad_creative_bodies?.[0] && (
                <p className="mt-3 whitespace-pre-line text-sm text-[var(--color-ink-700)]">
                  {ad.ad_creative_bodies[0]}
                </p>
              )}
              {ad.ad_creative_link_captions?.[0] && (
                <p className="mt-3 text-xs text-[var(--color-ink-500)]">
                  {ad.ad_creative_link_captions[0]}
                </p>
              )}
            </section>
          )}

          {/* Stats grid */}
          <section className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <Stat label="Ad ID" value={ad.id} mono />
            <Stat label="Page ID" value={ad.page_id ?? '—'} mono />
            <Stat
              label="Started"
              value={start ? start.toLocaleDateString() : '—'}
            />
            <Stat
              label="Ended"
              value={stop ? stop.toLocaleDateString() : '—'}
            />
            <Stat
              label="Platforms"
              value={
                ad.publisher_platforms
                  ?.map((p) => PLATFORM_LABELS[p.toLowerCase()] ?? p)
                  .join(', ') ?? '—'
              }
            />
            <Stat
              label="Languages"
              value={ad.languages?.join(', ') ?? '—'}
            />
            <Stat
              label="Impressions"
              value={formatRange(ad.impressions)}
            />
            <Stat
              label="Spend"
              value={formatRange(ad.spend, ad.currency)}
            />
            <Stat
              label="Audience size"
              value={formatRange(ad.estimated_audience_size)}
            />
            {ad.bylines && <Stat label="Bylines" value={ad.bylines} />}
          </section>

          {/* Snapshot link (Meta blocks iframe embedding via X-Frame-Options,
              so render as a prominent link instead). */}
          {snapshotUrl && (
            <section className="rounded-xl border border-[var(--color-cream-200)] bg-white p-4 text-sm">
              <p className="text-[var(--color-ink-700)]">
                Meta provides a hosted preview of this ad — but{' '}
                <code className="rounded bg-[var(--color-cream-100)] px-1.5 py-0.5 text-xs">
                  X-Frame-Options
                </code>{' '}
                prevents embedding it inline.
              </p>
              <a
                href={snapshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block rounded-full border border-[var(--color-coral-400)] px-3 py-1 text-xs font-semibold text-[var(--color-coral-500)] hover:bg-[var(--color-cream-100)]"
              >
                Open Meta snapshot ↗
              </a>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-cream-200)] bg-white p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-ink-500)]">
        {label}
      </p>
      <p
        className={`mt-1 break-words text-[var(--color-ink-900)] ${mono ? 'font-mono text-[11px]' : 'text-xs'}`}
      >
        {value}
      </p>
    </div>
  );
}
