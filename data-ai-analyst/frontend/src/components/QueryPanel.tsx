'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import type { AskResponse } from '@/lib/types';
import ResultsView from '@/components/ResultsView';

type FormValues = {
  userQuestion: string;
};

export default function QueryPanel() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { userQuestion: '' },
  });

  const [result, setResult] = useState<AskResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const onSubmit = async (values: FormValues) => {
    setErrorMessage(null);
    setResult(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuestion: values.userQuestion }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Request failed: HTTP ${res.status}`);
      }

      const data = (await res.json()) as AskResponse;
      setResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      setErrorMessage(message);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="rounded-2xl border border-[var(--color-cream-200)] bg-white p-6 shadow-sm"
      >
        <label className="block">
          <span className="block text-sm font-medium text-[var(--color-ink-700)]">
            Type your campaign-related question below, and our AI Analyst will
            query the data to provide insights just like a Senior Analyst would.
          </span>
          <input
            type="text"
            placeholder="e.g. What are the top 5 products with the highest conversion rate in the last month?"
            className="mt-3 block w-full rounded-full border border-[var(--color-cream-200)] bg-[var(--color-cream-50)] px-5 py-3 text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-500)] focus:border-[var(--color-accent-blue)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]/30"
            disabled={isSubmitting}
            {...register('userQuestion', {
              required: 'Question is required',
              minLength: { value: 3, message: 'Question is too short' },
            })}
          />
          {errors.userQuestion && (
            <span className="mt-2 block text-xs text-[var(--color-accent-red)]">
              {errors.userQuestion.message}
            </span>
          )}
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--color-coral-400)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-coral-500)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <svg
                className="mr-2 h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="opacity-25"
                />
                <path
                  fill="currentColor"
                  className="opacity-75"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Analysing…
            </>
          ) : (
            'Get Insights'
          )}
        </button>
      </form>

      {(result || errorMessage) && (
        <section className="rounded-2xl border border-[var(--color-cream-200)] bg-white p-6 shadow-sm fade-in">
          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}
          {result && <ResultsView data={result} />}
        </section>
      )}
    </div>
  );
}
