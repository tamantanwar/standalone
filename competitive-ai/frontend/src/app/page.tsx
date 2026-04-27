import CompetitivePanel from '@/components/CompetitivePanel';
import { getBackendHealth } from '@/lib/backend-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const health = await getBackendHealth();

  return (
    <main className="mx-auto min-h-[calc(100vh-65px)] max-w-7xl px-6 py-10 sm:px-10">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-ink-900)] sm:text-4xl">
          Competitive Analysis
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[var(--color-ink-500)]">
          Discover competitor strategies and analyze their ad campaigns.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-cream-200)] bg-white px-3 py-1 text-xs">
          <span
            aria-hidden
            className={`h-2 w-2 rounded-full ${
              health.ok ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
          <span className="text-[var(--color-ink-700)]">
            Backend:{' '}
            {health.ok ? (
              <>
                connected · v{health.version} · {health.environment}
              </>
            ) : (
              <>unreachable — {health.error}</>
            )}
          </span>
        </div>
      </header>

      <CompetitivePanel />
    </main>
  );
}
