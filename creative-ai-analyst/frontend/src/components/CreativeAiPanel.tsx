'use client';

import { useEffect, useState } from 'react';

import type {
  Ad,
  AdPreviewsResponse,
  AdsResponse,
  GeneratedAd,
  RankingType,
} from '@/lib/types';
import AdsList from '@/components/AdsList';
import AdPreviewsModal from '@/components/AdPreviewsModal';
import GeneratedAdsList from '@/components/GeneratedAdsList';

const RANKING_METRICS_BY_OBJECTIVE: Record<string, string[]> = {
  LINK_CLICKS: ['CTR', 'CPC', 'Clicks'],
  OUTCOME_SALES: ['ROAS', 'CPA', 'total_revenue'],
  OUTCOME_CONVERSIONS: ['ROAS', 'CPA', 'total_revenue'],
};

export default function CreativeAiPanel() {
  // Selectors
  const [accounts, setAccounts] = useState<string[]>([]);
  const [accountName, setAccountName] = useState<string>('');
  const [objectives, setObjectives] = useState<string[]>([]);
  const [objective, setObjective] = useState<string>('');

  // Filters
  const [rankingMetric, setRankingMetric] = useState<string>('');
  const [rankingType, setRankingType] = useState<RankingType>('best');
  const [adsWithTitle, setAdsWithTitle] = useState<boolean>(false);
  const [location, setLocation] = useState<string>('');
  const [promotion, setPromotion] = useState<string>('');

  // Results
  const [ads, setAds] = useState<Ad[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [promotions, setPromotions] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isLoadingAds, setIsLoadingAds] = useState(false);
  const [isLoadingPreviews, setIsLoadingPreviews] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const [previews, setPreviews] = useState<AdPreviewsResponse | null>(null);
  const [generatedAds, setGeneratedAds] = useState<GeneratedAd[] | null>(null);

  // Fetch accounts on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/accounts');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as string[];
        setAccounts(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        setErrorMessage(`Failed to load accounts: ${message}`);
      }
    })();
  }, []);

  // Fetch objectives when account changes
  useEffect(() => {
    if (!accountName) {
      setObjectives([]);
      setObjective('');
      return;
    }
    void (async () => {
      try {
        const res = await fetch(
          `/api/campaign-objectives?accountName=${encodeURIComponent(accountName)}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as string[];
        setObjectives(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        setErrorMessage(`Failed to load objectives: ${message}`);
      }
    })();
  }, [accountName]);

  // When objective changes, reset ranking metric to first available
  useEffect(() => {
    const metrics = RANKING_METRICS_BY_OBJECTIVE[objective] ?? [];
    setRankingMetric(metrics[0] ?? '');
    setLocation('');
    setPromotion('');
  }, [objective]);

  const fetchAds = async () => {
    setErrorMessage(null);
    setIsLoadingAds(true);
    setAds([]);
    setPreviews(null);
    setGeneratedAds(null);

    try {
      const params = new URLSearchParams({
        accountName,
        objective,
      });
      if (rankingMetric) params.set('rankingMetric', rankingMetric);
      if (rankingType) params.set('rankingType', rankingType);
      if (adsWithTitle) params.set('adsWithTitle', 'true');
      if (location) params.set('location', location);
      if (promotion) params.set('promotion', promotion);

      const res = await fetch(`/api/ads?${params.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AdsResponse;
      setAds(data.ads);
      setLocations(data.locations);
      setPromotions(data.promotions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      setErrorMessage(message);
    } finally {
      setIsLoadingAds(false);
    }
  };

  const fetchPreviews = async () => {
    if (ads.length === 0) return;
    setErrorMessage(null);
    setIsLoadingPreviews(true);

    try {
      const res = await fetch('/api/ad-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ads: ads
            .filter((a) => a.ad_id)
            .map((a) => ({ ad_id: a.ad_id as string })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AdPreviewsResponse;
      setPreviews(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      setErrorMessage(message);
    } finally {
      setIsLoadingPreviews(false);
    }
  };

  const generateAi = async () => {
    if (ads.length === 0) return;
    setErrorMessage(null);
    setIsGeneratingAi(true);
    setGeneratedAds(null);

    try {
      const res = await fetch('/api/generate-ai-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ads,
          objective,
          location: location || undefined,
          promotion: promotion || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { ai_ads: GeneratedAd[] };
      setGeneratedAds(data.ai_ads);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      setErrorMessage(message);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const availableMetrics = RANKING_METRICS_BY_OBJECTIVE[objective] ?? [];

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-800">Ad Filters</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block">
            <span className="block text-xs font-medium text-zinc-700">
              Account
            </span>
            <select
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-zinc-700">
              Campaign Objective
            </span>
            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={!accountName}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-zinc-100"
            >
              <option value="">Select objective</option>
              {objectives.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-zinc-700">
              Ranking Metric
            </span>
            <select
              value={rankingMetric}
              onChange={(e) => setRankingMetric(e.target.value)}
              disabled={availableMetrics.length === 0}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-zinc-100"
            >
              {availableMetrics.length === 0 ? (
                <option value="">—</option>
              ) : (
                availableMetrics.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-zinc-700">
              Ranking Type
            </span>
            <select
              value={rankingType}
              onChange={(e) => setRankingType(e.target.value as RankingType)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="best">Best</option>
              <option value="least">Least</option>
            </select>
          </label>

          {locations.length > 0 && (
            <label className="block">
              <span className="block text-xs font-medium text-zinc-700">
                Location
              </span>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All locations</option>
                {locations.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}

          {promotions.length > 0 && (
            <label className="block">
              <span className="block text-xs font-medium text-zinc-700">
                Promotion
              </span>
              <select
                value={promotion}
                onChange={(e) => setPromotion(e.target.value)}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All promotions</option>
                {promotions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={adsWithTitle}
              onChange={(e) => setAdsWithTitle(e.target.checked)}
            />
            <span className="text-zinc-700">Only ads with title and body</span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={fetchAds}
            disabled={!accountName || !objective || isLoadingAds}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingAds ? 'Loading…' : 'Fetch Top Ads'}
          </button>

          <button
            type="button"
            onClick={fetchPreviews}
            disabled={ads.length === 0 || isLoadingPreviews}
            className="inline-flex items-center justify-center rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingPreviews ? 'Loading previews…' : 'Get Ad Previews'}
          </button>

          <button
            type="button"
            onClick={generateAi}
            disabled={ads.length === 0 || isGeneratingAi}
            className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingAi ? 'Generating…' : 'Generate AI Variations'}
          </button>
        </div>
      </section>

      {ads.length > 0 && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm fade-in">
          <h2 className="text-lg font-semibold text-zinc-800">
            Top Ads ({ads.length})
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Sorted by{' '}
            <code className="rounded bg-zinc-100 px-1">{rankingMetric}</code>{' '}
            ({rankingType}).
          </p>
          <div className="mt-4">
            <AdsList ads={ads} objective={objective} />
          </div>
        </section>
      )}

      {generatedAds && (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm fade-in">
          <h2 className="text-lg font-semibold text-zinc-800">
            AI-Generated Variations
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            5 GPT-4o variations based on your top ads' historical titles and bodies.
          </p>
          <div className="mt-4">
            <GeneratedAdsList ads={generatedAds} />
          </div>
        </section>
      )}

      {previews && (
        <AdPreviewsModal
          previews={previews}
          onClose={() => setPreviews(null)}
        />
      )}
    </div>
  );
}
