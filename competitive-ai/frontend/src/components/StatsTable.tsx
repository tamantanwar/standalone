'use client';

import type { DomainStat } from '@/lib/types';

type Props = {
  rows: DomainStat[];
};

const COLUMNS: { key: keyof DomainStat; label: string }[] = [
  { key: 'domain', label: 'Domain' },
  { key: 'searchMonth', label: 'Search Month' },
  { key: 'searchYear', label: 'Search Year' },
  { key: 'averageAdRank', label: 'Average Ad Rank' },
  { key: 'strength', label: 'Strength' },
  { key: 'monthlyBudget', label: 'Monthly Budget' },
  { key: 'totalAdsPurchased', label: 'Total Ads Purchased' },
];

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    return Number.isInteger(v)
      ? v.toLocaleString()
      : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
}

export default function StatsTable({ rows }: Props) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200">
      <table className="min-w-full divide-y divide-zinc-200 text-sm">
        <thead className="bg-zinc-50">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key as string}
                className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {rows.map((row, idx) => (
            <tr key={idx} className={idx % 2 ? 'bg-zinc-50/50' : ''}>
              {COLUMNS.map((col) => (
                <td key={col.key as string} className="px-3 py-2 text-zinc-800">
                  {fmt(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
