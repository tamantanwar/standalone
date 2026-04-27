'use client';

import Spinner from './Spinner';

type Props = {
  label: string;
  hint?: string;
};

export default function OperationOverlay({ label, hint }: Props) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-[1px]"
      aria-busy="true"
      role="status"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-2xl">
        <Spinner size={36} className="text-[var(--color-coral-400)]" />
        <p className="text-sm font-semibold text-[var(--color-ink-900)]">
          {label}
        </p>
        {hint && (
          <p className="max-w-xs text-center text-xs text-[var(--color-ink-500)]">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
