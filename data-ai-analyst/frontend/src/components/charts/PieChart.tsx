'use client';

import type { AskRow } from '@/lib/types';
import Plot from './Plot';

type Props = { rows: AskRow[] };

export default function PieChart({ rows }: Props) {
  if (!rows || rows.length === 0) return null;
  const keys = Object.keys(rows[0]);
  if (keys.length < 2) return null;

  const [labelKey, valueKey] = keys;
  const labels = rows.map((r) => String(r[labelKey] ?? ''));
  const values = rows.map((r) => r[valueKey] as number);

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <h3 className="mb-2 text-sm font-semibold text-zinc-700">
        Pie Chart Visualization
      </h3>
      <Plot
        data={[{ labels, values, type: 'pie' }]}
        layout={{
          title: { text: 'Pie Chart' },
          autosize: true,
          margin: { t: 40, l: 20, r: 20, b: 20 },
        }}
        useResizeHandler
        style={{ width: '100%', height: 320 }}
        config={{ displaylogo: false, responsive: true }}
      />
    </div>
  );
}
