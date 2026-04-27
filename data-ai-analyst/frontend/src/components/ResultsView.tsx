'use client';

import type { AskResponse } from '@/lib/types';
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
        <li key={idx} className="ml-5 list-disc text-sm text-zinc-600">
          {trimmed.slice(2)}
        </li>
      );
    }
    return (
      <p key={idx} className="text-sm text-zinc-600">
        {line}
      </p>
    );
  });
}

export default function ResultsView({ data }: Props) {
  const { rows, humanResponse, table, sql } = data;

  return (
    <div className="space-y-6">
      {humanResponse && (
        <div>
          <h2 className="mb-2 text-base font-semibold text-zinc-800">
            Kedet&apos;s Analysis
          </h2>
          <div className="space-y-1">{formatHumanResponse(humanResponse)}</div>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-zinc-800">Data Table</h2>
          <p className="text-xs text-zinc-500">
            Source table: <code className="rounded bg-zinc-100 px-1">{table}</code>
          </p>
          <DataTable rows={rows} />

          <BarChart rows={rows} />
          <LineChart rows={rows} />
          <PieChart rows={rows} />
          <ScatterPlot rows={rows} />
        </div>
      )}

      {sql && (
        <details className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <summary className="cursor-pointer text-xs font-medium text-zinc-600">
            Generated SQL
          </summary>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-700">{sql}</pre>
        </details>
      )}
    </div>
  );
}
