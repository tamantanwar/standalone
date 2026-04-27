'use client';

import type { Ad } from '@/lib/types';

type Props = {
  ads: Ad[];
  objective: string;
};

function formatNumber(v: unknown): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return Number.isInteger(v)
    ? v.toLocaleString()
    : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AdsList({ ads, objective }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {ads.map((ad, idx) => (
        <AdCard key={ad.ad_id ?? idx} ad={ad} objective={objective} />
      ))}
    </div>
  );
}

function AdCard({ ad, objective }: { ad: Ad; objective: string }) {
  return (
    <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md">
      {ad.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={ad.image_url}
          alt={ad.title ?? 'Ad creative'}
          className="max-h-72 w-full object-contain border-b border-zinc-200 bg-zinc-50"
        />
      )}

      <div className="space-y-3 p-4 text-sm">
        {ad.title && (
          <h3 className="font-semibold text-zinc-800">{ad.title}</h3>
        )}
        {ad.body && <p className="text-xs text-zinc-600">{ad.body}</p>}

        <dl className="grid grid-cols-2 gap-2 text-xs text-zinc-600">
          {objective === 'LINK_CLICKS' && (
            <>
              <div>
                <dt className="text-zinc-400">CTR</dt>
                <dd>{formatNumber(ad.CTR)}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">CPC</dt>
                <dd>{formatNumber(ad.CPC)}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Clicks</dt>
                <dd>{formatNumber(ad.Clicks)}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Impressions</dt>
                <dd>{formatNumber(ad.impressions)}</dd>
              </div>
            </>
          )}

          {(objective === 'OUTCOME_SALES' ||
            objective === 'OUTCOME_CONVERSIONS') && (
            <>
              <div>
                <dt className="text-zinc-400">ROAS</dt>
                <dd>{formatNumber(ad.ROAS)}%</dd>
              </div>
              <div>
                <dt className="text-zinc-400">CPA</dt>
                <dd>{formatNumber(ad.CPA)}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Revenue</dt>
                <dd>{formatNumber(ad.total_revenue)}</dd>
              </div>
              <div>
                <dt className="text-zinc-400">Spend</dt>
                <dd>{formatNumber(ad.spend)}</dd>
              </div>
            </>
          )}
        </dl>

        {(ad.location || ad.promotion || ad.audience) && (
          <div className="flex flex-wrap gap-1 pt-1">
            {ad.location && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">
                {ad.location}
              </span>
            )}
            {ad.promotion && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                {ad.promotion}
              </span>
            )}
            {ad.audience && (
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] text-purple-700">
                {ad.audience}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
