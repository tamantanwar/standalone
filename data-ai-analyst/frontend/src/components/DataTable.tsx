'use client';

import type { AskRow } from '@/lib/types';

type Props = {
  rows: AskRow[];
};

function formatCell(value: AskRow[string]): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

export default function DataTable({ rows }: Props) {
  if (!rows || rows.length === 0) return null;

  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {rows.map((row, idx) => (
            <tr key={idx} className={idx % 2 ? 'bg-zinc-50/50' : ''}>
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-zinc-800">
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
