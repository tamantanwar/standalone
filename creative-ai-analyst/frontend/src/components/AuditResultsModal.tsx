'use client';

import { useState } from 'react';

import type {
  AuditDetail,
  AuditResultEntry,
  AuditResponse,
} from '@/lib/types';

function proxiedImageSrc(url: string): string {
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

function ThumbImage({ url }: { url: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-[var(--color-cream-200)] bg-[var(--color-cream-50)] text-[10px] text-[var(--color-ink-500)]">
        n/a
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxiedImageSrc(url)}
      alt="Audited creative"
      onError={() => setErrored(true)}
      className="h-16 w-16 rounded-md border border-[var(--color-cream-200)] object-cover"
    />
  );
}

type Props = {
  data: AuditResponse;
  onClose: () => void;
};

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'bg-emerald-50 text-emerald-700',
  neutral: 'bg-[var(--color-cream-100)] text-[var(--color-ink-700)]',
  negative: 'bg-red-50 text-red-700',
};

function ScorePill({ score }: { score?: number }) {
  if (score == null) return null;
  const tone =
    score >= 8
      ? 'bg-emerald-100 text-emerald-800'
      : score >= 5
        ? 'bg-[var(--color-coral-300)]/50 text-[var(--color-coral-500)]'
        : 'bg-red-100 text-red-700';
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-semibold ${tone}`}
      title="Overall visual score"
    >
      {score.toFixed(1)} / 10
    </span>
  );
}

function AuditDetailView({
  source,
  detail,
}: {
  source: string;
  detail: AuditDetail;
}) {
  if (detail.error) {
    return (
      <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        <p className="font-medium">{detail.error}</p>
        {detail.rawContent && (
          <pre className="overflow-x-auto rounded bg-white/60 p-2 text-xs text-red-700">
            {detail.rawContent}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <ScorePill score={detail.overallVisualScore} />
        {detail.visualSummary && (
          <p className="text-sm text-[var(--color-ink-700)]">
            {detail.visualSummary}
          </p>
        )}
      </div>

      {detail.visualAnalysisSections?.map((section, idx) => (
        <div
          key={`${source}-section-${idx}`}
          className="rounded-xl border border-[var(--color-cream-200)] bg-[var(--color-cream-50)] p-4"
        >
          <h4 className="text-sm font-semibold text-[var(--color-ink-900)]">
            {section.title ?? section.category ?? `Section ${idx + 1}`}
          </h4>
          <div className="mt-3 space-y-3">
            {section.items?.map((item, j) => {
              const sentimentClass =
                SENTIMENT_COLORS[item.sentiment ?? 'neutral'] ??
                SENTIMENT_COLORS.neutral;
              return (
                <div
                  key={`${source}-item-${idx}-${j}`}
                  className="rounded-lg border border-[var(--color-cream-200)] bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-[var(--color-ink-900)]">
                      {item.name}
                    </p>
                    {item.sentiment && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${sentimentClass}`}
                      >
                        {item.sentiment}
                      </span>
                    )}
                  </div>
                  {item.analysis && (
                    <p className="mt-1 text-xs text-[var(--color-ink-700)]">
                      {item.analysis}
                    </p>
                  )}
                  {item.metrics && Object.keys(item.metrics).length > 0 && (
                    <dl className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-[var(--color-ink-500)]">
                      {Object.entries(item.metrics).map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-2">
                          <dt>{k}</dt>
                          <dd className="font-mono text-[var(--color-ink-700)]">
                            {Array.isArray(v) ? v.join(', ') : String(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {item.detectedElements &&
                    item.detectedElements.length > 0 && (
                      <ul className="mt-2 space-y-1 text-[11px] text-[var(--color-ink-500)]">
                        {item.detectedElements.map((el, k) => (
                          <li
                            key={`${source}-el-${idx}-${j}-${k}`}
                            className="rounded bg-[var(--color-cream-100)] px-2 py-1"
                          >
                            <span className="font-medium text-[var(--color-ink-700)]">
                              {el.label}
                            </span>
                            {el.text_content && `: "${el.text_content}"`}
                            {el.confidence != null &&
                              ` (${(el.confidence * 100).toFixed(0)}%)`}
                          </li>
                        ))}
                      </ul>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {detail.overallVisualEffectiveness && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {detail.overallVisualEffectiveness.strengths &&
            detail.overallVisualEffectiveness.strengths.length > 0 && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <h4 className="text-sm font-semibold text-emerald-800">
                  Strengths
                </h4>
                <ul className="mt-2 space-y-1 text-xs text-emerald-900">
                  {detail.overallVisualEffectiveness.strengths.map((s, i) => (
                    <li key={i} className="list-disc pl-4">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          {detail.overallVisualEffectiveness.areasForVisualImprovement &&
            detail.overallVisualEffectiveness.areasForVisualImprovement.length >
              0 && (
              <div className="rounded-xl border border-[var(--color-coral-300)]/60 bg-[var(--color-coral-300)]/15 p-4">
                <h4 className="text-sm font-semibold text-[var(--color-coral-500)]">
                  Areas for Improvement
                </h4>
                <ul className="mt-2 space-y-1 text-xs text-[var(--color-ink-700)]">
                  {detail.overallVisualEffectiveness.areasForVisualImprovement.map(
                    (s, i) => (
                      <li key={i} className="list-disc pl-4">
                        {s}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}
          {detail.overallVisualEffectiveness.abTestSuggestionsVisual &&
            detail.overallVisualEffectiveness.abTestSuggestionsVisual.length >
              0 && (
              <div className="rounded-xl border border-[var(--color-accent-blue)]/30 bg-[var(--color-accent-blue)]/5 p-4 lg:col-span-2">
                <h4 className="text-sm font-semibold text-[var(--color-accent-blue)]">
                  A/B Test Suggestions
                </h4>
                <ul className="mt-2 space-y-2 text-xs text-[var(--color-ink-700)]">
                  {detail.overallVisualEffectiveness.abTestSuggestionsVisual.map(
                    (s, i) => (
                      <li
                        key={i}
                        className="rounded-md bg-white p-2 shadow-sm"
                      >
                        {s.type && (
                          <span className="mr-2 rounded-full bg-[var(--color-accent-blue)]/10 px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--color-accent-blue)]">
                            {s.type}
                          </span>
                        )}
                        {s.suggestion ?? s.idea ?? s.testIdea}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            )}
          {detail.overallVisualEffectiveness.targetAudienceVisualFit &&
            Object.keys(
              detail.overallVisualEffectiveness.targetAudienceVisualFit,
            ).length > 0 && (
              <div className="rounded-xl border border-[var(--color-cream-200)] bg-white p-4 lg:col-span-2">
                <h4 className="text-sm font-semibold text-[var(--color-ink-900)]">
                  Audience Fit Scores
                </h4>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {Object.entries(
                    detail.overallVisualEffectiveness.targetAudienceVisualFit,
                  ).map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between rounded-md bg-[var(--color-cream-50)] px-3 py-2"
                    >
                      <span className="text-[var(--color-ink-700)]">{k}</span>
                      <span className="font-mono font-medium text-[var(--color-ink-900)]">
                        {typeof v === 'number' ? v.toFixed(1) : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>
      )}

      {detail.visualConclusion && (
        <div className="rounded-xl border border-[var(--color-cream-200)] bg-[var(--color-cream-50)] p-4 text-sm text-[var(--color-ink-700)]">
          <p className="font-medium text-[var(--color-ink-900)]">Conclusion</p>
          <p className="mt-1">{detail.visualConclusion}</p>
        </div>
      )}
    </div>
  );
}

function EntryView({ entry, idx }: { entry: AuditResultEntry; idx: number }) {
  const source = entry.imageUrl ?? entry.videoUrl ?? `creative-${idx}`;
  return (
    <section className="rounded-xl border border-[var(--color-cream-200)] bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {entry.imageUrl && <ThumbImage url={entry.imageUrl} />}
          <div className="text-xs">
            <p className="font-medium text-[var(--color-ink-900)]">
              {entry.imageUrl ? 'Image' : 'Video'} #{idx + 1}
            </p>
            <p
              className="max-w-[24rem] truncate text-[var(--color-ink-500)]"
              title={source}
            >
              {source}
            </p>
          </div>
        </div>
      </header>

      {entry.error ? (
        <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">{entry.error}</p>
          {entry.suggestion && (
            <p className="text-xs text-red-700">{entry.suggestion}</p>
          )}
        </div>
      ) : entry.result ? (
        <AuditDetailView source={source} detail={entry.result} />
      ) : (
        <p className="text-sm text-[var(--color-ink-500)]">No result.</p>
      )}
    </section>
  );
}

export default function AuditResultsModal({ data, onClose }: Props) {
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
            Creative Audit ({entries.length} creative
            {entries.length === 1 ? '' : 's'})
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
          {entries.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-500)]">
              No audit results returned.
            </p>
          ) : (
            entries.map((entry, idx) => (
              <EntryView
                key={`${entry.imageUrl ?? entry.videoUrl ?? idx}`}
                entry={entry}
                idx={idx}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
