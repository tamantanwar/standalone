'use client';

import { useEffect, useRef, useState } from 'react';

import type {
  Ad,
  AdPreviewsResponse,
  AdsResponse,
  AuditResponse,
  CompareResponse,
  GeneratedAd,
  ImageOpResponse,
  ProcessPromptResponse,
  RankingType,
} from '@/lib/types';
import { bestAdImageUrl } from '@/lib/image-url';
import AdsList from '@/components/AdsList';
import AdsPreviewView from '@/components/AdsPreviewView';
import AuditResultsModal from '@/components/AuditResultsModal';
import CompareResultsModal from '@/components/CompareResultsModal';
import GeneratedAdsList from '@/components/GeneratedAdsList';
import ImageOpResultsModal from '@/components/ImageOpResultsModal';
import LoadingCard from '@/components/LoadingCard';
import OperationOverlay from '@/components/OperationOverlay';
import Spinner from '@/components/Spinner';

const RANKING_METRICS_BY_OBJECTIVE: Record<string, string[]> = {
  LINK_CLICKS: ['CTR', 'CPC', 'Clicks'],
  OUTCOME_SALES: ['ROAS', 'CPA', 'total_revenue'],
  OUTCOME_CONVERSIONS: ['ROAS', 'CPA', 'total_revenue'],
  OUTCOME_TRAFFIC: ['Impressions', 'Clicks', 'CTR'],
  OUTCOME_LEADS: ['Conversions', 'CPA'],
  OUTCOME_AWARENESS: ['Impressions', 'video_views'],
};

// Display label per metric — keep wire values stable (the backend ranks by
// the raw key) but show a friendlier name in the dropdown.
const METRIC_LABELS: Record<string, string> = {
  CTR: 'CTR',
  CPC: 'CPC',
  CPA: 'CPA',
  ROAS: 'ROAS',
  Clicks: 'Clicks',
  Impressions: 'Impressions',
  Conversions: 'Conversions',
  total_revenue: 'Total Revenue',
  video_views: 'Video Views',
};

const labelForMetric = (m: string): string => METRIC_LABELS[m] ?? m;

const OBJECTIVE_LABELS: Record<string, string> = {
  LINK_CLICKS: 'Link Clicks',
  OUTCOME_SALES: 'Sales',
  OUTCOME_CONVERSIONS: 'Conversions',
  OUTCOME_TRAFFIC: 'Traffic',
  OUTCOME_LEADS: 'Leads',
  OUTCOME_AWARENESS: 'Awareness',
};

const labelForObjective = (o: string): string => OBJECTIVE_LABELS[o] ?? o;

const SELECT_CLASS =
  'mt-1 block w-full rounded-md border border-[var(--color-cream-200)] bg-[var(--color-cream-50)] px-3 py-2 text-sm text-[var(--color-ink-900)] focus:border-[var(--color-accent-blue)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]/30 disabled:bg-[var(--color-cream-100)] disabled:text-[var(--color-ink-500)]';

const LABEL_CLASS = 'block text-xs font-medium text-[var(--color-ink-700)]';

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

  type AdView = 'cards' | 'previews';
  const [adView, setAdView] = useState<AdView>('cards');

  // Selection state for audit / compare / variant / edit operations.
  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set());
  const [opPrompt, setOpPrompt] = useState<string>('');
  const [auditData, setAuditData] = useState<AuditResponse | null>(null);
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [imageOpData, setImageOpData] = useState<{
    title: string;
    data: ImageOpResponse;
  } | null>(null);

  const [busyOp, setBusyOp] = useState<
    null | 'audit' | 'compare' | 'variant' | 'edit' | 'download' | 'process'
  >(null);

  const [nlPrompt, setNlPrompt] = useState<string>('');
  const [adsAttempted, setAdsAttempted] = useState(false);
  const [promptInvalid, setPromptInvalid] = useState(false);

  const errorRef = useRef<HTMLDivElement | null>(null);
  const promptInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (errorMessage && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errorMessage]);

  const toggleAdSelection = (adId: string) => {
    setSelectedAdIds((prev) => {
      const next = new Set(prev);
      if (next.has(adId)) next.delete(adId);
      else next.add(adId);
      return next;
    });
  };

  const clearSelection = () => setSelectedAdIds(new Set());

  const selectedAds = ads.filter((a) => a.ad_id && selectedAdIds.has(a.ad_id));

  const imageUrlsForAd = (ad: Ad): string | null => bestAdImageUrl(ad);

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
    setAuditData(null);
    setCompareData(null);
    setImageOpData(null);
    setAdView('cards');
    setAdsAttempted(false);
    clearSelection();

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
      setAdsAttempted(true);
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

  const handleViewChange = (next: AdView) => {
    setAdView(next);
    if (next === 'previews' && !previews && !isLoadingPreviews) {
      void fetchPreviews();
    }
  };

  const selectedImageUrls = (): string[] =>
    selectedAds
      .map((a) => imageUrlsForAd(a))
      .filter((u): u is string => Boolean(u));

  const requireImages = (count: 'one-or-more' | 'exactly-two'): string[] | null => {
    const urls = selectedImageUrls();
    if (count === 'one-or-more' && urls.length === 0) {
      setErrorMessage(
        'Select at least one ad with an image. Ads need a stored or displayable image URL.',
      );
      return null;
    }
    if (count === 'exactly-two' && urls.length !== 2) {
      setErrorMessage(
        `Compare needs exactly 2 selected creatives — you have ${urls.length}.`,
      );
      return null;
    }
    return urls;
  };

  const adIdsForSelection = (): string[] =>
    selectedAds.map((a) => a.ad_id).filter((id): id is string => Boolean(id));

  const runAudit = async () => {
    const imageUrls = requireImages('one-or-more');
    if (!imageUrls) return;

    setErrorMessage(null);
    setAuditData(null);
    setBusyOp('audit');
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls,
          videoUrls: [],
          prompt: opPrompt || undefined,
          adIds: adIdsForSelection(),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setAuditData((await res.json()) as AuditResponse);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setBusyOp(null);
    }
  };

  const runCompare = async () => {
    const imageUrls = requireImages('exactly-two');
    if (!imageUrls) return;

    setErrorMessage(null);
    setCompareData(null);
    setBusyOp('compare');
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls, prompt: opPrompt || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setCompareData((await res.json()) as CompareResponse);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setBusyOp(null);
    }
  };

  const runImageOp = async (kind: 'variant' | 'edit') => {
    const imageUrls = requireImages('one-or-more');
    if (!imageUrls) return;
    if (kind === 'edit' && opPrompt.trim().length < 3) {
      setErrorMessage(
        'Edit Image requires a prompt (≥3 chars) describing the change.',
      );
      setPromptInvalid(true);
      promptInputRef.current?.focus();
      return;
    }
    if (!accountName) {
      setErrorMessage('Pick an account before running variant or edit.');
      return;
    }

    setErrorMessage(null);
    setImageOpData(null);
    setPromptInvalid(false);
    setBusyOp(kind);
    try {
      const path = kind === 'variant' ? '/api/generate-variant' : '/api/edit-image';
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls,
          prompt: opPrompt || undefined,
          accountName,
          adId: adIdsForSelection()[0],
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ImageOpResponse;
      setImageOpData({
        title: kind === 'variant' ? 'Generated Variant' : 'Edited Image',
        data,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setBusyOp(null);
    }
  };

  const runDownloadZip = async () => {
    const imageUrls = requireImages('one-or-more');
    if (!imageUrls) return;

    setErrorMessage(null);
    setBusyOp('download');
    try {
      const res = await fetch('/api/download-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ad_preview_images.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setBusyOp(null);
    }
  };

  const runProcessPrompt = async () => {
    if (nlPrompt.trim().length < 3) {
      setErrorMessage('Type a prompt (≥3 chars) for the AI router.');
      return;
    }
    const imageUrls = selectedImageUrls();
    setErrorMessage(null);
    setBusyOp('process');
    try {
      const res = await fetch('/api/process-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: nlPrompt,
          imageUrls,
          videoUrls: [],
          accountName: accountName || undefined,
          adId: adIdsForSelection()[0],
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ProcessPromptResponse;
      // Route the result into the appropriate modal based on the action.
      switch (data.action) {
        case 'audit':
          setAuditData({ results: data.results } as AuditResponse);
          break;
        case 'compare':
          setCompareData({ results: data.results } as CompareResponse);
          break;
        case 'generate-variant':
          setImageOpData({
            title: 'Generated Variant',
            data: { results: data.results } as ImageOpResponse,
          });
          break;
        case 'edit-image':
          setImageOpData({
            title: 'Edited Image',
            data: { results: data.results } as ImageOpResponse,
          });
          break;
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setBusyOp(null);
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
          Ad Filters
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block">
            <span className={LABEL_CLASS}>Account</span>
            <select
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className={SELECT_CLASS}
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
            <span className={LABEL_CLASS}>Campaign Objective</span>
            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={!accountName}
              className={SELECT_CLASS}
            >
              <option value="">Select objective</option>
              {objectives.map((o) => (
                <option key={o} value={o}>
                  {labelForObjective(o)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={LABEL_CLASS}>Ranking Metric</span>
            <select
              value={rankingMetric}
              onChange={(e) => setRankingMetric(e.target.value)}
              disabled={availableMetrics.length === 0}
              className={SELECT_CLASS}
            >
              {availableMetrics.length === 0 ? (
                <option value="">—</option>
              ) : (
                availableMetrics.map((m) => (
                  <option key={m} value={m}>
                    {labelForMetric(m)}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block">
            <span className={LABEL_CLASS}>Ranking Type</span>
            <select
              value={rankingType}
              onChange={(e) => setRankingType(e.target.value as RankingType)}
              className={SELECT_CLASS}
            >
              <option value="best">Best</option>
              <option value="least">Least</option>
            </select>
          </label>

          {locations.length > 0 && (
            <label className="block">
              <span className={LABEL_CLASS}>Location</span>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className={SELECT_CLASS}
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
              <span className={LABEL_CLASS}>Promotion</span>
              <select
                value={promotion}
                onChange={(e) => setPromotion(e.target.value)}
                className={SELECT_CLASS}
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
              className="accent-[var(--color-coral-400)]"
            />
            <span className="text-[var(--color-ink-700)]">
              Only ads with title and body
            </span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={fetchAds}
            disabled={!accountName || !objective || isLoadingAds}
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-coral-400)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-coral-500)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingAds ? 'Loading…' : 'Fetch Top Ads'}
          </button>

          <button
            type="button"
            onClick={generateAi}
            disabled={ads.length === 0 || isGeneratingAi}
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-accent-blue)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isGeneratingAi ? 'Generating…' : 'Generate AI Variations'}
          </button>
        </div>
      </section>

      {isLoadingAds && (
        <LoadingCard
          title="Analyzing Ad Performance"
          subtitle="Querying BigQuery, ranking ads, and pulling enrichment data…"
        />
      )}

      {!isLoadingAds && adsAttempted && ads.length === 0 && (
        <section className="rounded-2xl border border-dashed border-[var(--color-cream-200)] bg-white p-8 text-center shadow-sm fade-in">
          <h3 className="text-base font-semibold text-[var(--color-ink-900)]">
            No ads matched
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--color-ink-700)]">
            {rankingMetric === 'CPA' && rankingType === 'best' ? (
              <>
                Ranking by{' '}
                <code className="rounded bg-[var(--color-cream-100)] px-1.5 py-0.5">
                  CPA (best)
                </code>{' '}
                drops ads with zero recorded conversions
                (<code className="rounded bg-[var(--color-cream-100)] px-1.5 py-0.5">action_purchase = 0</code>) — it looks like
                no ad in this account/objective has any purchases yet, so
                there&apos;s nothing to rank.
              </>
            ) : rankingMetric === 'CPA' ? (
              <>
                No ads with a non-zero CPA were returned. Switch ranking type to{' '}
                <em>least</em> to see all ads sorted by spend, or pick a
                different metric.
              </>
            ) : (
              <>
                No ads returned for this account + objective combination.
                Double-check the campaign objective or try a different account.
              </>
            )}
          </p>
          <p className="mx-auto mt-3 max-w-xl text-xs text-[var(--color-ink-500)]">
            Tips: try a different ranking metric (e.g.{' '}
            <code className="rounded bg-[var(--color-cream-100)] px-1.5 py-0.5">
              ROAS
            </code>{' '}
            or{' '}
            <code className="rounded bg-[var(--color-cream-100)] px-1.5 py-0.5">
              total_revenue
            </code>
            ), or untoggle &ldquo;Only ads with title and body&rdquo; if it&apos;s on.
          </p>
        </section>
      )}

      {!isLoadingAds && ads.length > 0 && (
        <section className="rounded-2xl border border-[var(--color-cream-200)] bg-white p-6 shadow-sm fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-lg font-semibold text-[var(--color-ink-900)]">
                Top Ads ({ads.length})
              </h2>
              <p className="text-sm text-[var(--color-ink-500)]">
                Sorted by{' '}
                <code className="rounded bg-[var(--color-cream-100)] px-1.5 py-0.5 text-[var(--color-ink-700)]">
                  {labelForMetric(rankingMetric)}
                </code>{' '}
                ({rankingType})
              </p>
            </div>

            <div className="inline-flex rounded-full border border-[var(--color-cream-200)] bg-white p-1">
              <button
                type="button"
                onClick={() => handleViewChange('cards')}
                className={`rounded-full px-4 py-1 text-sm font-medium transition ${
                  adView === 'cards'
                    ? 'bg-[var(--color-coral-400)] text-white'
                    : 'text-[var(--color-ink-700)] hover:bg-[var(--color-cream-100)]'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => handleViewChange('previews')}
                disabled={isLoadingPreviews}
                className={`flex items-center gap-1 rounded-full px-4 py-1 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  adView === 'previews'
                    ? 'bg-[var(--color-coral-400)] text-white'
                    : 'text-[var(--color-ink-700)] hover:bg-[var(--color-cream-100)]'
                }`}
              >
                {isLoadingPreviews && (
                  <Spinner size={14} className="text-current" />
                )}
                Ad Previews
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3 rounded-xl border border-dashed border-[var(--color-cream-200)] bg-[var(--color-cream-50)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-[var(--color-ink-700)]">
                <span className="font-semibold text-[var(--color-ink-900)]">
                  {selectedAdIds.size}
                </span>{' '}
                selected
                {selectedAdIds.size > 0 && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="ml-2 text-xs text-[var(--color-coral-500)] underline-offset-2 hover:underline"
                  >
                    clear
                  </button>
                )}
              </div>
              <input
                ref={promptInputRef}
                type="text"
                value={opPrompt}
                onChange={(e) => {
                  setOpPrompt(e.target.value);
                  if (promptInvalid && e.target.value.trim().length >= 3) {
                    setPromptInvalid(false);
                  }
                }}
                placeholder="Optional context for audit/compare; required for edit (≥3 chars)"
                className={`min-w-0 flex-1 rounded-full border bg-white px-4 py-1.5 text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-500)] focus:outline-none focus:ring-2 ${
                  promptInvalid
                    ? 'border-[var(--color-accent-red)] focus:border-[var(--color-accent-red)] focus:ring-[var(--color-accent-red)]/30'
                    : 'border-[var(--color-cream-200)] focus:border-[var(--color-accent-blue)] focus:ring-[var(--color-accent-blue)]/30'
                }`}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={runAudit}
                disabled={selectedAdIds.size === 0 || busyOp !== null}
                className="rounded-full bg-[var(--color-coral-400)] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--color-coral-500)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyOp === 'audit' ? 'Auditing…' : 'Audit Selected'}
              </button>
              <button
                type="button"
                onClick={runCompare}
                disabled={selectedAdIds.size !== 2 || busyOp !== null}
                className="rounded-full border border-[var(--color-coral-400)] px-4 py-1.5 text-sm font-semibold text-[var(--color-coral-500)] transition hover:bg-[var(--color-cream-100)] disabled:cursor-not-allowed disabled:opacity-60"
                title={
                  selectedAdIds.size === 2
                    ? 'Compare the 2 selected creatives'
                    : 'Compare needs exactly 2 selected creatives'
                }
              >
                {busyOp === 'compare' ? 'Comparing…' : 'Compare 2'}
              </button>
              <button
                type="button"
                onClick={() => runImageOp('variant')}
                disabled={selectedAdIds.size === 0 || busyOp !== null}
                className="rounded-full border border-[var(--color-cream-200)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--color-ink-900)] transition hover:bg-[var(--color-cream-100)] disabled:cursor-not-allowed disabled:opacity-60"
                title="Generate a new visual variant via gpt-image-2"
              >
                {busyOp === 'variant' ? 'Generating…' : 'Generate Variant'}
              </button>
              <button
                type="button"
                onClick={() => runImageOp('edit')}
                disabled={selectedAdIds.size === 0 || busyOp !== null}
                className="rounded-full border border-[var(--color-cream-200)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--color-ink-900)] transition hover:bg-[var(--color-cream-100)] disabled:cursor-not-allowed disabled:opacity-60"
                title={
                  selectedAdIds.size === 0
                    ? 'Select at least one ad first'
                    : 'Edit the selected images using the prompt (will prompt you if missing)'
                }
              >
                {busyOp === 'edit' ? 'Editing…' : 'Edit Image'}
              </button>
              <button
                type="button"
                onClick={runDownloadZip}
                disabled={selectedAdIds.size === 0 || busyOp !== null}
                className="ml-auto rounded-full border border-[var(--color-cream-200)] bg-white px-4 py-1.5 text-sm font-semibold text-[var(--color-ink-900)] transition hover:bg-[var(--color-cream-100)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyOp === 'download' ? 'Zipping…' : 'Download as ZIP'}
              </button>
            </div>

            <p className="text-xs text-[var(--color-ink-500)]">
              <span className="font-medium text-[var(--color-ink-700)]">
                Audit
              </span>{' '}
              accepts any selection · <span className="font-medium text-[var(--color-ink-700)]">Compare</span> needs exactly 2 · <span className="font-medium text-[var(--color-ink-700)]">Variant</span> uses the prompt as guidance (optional) · <span className="font-medium text-[var(--color-ink-700)]">Edit</span> requires a prompt (≥3 chars). Variant/Edit save the result to GCS and update the ad&apos;s{' '}
              <code className="mx-1 rounded bg-[var(--color-cream-100)] px-1 py-0.5">
                stored_image_url
              </code>{' '}
              in BigQuery.
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--color-accent-blue)]/30 bg-[var(--color-accent-blue)]/5 p-4">
            <h3 className="text-sm font-semibold text-[var(--color-accent-blue)]">
              Ask the AI
            </h3>
            <p className="mt-1 text-xs text-[var(--color-ink-700)]">
              Type what you want and the backend will route the request — e.g.{' '}
              <em>&ldquo;audit these creatives&rdquo;</em>,{' '}
              <em>&ldquo;compare them&rdquo;</em>,{' '}
              <em>&ldquo;edit: make the headline blue&rdquo;</em>,{' '}
              <em>&ldquo;generate a winter variant&rdquo;</em>.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={nlPrompt}
                onChange={(e) => setNlPrompt(e.target.value)}
                placeholder="e.g. audit these and suggest 3 A/B tests"
                className="min-w-0 flex-1 rounded-full border border-[var(--color-cream-200)] bg-white px-4 py-1.5 text-sm text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-500)] focus:border-[var(--color-accent-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]/30"
              />
              <button
                type="button"
                onClick={runProcessPrompt}
                disabled={busyOp !== null}
                className="rounded-full bg-[var(--color-accent-blue)] px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyOp === 'process' ? 'Working…' : 'Run'}
              </button>
            </div>
          </div>

          <div className="mt-4">
            {adView === 'cards' && (
              <AdsList
                ads={ads}
                objective={objective}
                selected={selectedAdIds}
                onToggle={toggleAdSelection}
              />
            )}

            {adView === 'previews' &&
              (isLoadingPreviews ? (
                <LoadingCard
                  title="Fetching Ad Previews from Meta"
                  subtitle="Pulling Mobile Feed, Marketplace, Right Column, Story, and Instant Article previews for every ad…"
                />
              ) : previews ? (
                <AdsPreviewView
                  ads={ads}
                  previews={previews}
                  selected={selectedAdIds}
                  onToggle={toggleAdSelection}
                />
              ) : (
                <p className="text-sm text-[var(--color-ink-500)]">
                  No previews loaded yet.
                </p>
              ))}
          </div>
        </section>
      )}

      {generatedAds && (
        <section className="rounded-2xl border border-[var(--color-cream-200)] bg-white p-6 shadow-sm fade-in">
          <h2 className="text-lg font-semibold text-[var(--color-ink-900)]">
            AI-Generated Variations
          </h2>
          <p className="mt-1 text-sm text-[var(--color-ink-500)]">
            5 GPT-5.4 variations based on your top ads&apos; historical titles
            and bodies.
          </p>
          <div className="mt-4">
            <GeneratedAdsList ads={generatedAds} />
          </div>
        </section>
      )}

      {auditData && (
        <AuditResultsModal
          data={auditData}
          onClose={() => setAuditData(null)}
        />
      )}

      {compareData && (
        <CompareResultsModal
          data={compareData}
          onClose={() => setCompareData(null)}
        />
      )}

      {imageOpData && (
        <ImageOpResultsModal
          title={imageOpData.title}
          data={imageOpData.data}
          onClose={() => setImageOpData(null)}
          busy={busyOp !== null}
          onRunVariant={() => runImageOp('variant')}
          onRunEdit={() => runImageOp('edit')}
          onRunAudit={() => runAudit()}
        />
      )}

      {busyOp && busyOp !== 'download' && (
        <OperationOverlay
          label={
            busyOp === 'audit'
              ? 'Auditing creatives…'
              : busyOp === 'compare'
                ? 'Comparing creatives…'
                : busyOp === 'variant'
                  ? 'Generating new variant…'
                  : busyOp === 'edit'
                    ? 'Editing image…'
                    : 'Routing your prompt…'
          }
          hint="GPT-5.4 vision and gpt-image-2 can take 30–90s per creative. Please wait."
        />
      )}
    </div>
  );
}
