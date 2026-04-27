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
};

export default function ScatterPlot({ rows, xKey, yKeys }: Props) {
  const yKey = yKeys[0];
  const points = rows
    .map((r) => ({ x: toNumber(r[xKey]), y: toNumber(r[yKey]) }))
    .filter((p) => p.x != null && p.y != null);

  const cols = inspectColumns(rows);
  const xFormat = cols.find((c) => c.name === xKey)?.numericFormat;
  const yFormat = cols.find((c) => c.name === yKey)?.numericFormat;
  const xHover = hoverFormatFor(xFormat);
  const yHover = hoverFormatFor(yFormat);

  return (
    <div className="rounded-xl border border-[var(--color-cream-200)] bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-900)]">
        {yKey} vs {xKey}
      </h3>
      <Plot
        data={[
          {
            x: points.map((p) => p.x as number),
            y: points.map((p) => p.y as number),
            type: 'scatter',
            mode: 'markers',
            marker: {
              color: CHART_COLORS.primary,
              size: 9,
              line: { color: CHART_COLORS.secondary, width: 1 },
            },
            hovertemplate: `${xKey}: %{x:${xHover}}<br>${yKey}: %{y:${yHover}}<extra></extra>`,
          },
        ]}
        layout={{
          autosize: true,
          margin: { t: 10, l: 80, r: 20, b: 70 },
          xaxis: {
            title: { text: xKey },
            tickformat: tickFormatFor(xFormat),
            automargin: true,
          },
          yaxis: {
            title: { text: yKey },
            tickformat: tickFormatFor(yFormat),
            automargin: true,
          },
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          font: { family: 'inherit', color: '#1a1a1a' },
        }}
        useResizeHandler
        style={{ width: '100%', height: 340 }}
        config={{ displaylogo: false, responsive: true }}
      />
    </div>
  );
}
