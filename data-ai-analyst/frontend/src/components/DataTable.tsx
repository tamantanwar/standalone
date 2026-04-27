'use client';

import type { AskRow } from '@/lib/types';
import {
  formatNumber,
  inspectColumns,
  toNumber,
  type ColumnInfo,
} from '@/lib/chart-selection';

type Props = {
  rows: AskRow[];
};

function formatCell(value: AskRow[string], col: ColumnInfo): string {
  if (value === null || value === undefined || value === '') return '';
  // Date components (year/month/day/etc) and IDs are integers we don't want
  // to thousands-separate — e.g. year 2025 should be "2025", not "2,025".
  if (col.kind === 'date_component' || col.kind === 'id') {
    const n = toNumber(value);
    return n === null ? String(value) : String(Math.trunc(n));
  }
  if (col.kind === 'numeric') {
    const n = toNumber(value);
    if (n === null) return String(value);
    return formatNumber(n, col.numericFormat);
  }
  return String(value);
}

export default function DataTable({ rows }: Props) {
  if (!rows || rows.length === 0) return null;

  const cols = inspectColumns(rows);

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-200)]">
      <table className="min-w-full divide-y divide-[var(--color-cream-200)] text-sm">
        <thead className="bg-[var(--color-coral-300)]">
          <tr>
            {cols.map((col) => (
              <th
                key={col.name}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white"
              >
                {col.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-cream-100)] bg-white">
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className={idx % 2 ? 'bg-[var(--color-cream-50)]' : 'bg-white'}
            >
              {cols.map((col) => {
                const isNumericLike =
                  col.kind === 'numeric' || col.kind === 'date_component';
                return (
                  <td
                    key={col.name}
                    className={`px-4 py-2 text-[var(--color-ink-900)] ${
                      isNumericLike ? 'text-right tabular-nums' : ''
                    }`}
                  >
                    {formatCell(row[col.name], col)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
