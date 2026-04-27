'use client';

import { useState } from 'react';

import type {
  AuditAbTestSuggestion,
  CompareResponse,
  CompareResultEntry,
} from '@/lib/types';

type Props = {
  data: CompareResponse;
  onClose: () => void;
};

function CompareImage({ url, label }: { url: string; label: string }) {
  const [errored, setErrored] = useState(false);
  const proxied = `/api/image-proxy?url=${encodeURIComponent(url)}`;
  if (errored) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-lg border border-dashed border-[var(--color-cream-200)] bg-[var(--color-cream-50)] px-3 text-center text-xs text-[var(--color-ink-500)]">
        {label} — image unavailable (the source URL may have expired or the
        bucket is private).
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxied}
      alt={label}
      onError={() => setErrored(true)}
      className="h-48 w-full rounded-lg border border-[var(--color-cream-200)] object-contain bg-[var(--color-cream-50)]"
    />
  );
}

function bulletList(items: string[] | undefined, tone: 'pos' | 'neg') {
  if (!items || items.length === 0) return null;
  const cls =
    tone === 'pos'
      ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900'
      : 'border-[var(--color-coral-300)]/60 bg-[var(--color-coral-300)]/15 text-[var(--color-ink-900)]';
  return (
    <ul className={`space-y-1 rounded-xl border p-4 text-xs ${cls}`}>
      {items.map((s, i) => (
        <li key={i} className="list-disc pl-4">
          {s}
        </li>
      ))}
    </ul>
  );
}

// Pull the human-readable string out of an A/B test suggestion regardless of
// which key the model decided to use this time.
function suggestionText(s: AuditAbTestSuggestion | Record<string, unknown>): string {
  const known = ['suggestion', 'idea', 'testIdea', 'description', 'text', 'name', 'change'];
  for (const k of known) {
    const v = (s as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  // Fall back: any string-valued field on the object.
  for (const v of Object.values(s)) {
    if (typeof v === 'string' && v.trim() && v.length > 8) return v;
  }
  return JSON.stringify(s);
}

// Look in every plausible location for a list of A/B test suggestions.
function collectAbTests(
  result: CompareResultEntry['result'],
): AuditAbTestSuggestion[] {
  if (!result) return [];
  const r = result as unknown as Record<string, unknown>;

  const candidates: unknown[] = [
    r.abTestSuggestionsVisual,
    r.abTestSuggestions,
    r.abTestIdeas,
    r.suggestions,
    (r.image1Analysis as Record<string, unknown> | undefined)
      ?.abTestSuggestionsVisual,
    (r.image2Analysis as Record<string, unknown> | undefined)
      ?.abTestSuggestionsVisual,
    (r.recommendation as Record<string, unknown> | undefined)
      ?.abTestSuggestionsVisual,
  ];
  const out: AuditAbTestSuggestion[] = [];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      for (const item of c) {
        if (typeof item === 'string') {
          out.push({ suggestion: item });
        } else if (item && typeof item === 'object') {
          out.push(item as AuditAbTestSuggestion);
        }
      }
    }
  }
  return out;
}

function EntryView({ entry }: { entry: CompareResultEntry }) {
  if (entry.error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {entry.error}
      </div>
    );
  }

  const result = entry.result;
  if (!result) {
    return <p className="text-sm text-[var(--color-ink-500)]">No result.</p>;
  }

  if (result.error) {
    return (
      <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <p className="font-medium">{result.error}</p>
        {result.rawContent && (
          <pre className="overflow-x-auto rounded bg-white/60 p-2 text-xs">
            {result.rawContent}
          </pre>
        )}
      </div>
    );
  }

  const [url1, url2] = entry.imageUrls ?? [];
  const abTests = collectAbTests(result);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {url1 && <CompareImage url={url1} label="Creative 1" />}
        {url2 && <CompareImage url={url2} label="Creative 2" />}
      </div>

      {result.comparisonSummary && (
        <div className="rounded-xl border border-[var(--color-cream-200)] bg-white p-4">
          <h4 className="text-sm font-semibold text-[var(--color-ink-900)]">
            Summary
          </h4>
          <p className="mt-1 text-sm text-[var(--color-ink-700)]">
            {result.comparisonSummary}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-emerald-700">
            Similarities
          </h4>
          {bulletList(result.visualSimilarities, 'pos')}
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-[var(--color-coral-500)]">
            Differences
          </h4>
          {bulletList(result.visualDifferences, 'neg')}
        </div>
      </div>

      {result.recommendation && (
        <div className="rounded-xl border border-[var(--color-accent-blue)]/30 bg-[var(--color-accent-blue)]/5 p-4 text-sm">
          <p className="font-medium text-[var(--color-accent-blue)]">
            Recommendation
          </p>
          <p className="mt-1 text-[var(--color-ink-700)]">
            {result.recommendation}
          </p>
        </div>
      )}

      {abTests.length > 0 && (
        <div className="rounded-xl border border-[var(--color-cream-200)] bg-white p-4">
          <h4 className="text-sm font-semibold text-[var(--color-ink-900)]">
            A/B Test Suggestions
          </h4>
          <ul className="mt-2 space-y-2 text-xs text-[var(--color-ink-700)]">
            {abTests.map((s, i) => (
              <li key={i} className="rounded-md bg-[var(--color-cream-50)] p-2">
                {s.type && (
                  <span className="mr-2 rounded-full bg-[var(--color-accent-blue)]/10 px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--color-accent-blue)]">
                    {s.type}
                  </span>
                )}
                {suggestionText(s)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="rounded-xl border border-[var(--color-cream-200)] bg-[var(--color-cream-50)] p-3">
        <summary className="cursor-pointer text-xs font-medium text-[var(--color-ink-700)]">
          Raw model response (debug)
        </summary>
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-[11px] text-[var(--color-ink-700)]">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default function CompareResultsModal({ data, onClose }: Props) {
  const entries = data.results ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-[var(--color-cream-50)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-cream-200)] bg-white px-5 py-3">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
            Creative Comparison
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--color-ink-500)] hover:bg-[var(--color-cream-100)] hover:text-[var(--color-ink-900)]"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 p-5">
          {entries.map((entry, idx) => (
            <section
              key={idx}
              className="rounded-xl border border-[var(--color-cream-200)] bg-white p-5 shadow-sm"
            >
              <EntryView entry={entry} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
