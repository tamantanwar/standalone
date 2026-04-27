'use client';

import Spinner from './Spinner';

type Props = {
  title: string;
  subtitle?: string;
};

export default function LoadingCard({ title, subtitle }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-cream-200)] bg-white px-6 py-12 text-center shadow-sm">
      <Spinner size={40} className="text-[var(--color-coral-400)]" />
      <p className="text-base font-semibold text-[var(--color-ink-900)]">
        {title}
      </p>
      {subtitle && (
        <p className="max-w-md text-sm text-[var(--color-ink-500)]">
          {subtitle}
        </p>
      )}
      <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-[var(--color-cream-100)]">
        <div className="h-full w-1/3 animate-[indeterminate_1.4s_linear_infinite] rounded-full bg-[var(--color-coral-400)]" />
      </div>
      <style jsx>{`
        @keyframes indeterminate {
          0% {
            transform: translateX(-150%);
          }
          100% {
            transform: translateX(450%);
          }
        }
      `}</style>
    </div>
  );
}
