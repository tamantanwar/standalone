'use client';

import type { Ad } from '@/lib/types';

type Props = {
  ads: Ad[];
  objective: string;
  selected: Set<string>;
  onToggle: (adId: string) => void;
};

function formatNumber(v: unknown): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—';
  return Number.isInteger(v)
    ? v.toLocaleString()
    : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AdsList({ ads, objective, selected, onToggle }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {ads.map((ad, idx) => (
        <AdCard
          key={ad.ad_id ?? idx}
          ad={ad}
          objective={objective}
          isSelected={ad.ad_id ? selected.has(ad.ad_id) : false}
          onToggle={() => ad.ad_id && onToggle(ad.ad_id)}
        />
      ))}
    </div>
  );
}

function AdCard({
  ad,
  objective,
  isSelected,
  onToggle,
}: {
  ad: Ad;
  objective: string;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const ringClass = isSelected
    ? 'ring-2 ring-[var(--color-coral-400)]'
    : 'hover:-translate-y-0.5 hover:shadow-md';

  return (
    <article
      className={`relative overflow-hidden rounded-xl border border-[var(--color-cream-200)] bg-white transition ${ringClass}`}
    >
      {ad.ad_id && (
        <label className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full border border-[var(--color-cream-200)] bg-white/95 px-2.5 py-1 text-xs shadow-sm backdrop-blur">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            className="accent-[var(--color-coral-400)]"
          />
          <span className="text-[var(--color-ink-700)]">Select</span>
        </label>
      )}

      <div className="space-y-3 p-4 pr-24 text-sm">
        {ad.title && (
          <h3 className="font-semibold text-[var(--color-ink-900)]">
            {ad.title}
          </h3>
        )}
        {ad.body && (
          <p className="text-xs text-[var(--color-ink-700)]">{ad.body}</p>
        )}

        <dl className="grid grid-cols-2 gap-2 text-xs text-[var(--color-ink-700)]">
          {objective === 'LINK_CLICKS' && (
            <>
              <div>
                <dt className="text-[var(--color-ink-500)]">CTR</dt>
                <dd>{formatNumber(ad.CTR)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">CPC</dt>
                <dd>{formatNumber(ad.CPC)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">Clicks</dt>
                <dd>{formatNumber(ad.Clicks)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">Impressions</dt>
                <dd>{formatNumber(ad.impressions)}</dd>
              </div>
            </>
          )}

          {(objective === 'OUTCOME_SALES' ||
            objective === 'OUTCOME_CONVERSIONS') && (
            <>
              <div>
                <dt className="text-[var(--color-ink-500)]">ROAS</dt>
                <dd>{formatNumber(ad.ROAS)}%</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">CPA</dt>
                <dd>{formatNumber(ad.CPA)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">Revenue</dt>
                <dd>{formatNumber(ad.total_revenue)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">Spend</dt>
                <dd>{formatNumber(ad.spend)}</dd>
              </div>
            </>
          )}

          {objective === 'OUTCOME_TRAFFIC' && (
            <>
              <div>
                <dt className="text-[var(--color-ink-500)]">Impressions</dt>
                <dd>{formatNumber(ad.Impressions ?? ad.impressions)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">Clicks</dt>
                <dd>{formatNumber(ad.Clicks ?? ad.clicks)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">CTR</dt>
                <dd>{formatNumber(ad.CTR)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">Spend</dt>
                <dd>{formatNumber(ad.spend)}</dd>
              </div>
            </>
          )}

          {objective === 'OUTCOME_LEADS' && (
            <>
              <div>
                <dt className="text-[var(--color-ink-500)]">Conversions</dt>
                <dd>{formatNumber(ad.Conversions ?? ad.action_purchase)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">CPA</dt>
                <dd>{formatNumber(ad.CPA)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">Spend</dt>
                <dd>{formatNumber(ad.spend)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">Impressions</dt>
                <dd>{formatNumber(ad.impressions)}</dd>
              </div>
            </>
          )}

          {objective === 'OUTCOME_AWARENESS' && (
            <>
              <div>
                <dt className="text-[var(--color-ink-500)]">Impressions</dt>
                <dd>{formatNumber(ad.Impressions ?? ad.impressions)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">Video Views</dt>
                <dd>{formatNumber(ad.video_views)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">Spend</dt>
                <dd>{formatNumber(ad.spend)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-500)]">Reach</dt>
                <dd>{formatNumber(ad.reach)}</dd>
              </div>
            </>
          )}
        </dl>

        {(ad.location || ad.promotion || ad.audience) && (
          <div className="flex flex-wrap gap-1 pt-1">
            {ad.location && (
              <span className="rounded-full bg-[var(--color-cream-100)] px-2 py-0.5 text-[10px] text-[var(--color-ink-700)]">
                {ad.location}
              </span>
            )}
            {ad.promotion && (
              <span className="rounded-full bg-[var(--color-coral-300)]/40 px-2 py-0.5 text-[10px] text-[var(--color-coral-500)]">
                {ad.promotion}
              </span>
            )}
            {ad.audience && (
              <span className="rounded-full bg-[var(--color-accent-blue)]/10 px-2 py-0.5 text-[10px] text-[var(--color-accent-blue)]">
                {ad.audience}
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
