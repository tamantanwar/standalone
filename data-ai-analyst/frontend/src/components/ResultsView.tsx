'use client';

import type { AskResponse } from '@/lib/types';
import { preparePlot } from '@/lib/chart-selection';
import DataTable from '@/components/DataTable';
import BarChart from '@/components/charts/BarChart';
import LineChart from '@/components/charts/LineChart';
import PieChart from '@/components/charts/PieChart';
import ScatterPlot from '@/components/charts/ScatterPlot';

type Props = {
  data: AskResponse;
};

function formatHumanResponse(text: string) {
  return text.split('\n').map((line, idx) => {
    const trimmed = line.trim();
    if (trimmed === '') return <br key={idx} />;
    if (trimmed.startsWith('- ')) {
      return (
        <li
          key={idx}
          className="ml-5 list-disc text-sm text-[var(--color-ink-700)]"
        >
          {trimmed.slice(2)}
        </li>
      );
    }
    return (
      <p key={idx} className="text-sm text-[var(--color-ink-700)]">
        {line}
      </p>
    );
  });
}

export default function ResultsView({ data }: Props) {
  const { rows: rawRows, humanResponse, table, sql } = data;
  const { rows, charts } = rawRows
    ? preparePlot(rawRows)
    : { rows: [], charts: [] };

  return (
    <div className="space-y-6">
      {humanResponse && (
        <div>
          <h2 className="mb-2 text-base font-semibold text-[var(--color-ink-900)]">
            kedet&apos;s Analysis
          </h2>
          <div className="space-y-1">{formatHumanResponse(humanResponse)}</div>
        </div>
      )}

      {rawRows && rawRows.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
            Data Table
          </h2>
          <p className="text-xs text-[var(--color-ink-500)]">
            Source table:{' '}
            <code className="rounded bg-[var(--color-cream-100)] px-1.5 py-0.5 text-[var(--color-ink-700)]">
              {table}
            </code>{' '}
            · {rawRows.length.toLocaleString()} rows
          </p>
          <DataTable rows={rawRows} />

          {charts.length > 0 ? (
            <div className="space-y-4">
              {charts.map((spec, i) => {
                const key = `${spec.type}-${spec.xKey}-${spec.yKeys.join('+')}-${i}`;
                if (spec.type === 'bar')
                  return (
                    <BarChart
                      key={key}
                      rows={rows}
                      xKey={spec.xKey}
                      yKeys={spec.yKeys}
                    />
                  );
                if (spec.type === 'line')
                  return (
                    <LineChart
                      key={key}
                      rows={rows}
                      xKey={spec.xKey}
                      yKeys={spec.yKeys}
                      seriesKey={spec.seriesKey}
                    />
                  );
                if (spec.type === 'pie')
                  return (
                    <PieChart
                      key={key}
                      rows={rows}
                      xKey={spec.xKey}
                      yKeys={spec.yKeys}
                    />
                  );
                if (spec.type === 'scatter')
                  return (
                    <ScatterPlot
                      key={key}
                      rows={rows}
                      xKey={spec.xKey}
                      yKeys={spec.yKeys}
                    />
                  );
                return null;
              })}
            </div>
          ) : (
            <p className="text-xs italic text-[var(--color-ink-500)]">
              No chart fits this result shape — showing the table only.
            </p>
          )}
        </div>
      )}

      {sql && (
        <details className="rounded-md border border-[var(--color-cream-200)] bg-[var(--color-cream-50)] p-3">
          <summary className="cursor-pointer text-xs font-medium text-[var(--color-ink-700)]">
            Generated SQL
          </summary>
          <pre className="mt-2 overflow-x-auto text-xs text-[var(--color-ink-900)]">
            {sql}
          </pre>
        </details>
      )}
    </div>
  );
}
