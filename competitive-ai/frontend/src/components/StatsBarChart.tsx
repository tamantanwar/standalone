'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { PlotParams } from 'react-plotly.js';

import type { DomainStat } from '@/lib/types';

const Plot = dynamic<PlotParams>(() => import('react-plotly.js'), {
  ssr: false,
}) as unknown as ComponentType<PlotParams>;

const Y_KEYS = {
  monthlyBudget: 'Monthly Budget',
  strength: 'Strength',
  totalAdsPurchased: 'Total Ads Purchased',
  averageAdRank: 'Average Ad Rank',
} as const;

type YKey = keyof typeof Y_KEYS;

const PALETTE = [
  '#d9a48f',
  '#1a1a1a',
  '#1e6fff',
  '#c98a72',
  '#6b6b6b',
  '#e63946',
  '#3d3d3d',
  '#ecdfd0',
];

const CURRENCY_KEYS = new Set<YKey>(['monthlyBudget']);

type Props = { rows: DomainStat[] };

export default function StatsBarChart({ rows }: Props) {
  const [yKey, setYKey] = useState<YKey>('monthlyBudget');

  const traces = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    const domains = Array.from(new Set(rows.map((r) => r.domain)));
    const months = Array.from(new Set(rows.map((r) => String(r.searchMonth))));

    return months.map((month, i) => ({
      x: domains,
      y: domains.map((d) => {
        const found = rows.find(
          (r) => r.domain === d && String(r.searchMonth) === month,
        );
        const val = found?.[yKey];
        return typeof val === 'number' ? val : 0;
      }),
      type: 'bar' as const,
      name: `Month ${month}`,
      marker: { color: PALETTE[i % PALETTE.length] },
    }));
  }, [rows, yKey]);

  if (!rows || rows.length === 0) return null;

  const tickformat = CURRENCY_KEYS.has(yKey) ? '$,.0f' : undefined;

  return (
    <div className="rounded-xl border border-[var(--color-cream-200)] bg-white p-4">
      <div className="mb-3 flex items-center gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-ink-900)]">
          Domain Stats
        </h3>
        <select
          value={yKey}
          onChange={(e) => setYKey(e.target.value as YKey)}
          className="rounded-md border border-[var(--color-cream-200)] bg-[var(--color-cream-50)] px-2 py-1 text-xs text-[var(--color-ink-700)] focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]/30"
        >
          {Object.entries(Y_KEYS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <Plot
        data={traces}
        layout={{
          barmode: 'group',
          autosize: true,
          margin: { t: 10, l: 70, r: 20, b: 80 },
          xaxis: {
            title: { text: 'Domain' },
            tickangle: -30,
            automargin: true,
          },
          yaxis: {
            title: { text: Y_KEYS[yKey] },
            tickformat,
            rangemode: 'tozero',
            automargin: true,
          },
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          font: { family: 'inherit', color: '#1a1a1a' },
          legend: { orientation: 'v', x: 1.02, y: 1, xanchor: 'left' },
        }}
        useResizeHandler
        style={{ width: '100%', height: 380 }}
        config={{ displaylogo: false, responsive: true }}
      />
    </div>
  );
}
