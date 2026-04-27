import { getBackendHealth } from '@/lib/backend-client';
import QueryPanel from '@/components/QueryPanel';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const health = await getBackendHealth();

  return (
    <main className="min-h-screen p-6 sm:p-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
          AI-Powered Kedet Insights
        </h1>
        <p className="mt-2 text-zinc-600 text-center max-w-2xl mx-auto">
          Ask campaign-related questions in natural language — our AI analyst
          queries your BigQuery data and surfaces insights like a senior analyst.
        </p>

        <div className="mt-4 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${
                health.ok ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            <span>
              Backend:{' '}
              {health.ok ? (
                <span className="text-zinc-700">
                  connected · v{health.version} · {health.environment}
                </span>
              ) : (
                <span className="text-zinc-700">unreachable — {health.error}</span>
              )}
            </span>
          </div>
        </div>
      </header>

      <QueryPanel />
    </main>
  );
}
