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
  seriesKey?: string;
  title?: string;
};

function sortByX(rows: AskRow[], xKey: string): AskRow[] {
  return [...rows].sort((a, b) => {
    const av = a[xKey];
    const bv = b[xKey];
    const an = typeof av === 'number' ? av : Number(av);
    const bn = typeof bv === 'number' ? bv : Number(bv);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return String(av ?? '').localeCompare(String(bv ?? ''));
  });
}

export default function LineChart({
  rows,
  xKey,
  yKeys,
  seriesKey,
  title,
}: Props) {
  const cols = inspectColumns(rows);
  const yFormat = cols.find((c) => c.name === yKeys[0])?.numericFormat;
  const hoverFmt = hoverFormatFor(yFormat);

  const traces: Plotly.Data[] = [];
  if (seriesKey) {
    const groups = new Map<string, AskRow[]>();
    for (const row of rows) {
      const key = String(row[seriesKey] ?? '—');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    let i = 0;
    for (const [name, gRows] of groups) {
      const sorted = sortByX(gRows, xKey);
      traces.push({
        name,
        x: sorted.map((r) => r[xKey] as string | number),
        y: sorted.map((r) => toNumber(r[yKeys[0]])),
        type: 'scatter',
        mode: 'lines+markers',
        line: {
          color: CHART_COLORS.palette[i % CHART_COLORS.palette.length],
          width: 2,
        },
        marker: { size: 6 },
        connectgaps: false,
        hovertemplate: `<b>${name}</b><br>%{x}<br>${yKeys[0]}: %{y:${hoverFmt}}<extra></extra>`,
      });
      i++;
    }
  } else {
    const sorted = sortByX(rows, xKey);
    yKeys.forEach((yKey, i) => {
      const fmt = hoverFormatFor(
        cols.find((c) => c.name === yKey)?.numericFormat,
      );
      traces.push({
        name: yKey,
        x: sorted.map((r) => r[xKey] as string | number),
        y: sorted.map((r) => toNumber(r[yKey])),
        type: 'scatter',
        mode: 'lines+markers',
        line: {
          color: CHART_COLORS.palette[i % CHART_COLORS.palette.length],
          width: 2,
        },
        marker: { size: 6 },
        connectgaps: false,
        hovertemplate: `<b>${yKey}</b><br>%{x}<br>%{y:${fmt}}<extra></extra>`,
      });
    });
  }

  const heading =
    title ??
    (seriesKey
      ? `${yKeys[0]} over ${xKey}, by ${seriesKey}`
      : yKeys.length > 1
        ? `${yKeys.join(', ')} over ${xKey}`
        : `${yKeys[0]} over ${xKey}`);

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
          xaxis: {
            title: { text: xKey },
            type: 'category',
            tickangle: -30,
            automargin: true,
          },
          yaxis: {
            tickformat: tickFormatFor(yFormat),
            rangemode: 'tozero',
            automargin: true,
          },
          plot_bgcolor: 'rgba(0,0,0,0)',
          paper_bgcolor: 'rgba(0,0,0,0)',
          font: { family: 'inherit', color: '#1a1a1a' },
          showlegend: traces.length > 1,
          legend: { orientation: 'v', x: 1.02, y: 1, xanchor: 'left' },
          hovermode: 'x unified',
        }}
        useResizeHandler
        style={{ width: '100%', height: 420 }}
        config={{ displaylogo: false, responsive: true }}
      />
    </div>
  );
}
