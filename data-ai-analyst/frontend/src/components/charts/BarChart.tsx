'use client';

import type { AskRow } from '@/lib/types';
import {
  CHART_COLORS,
  hoverFormatFor,
  inspectColumns,
  tickFormatFor,
  toNumber,
} from '@/lib/chart-selection';
import Plot from './Plot';

type Props = {
  rows: AskRow[];
  xKey: string;
  yKeys: string[];
  title?: string;
};

export default function BarChart({ rows, xKey, yKeys, title }: Props) {
  const sorted = [...rows].sort((a, b) => {
    const sum = (r: AskRow) =>
      yKeys.reduce((acc, k) => acc + (toNumber(r[k]) ?? 0), 0);
    return sum(b) - sum(a);
  });
  const finalRows = sorted.slice(0, 20);
  const x = finalRows.map((r) => String(r[xKey] ?? ''));

  const cols = inspectColumns(rows);
  const firstFormat = cols.find((c) => c.name === yKeys[0])?.numericFormat;
  const allSameFormat = yKeys.every(
    (k) => cols.find((c) => c.name === k)?.numericFormat === firstFormat,
  );

  const traces = yKeys.map((yKey, i) => {
    const fmt = hoverFormatFor(
      cols.find((c) => c.name === yKey)?.numericFormat,
    );
    return {
      name: yKey,
      x,
      y: finalRows.map((r) => toNumber(r[yKey])),
      type: 'bar' as const,
      marker: {
        color: CHART_COLORS.palette[i % CHART_COLORS.palette.length],
      },
      hovertemplate: `<b>${yKey}</b><br>%{x}<br>%{y:${fmt}}<extra></extra>`,
    };
  });

  const heading =
    title ??
    (yKeys.length > 1 ? `${yKeys.join(', ')} by ${xKey}` : `${yKeys[0]} by ${xKey}`);

  return (
    <div className="rounded-xl border border-[var(--color-cream-200)] bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-900)]">
        {heading}
      </h3>
      <Plot
        data={traces}
        layout={{
          autosize: true,
          margin: { t: 10, l: 70, r: 20, b: 70 },
          barmode: 'group',
          xaxis: {
            title: { text: xKey },
            tickangle: -30,
            automargin: true,
          },
          yaxis: {
            tickformat: allSameFormat ? tickFormatFor(firstFormat) : undefined,
            rangemode: 'tozero',
            automargin: true,
          },
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          font: { family: 'inherit', color: '#1a1a1a' },
          showlegend: yKeys.length > 1,
          legend: { orientation: 'v', x: 1.02, y: 1, xanchor: 'left' },
        }}
        useResizeHandler
        style={{ width: '100%', height: 420 }}
        config={{ displaylogo: false, responsive: true }}
      />
    </div>
  );
}
