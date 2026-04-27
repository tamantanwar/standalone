'use client';

import type { ImageOpResponse } from '@/lib/types';

type Props = {
  data: ImageOpResponse;
  title: string;
  onClose: () => void;
  // Chainable next-step actions, run on the same selection.
  onRunVariant?: () => void;
  onRunEdit?: () => void;
  onRunAudit?: () => void;
  busy?: boolean;
};

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function ImageOpResultsModal({
  data,
  title,
  onClose,
  onRunVariant,
  onRunEdit,
  onRunAudit,
  busy = false,
}: Props) {
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
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-cream-200)] bg-white px-5 py-3">
          <h2 className="text-base font-semibold text-[var(--color-ink-900)]">
            {title} — {entries.length} result{entries.length === 1 ? '' : 's'}
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            {onRunVariant && (
              <button
                type="button"
                onClick={onRunVariant}
                disabled={busy}
                className="rounded-full border border-[var(--color-cream-200)] bg-white px-3 py-1 text-xs font-semibold text-[var(--color-ink-900)] hover:bg-[var(--color-cream-100)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Run Variant again
              </button>
            )}
            {onRunEdit && (
              <button
                type="button"
                onClick={onRunEdit}
                disabled={busy}
                className="rounded-full border border-[var(--color-cream-200)] bg-white px-3 py-1 text-xs font-semibold text-[var(--color-ink-900)] hover:bg-[var(--color-cream-100)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Edit instead
              </button>
            )}
            {onRunAudit && (
              <button
                type="button"
                onClick={onRunAudit}
                disabled={busy}
                className="rounded-full bg-[var(--color-coral-400)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--color-coral-500)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Audit this
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[var(--color-ink-500)] hover:bg-[var(--color-cream-100)] hover:text-[var(--color-ink-900)]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
          {entries.map((entry, idx) => {
            if (entry.error) {
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  <p className="font-medium">Image #{idx + 1}</p>
                  <p className="mt-1 text-xs">{entry.error}</p>
                  {entry.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.imageUrl}
                      alt="Original"
                      className="mt-3 h-40 w-full rounded-md border border-red-200 object-contain bg-white"
                    />
                  )}
                </div>
              );
            }

            const dataUrl = entry.image
              ? `data:image/png;base64,${entry.image}`
              : null;
            const downloadName = `${title
              .toLowerCase()
              .replace(/\s+/g, '-')}-${idx + 1}.png`;

            return (
              <section
                key={idx}
                className="overflow-hidden rounded-xl border border-[var(--color-cream-200)] bg-white shadow-sm"
              >
                {dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dataUrl}
                    alt={`${title} ${idx + 1}`}
                    className="max-h-96 w-full bg-[var(--color-cream-50)] object-contain"
                  />
                ) : (
                  <div className="flex h-48 items-center justify-center bg-[var(--color-cream-50)] text-sm text-[var(--color-ink-500)]">
                    No image returned
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-cream-200)] p-3">
                  <div className="text-xs">
                    <p className="font-medium text-[var(--color-ink-900)]">
                      Result #{idx + 1}
                    </p>
                    {entry.gcsUrl && (
                      <a
                        href={entry.gcsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-coral-500)] hover:underline"
                      >
                        Saved to GCS ↗
                      </a>
                    )}
                  </div>
                  {dataUrl && (
                    <button
                      type="button"
                      onClick={() => downloadDataUrl(dataUrl, downloadName)}
                      className="rounded-full bg-[var(--color-coral-400)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--color-coral-500)]"
                    >
                      Download
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
