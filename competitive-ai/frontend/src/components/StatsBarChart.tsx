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

type Props = { rows: DomainStat[] };

export default function StatsBarChart({ rows }: Props) {
  const [yKey, setYKey] = useState<YKey>('monthlyBudget');

  const traces = useMemo(() => {
    if (!rows || rows.length === 0) return [];

    const domains = Array.from(new Set(rows.map((r) => r.domain)));
    const months = Array.from(new Set(rows.map((r) => String(r.searchMonth))));

    return months.map((month) => ({
      x: domains,
      y: domains.map((d) => {
        const found = rows.find(
          (r) => r.domain === d && String(r.searchMonth) === month,
        );
        const val = found?.[yKey];
        return typeof val === 'number' ? val : 0;
      }),
      type: 'bar' as const,
      name: month,
    }));
  }, [rows, yKey]);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-3">
        <h3 className="text-sm font-semibold text-zinc-700">Domain Stats</h3>
        <select
          value={yKey}
          onChange={(e) => setYKey(e.target.value as YKey)}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
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
          xaxis: { title: { text: 'Domain' } },
          yaxis: { title: { text: Y_KEYS[yKey] } },
          autosize: true,
          margin: { t: 30, l: 60, r: 20, b: 60 },
        }}
        useResizeHandler
        style={{ width: '100%', height: 360 }}
        config={{ displaylogo: false, responsive: true }}
      />
    </div>
  );
}
