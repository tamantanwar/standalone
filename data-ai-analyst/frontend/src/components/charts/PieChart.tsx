'use client';

import type { AskRow } from '@/lib/types';
import {
  CHART_COLORS,
  hoverFormatFor,
  inspectColumns,
  toNumber,
} from '@/lib/chart-selection';
import Plot from './Plot';

type Props = {
  rows: AskRow[];
  xKey: string;
  yKeys: string[];
};

export default function PieChart({ rows, xKey, yKeys }: Props) {
  const yKey = yKeys[0];
  // Drop zero/null slices — they clutter the pie and aren't meaningful.
  const cleaned = rows
    .map((r) => ({ label: String(r[xKey] ?? ''), value: toNumber(r[yKey]) }))
    .filter((p) => p.value != null && p.value > 0);

  const cols = inspectColumns(rows);
  const fmt = hoverFormatFor(
    cols.find((c) => c.name === yKey)?.numericFormat,
  );

  return (
    <div className="rounded-xl border border-[var(--color-cream-200)] bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-900)]">
        Share of {yKey} by {xKey}
      </h3>
      <Plot
        data={[
          {
            labels: cleaned.map((p) => p.label),
            values: cleaned.map((p) => p.value as number),
            type: 'pie',
            hole: 0.4,
            marker: { colors: CHART_COLORS.palette },
            textinfo: 'label+percent',
            hovertemplate: `<b>%{label}</b><br>${yKey}: %{value:${fmt}}<br>%{percent}<extra></extra>`,
          },
        ]}
        layout={{
          autosize: true,
          margin: { t: 10, l: 20, r: 20, b: 20 },
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          font: { family: 'inherit', color: '#1a1a1a' },
          showlegend: true,
        }}
        useResizeHandler
        style={{ width: '100%', height: 340 }}
        config={{ displaylogo: false, responsive: true }}
      />
    </div>
  );
}
