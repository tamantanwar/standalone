'use client';

import type { AskRow } from '@/lib/types';
import Plot from './Plot';

type Props = { rows: AskRow[] };

export default function ScatterPlot({ rows }: Props) {
  if (!rows || rows.length === 0) return null;
  const keys = Object.keys(rows[0]);
  if (keys.length < 2) return null;

  const [xKey, yKey] = keys;
  const x = rows.map((r) => r[xKey] as string | number);
  const y = rows.map((r) => r[yKey] as number);

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-semibold text-zinc-700">
        Scatter Plot Visualization
      </h3>
      <Plot
        data={[{ x, y, type: 'scatter', mode: 'markers' }]}
        layout={{
          title: { text: 'Scatter Plot' },
          xaxis: { title: { text: xKey } },
          yaxis: { title: { text: yKey } },
          autosize: true,
          margin: { t: 40, l: 50, r: 20, b: 60 },
        }}
        useResizeHandler
        style={{ width: '100%', height: 320 }}
        config={{ displaylogo: false, responsive: true }}
      />
    </div>
  );
}
