'use client';

import type { GeneratedAd } from '@/lib/types';

type Props = { ads: GeneratedAd[] };

export default function GeneratedAdsList({ ads }: Props) {
  if (!ads || ads.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ads.map((ad, idx) => (
        <article
          key={idx}
          className="rounded-xl border border-[var(--color-coral-300)]/60 bg-[var(--color-cream-100)]/40 p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-coral-500)]">
              Variation #{idx + 1}
            </span>
            <span className="rounded-full bg-[var(--color-coral-400)] px-2 py-0.5 text-xs font-medium text-white">
              {ad.score}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-[var(--color-ink-900)]">
            {ad.title}
          </h3>
          <p className="mt-1 text-xs text-[var(--color-ink-700)]">{ad.body}</p>
        </article>
      ))}
    </div>
  );
}
