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

const NO_THOUSANDS = new Set<keyof DomainStat>(['searchMonth', 'searchYear']);

function fmt(v: unknown, key: keyof DomainStat): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    if (NO_THOUSANDS.has(key)) return String(Math.trunc(v));
    return Number.isInteger(v)
      ? v.toLocaleString()
      : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
}

export default function StatsTable({ rows }: Props) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-cream-200)]">
      <table className="min-w-full divide-y divide-[var(--color-cream-200)] text-sm">
        <thead className="bg-[var(--color-coral-300)]">
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key as string}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-white"
              >
                {col.label}
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
              {COLUMNS.map((col) => {
                const isNumeric =
                  typeof row[col.key] === 'number' && col.key !== 'domain';
                return (
                  <td
                    key={col.key as string}
                    className={`px-4 py-2 text-[var(--color-ink-900)] ${
                      isNumeric ? 'text-right tabular-nums' : ''
                    }`}
                  >
                    {fmt(row[col.key], col.key)}
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
