'use client';

import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import type {
  AdCreativesResponse,
  AdSource,
  Competitor,
  CompetitorsResponse,
  DomainStat,
} from '@/lib/types';
import StatsTable from '@/components/StatsTable';
import StatsBarChart from '@/components/StatsBarChart';
import AdCreativesGrid from '@/components/AdCreativesGrid';
import LoadingCard from '@/components/LoadingCard';
import OperationOverlay from '@/components/OperationOverlay';

type CompetitorFormValues = {
  domain: string;
  countryCode: string;
  timePeriod: string;
};

const COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'IN', label: 'India' },
  { code: 'UK', label: 'United Kingdom' },
];

const PERIODS = [
  { value: '1', label: 'Last Month' },
  { value: '3', label: 'Last 3 Months' },
  { value: '6', label: 'Last 6 Months' },
  { value: '9', label: 'Last 9 Months' },
  { value: '12', label: 'Last 12 Months' },
];

const INPUT_CLASS =
  'mt-1 block w-full rounded-md border border-[var(--color-cream-200)] bg-[var(--color-cream-50)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-accent-blue)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]/30';

const LABEL_CLASS = 'block text-xs font-medium text-[var(--color-ink-700)]';

export default function CompetitivePanel() {
  const competitorForm = useForm<CompetitorFormValues>({
    defaultValues: { domain: '', countryCode: '', timePeriod: '' },
  });

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [statsData, setStatsData] = useState<DomainStat[]>([]);
  const [searchedCountry, setSearchedCountry] = useState<string>('');

  const [selectedDomain, setSelectedDomain] = useState<string>('');
  const [adSource, setAdSource] = useState<AdSource>('Google');
  const [adCreatives, setAdCreatives] = useState<AdCreativesResponse | null>(
    null,
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isFetchingAds, setIsFetchingAds] = useState(false);
  const [competitorsAttempted, setCompetitorsAttempted] = useState(false);

  const errorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (errorMessage && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errorMessage]);

  const onCompetitorSubmit = async (values: CompetitorFormValues) => {
    setErrorMessage(null);
    setCompetitors([]);
    setStatsData([]);
    setAdCreatives(null);
    setSelectedDomain('');
    setCompetitorsAttempted(false);

    try {
      const params = new URLSearchParams({
        domain: values.domain,
        countryCode: values.countryCode,
        timePeriod: values.timePeriod,
      });
      const res = await fetch(`/api/competitors?${params.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as CompetitorsResponse;
      setCompetitors(data.competitors || []);
      setStatsData(data.statsData || []);
      setSearchedCountry(values.countryCode);
      setCompetitorsAttempted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      setErrorMessage(message);
    }
  };

  const onFetchAdCreatives = async () => {
    if (!selectedDomain) {
      setErrorMessage('Please select a competitor domain first.');
      return;
    }

    setErrorMessage(null);
    setAdCreatives(null);
    setIsFetchingAds(true);

    try {
      const params = new URLSearchParams({
        domain: selectedDomain,
        adSource,
      });
      if (adSource === 'Facebook' && searchedCountry) {
        params.set('countryCode', searchedCountry);
      }
      const res = await fetch(`/api/ad-creatives?${params.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AdCreativesResponse;
      setAdCreatives(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      setErrorMessage(message);
    } finally {
      setIsFetchingAds(false);
    }
  };

  const isSubmittingCompetitors = competitorForm.formState.isSubmitting;

  return (
    <div className="space-y-8">
      {errorMessage && (
        <div
          ref={errorRef}
          className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="shrink-0 rounded p-0.5 text-red-600 hover:bg-red-100"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-[var(--color-cream-200)] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--color-ink-900)]">
          Competitor Search
        </h2>
        <p className="mt-1 text-sm text-[var(--color-ink-500)]">
          Enter a domain to discover competitors and their advertising
          strategies.
        </p>

        <form
          onSubmit={competitorForm.handleSubmit(onCompetitorSubmit)}
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          <label className="block">
            <span className={LABEL_CLASS}>Domain</span>
            <input
              type="text"
              placeholder="example.com"
              className={INPUT_CLASS}
              {...competitorForm.register('domain', {
                required: 'Domain is required',
              })}
            />
            {competitorForm.formState.errors.domain && (
              <span className="mt-1 block text-xs text-[var(--color-accent-red)]">
                {competitorForm.formState.errors.domain.message}
              </span>
            )}
          </label>

          <label className="block">
            <span className={LABEL_CLASS}>Country Code</span>
            <select
              className={INPUT_CLASS}
              {...competitorForm.register('countryCode', {
                required: 'Country Code is required',
              })}
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
            {competitorForm.formState.errors.countryCode && (
              <span className="mt-1 block text-xs text-[var(--color-accent-red)]">
                {competitorForm.formState.errors.countryCode.message}
              </span>
            )}
          </label>

          <label className="block">
            <span className={LABEL_CLASS}>Time Period</span>
            <select
              className={INPUT_CLASS}
              {...competitorForm.register('timePeriod', {
                required: 'Time Period is required',
              })}
            >
              <option value="">Select period</option>
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            {competitorForm.formState.errors.timePeriod && (
              <span className="mt-1 block text-xs text-[var(--color-accent-red)]">
                {competitorForm.formState.errors.timePeriod.message}
              </span>
            )}
          </label>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={isSubmittingCompetitors}
              className="inline-flex items-center justify-center rounded-full bg-[var(--color-coral-400)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-coral-500)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingCompetitors ? 'Fetching…' : 'Fetch Competitors'}
            </button>
          </div>
        </form>
      </section>

      {isSubmittingCompetitors && (
        <LoadingCard
          title="Pulling Competitor Intelligence"
          subtitle="Querying SpyFu for PPC competitors and per-domain stats…"
        />
      )}

      {!isSubmittingCompetitors &&
        competitorsAttempted &&
        statsData.length === 0 && (
          <section className="rounded-2xl border border-dashed border-[var(--color-cream-200)] bg-white p-8 text-center shadow-sm fade-in">
            <h3 className="text-base font-semibold text-[var(--color-ink-900)]">
              No competitors found
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--color-ink-700)]">
              SpyFu returned no PPC competitors for that domain in the
              selected country. Try a broader country (US/CA usually have the
              richest data) or check the domain spelling.
            </p>
          </section>
        )}

      {statsData.length > 0 && (
        <section className="rounded-2xl border border-[var(--color-cream-200)] bg-white p-6 shadow-sm fade-in">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-ink-900)]">
              Competitor Analysis Results
            </h2>
            <span className="rounded-full bg-[var(--color-coral-300)]/40 px-2 py-0.5 text-xs font-medium text-[var(--color-coral-500)]">
              {competitors.length} Competitors Found
            </span>
          </div>

          <div className="space-y-6">
            <StatsTable rows={statsData} />
            <StatsBarChart rows={statsData} />

            <hr className="border-[var(--color-cream-200)]" />

            <div>
              <h3 className="text-base font-semibold text-[var(--color-ink-900)]">
                Ad Creative Analysis
              </h3>
              <p className="mt-1 text-sm text-[var(--color-ink-500)]">
                Deep-dive into competitor ad creatives across Google and
                Facebook.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className={LABEL_CLASS}>Select Competitor</span>
                  <select
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="">Choose a competitor</option>
                    {competitors.map((c) => (
                      <option key={c.domain} value={c.domain}>
                        {c.domain}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className={LABEL_CLASS}>Ad Source</span>
                  <div className="mt-1 inline-flex rounded-full border border-[var(--color-cream-200)] bg-white p-1">
                    {(['Google', 'Facebook'] as const).map((src) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setAdSource(src)}
                        className={`rounded-full px-4 py-1 text-sm font-medium transition ${
                          adSource === src
                            ? 'bg-[var(--color-coral-400)] text-white'
                            : 'text-[var(--color-ink-700)] hover:bg-[var(--color-cream-100)]'
                        }`}
                      >
                        {src} Ads
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onFetchAdCreatives}
                disabled={isFetchingAds || !selectedDomain}
                className="mt-4 inline-flex items-center justify-center rounded-full bg-[var(--color-coral-400)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-coral-500)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFetchingAds ? 'Fetching Ad Creatives…' : 'Fetch Ad Creatives'}
              </button>
            </div>
          </div>
        </section>
      )}

      {isFetchingAds && (
        <LoadingCard
          title={`Fetching ${adSource} Ad Creatives`}
          subtitle={
            adSource === 'Google'
              ? 'Querying SerpAPI Google Ads Transparency Center…'
              : 'Querying Meta /ads_archive for matching ads…'
          }
        />
      )}

      {!isFetchingAds && adCreatives && (
        <section className="rounded-2xl border border-[var(--color-cream-200)] bg-white p-6 shadow-sm fade-in">
          <AdCreativesGrid data={adCreatives} />
        </section>
      )}

      {isFetchingAds && (
        <OperationOverlay
          label={`Fetching ${adSource} ad creatives…`}
          hint="This usually takes 5–20s depending on how many ads the source returns."
        />
      )}
    </div>
  );
}
