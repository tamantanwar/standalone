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
          className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Variation #{idx + 1}
            </span>
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">
              {ad.score}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-semibold text-zinc-800">
            {ad.title}
          </h3>
          <p className="mt-1 text-xs text-zinc-700">{ad.body}</p>
        </article>
      ))}
    </div>
  );
}
