export type Ad = {
  ad_id?: string;
  ad_name?: string | null;
  account_name?: string | null;
  campaign_objective?: string | null;
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  display_image_url?: string | null;
  stored_image_url?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  spend?: number | null;
  action_purchase?: number | null;
  action_value_purchase?: number | null;

  // Extracted from ad_name
  campaign_name?: string | null;
  channel_name?: string | null;
  location?: string | null;
  audience?: string | null;
  promotion?: string | null;
  devices?: string | null;
  ad_type?: string | null;

  // Computed metrics (objective-dependent)
  CTR?: number;
  CPC?: number;
  Clicks?: number;
  Impressions?: number;
  Conversions?: number;
  ROAS?: number;
  CPA?: number;
  total_revenue?: number;
  video_views?: number;
  reach?: number;

  [key: string]: unknown;
};

export type AdsResponse = {
  ads: Ad[];
  locations: string[];
  promotions: string[];
};

export type AdPreview = {
  ad_format: string;
  preview: { body: string } | null;
  error: string | null;
};

export type AdPreviewsResponse = Record<string, AdPreview[]>;

export type GeneratedAd = {
  title: string;
  body: string;
  score: string;
};

export type GenerateAiAdsResponse = {
  ai_ads: GeneratedAd[];
};

export type RankingType = 'best' | 'least';

// ---------- audit ----------

export type AuditAbTestSuggestion = {
  type?: string;
  suggestion?: string;
  idea?: string;
  testIdea?: string;
};

export type AuditDetectedElement = {
  label?: string;
  text_content?: string;
  box?: [number, number, number, number];
  confidence?: number;
  attributes?: Record<string, unknown>;
};

export type AuditAnalysisItem = {
  name?: string;
  analysis?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  metrics?: Record<string, unknown>;
  detectedElements?: AuditDetectedElement[];
};

export type AuditAnalysisSection = {
  title?: string;
  category?: string;
  items?: AuditAnalysisItem[];
};

export type AuditOverallEffectiveness = {
  strengths?: string[];
  areasForVisualImprovement?: string[];
  abTestSuggestionsVisual?: AuditAbTestSuggestion[];
  predictedVisualPerformance?: Record<string, unknown>;
  targetAudienceVisualFit?: Record<string, number>;
};

export type AuditDetail = {
  overallVisualScore?: number;
  visualSummary?: string;
  visualAnalysisSections?: AuditAnalysisSection[];
  overallVisualEffectiveness?: AuditOverallEffectiveness;
  visualConclusion?: string;
  // Errors / fallback
  error?: string;
  rawContent?: string;
};

export type AuditResultEntry = {
  imageUrl?: string;
  videoUrl?: string;
  result?: AuditDetail;
  error?: string;
  suggestion?: string;
  operation?: string;
};

export type AuditResponse = {
  results: AuditResultEntry[];
};

// ---------- compare ----------

export type CompareDetail = {
  comparisonSummary?: string;
  visualSimilarities?: string[];
  visualDifferences?: string[];
  image1Analysis?: AuditDetail;
  image2Analysis?: AuditDetail;
  recommendation?: string;
  abTestSuggestionsVisual?: AuditAbTestSuggestion[];
  error?: string;
  rawContent?: string;
};

export type CompareResultEntry = {
  imageUrl?: string;
  imageUrls?: string[];
  result?: CompareDetail;
  error?: string;
  operation?: string;
};

export type CompareResponse = {
  results: CompareResultEntry[];
};

// ---------- generate-variant / edit-image ----------

export type ImageOpResultEntry = {
  imageUrl?: string;
  // base64 PNG (no data: prefix from backend; we'll add it on the frontend)
  image?: string;
  gcsUrl?: string | null;
  error?: string;
  operation?: string;
};

export type ImageOpResponse = {
  results: ImageOpResultEntry[];
};

// ---------- process-prompt ----------

export type ProcessPromptAction =
  | 'audit'
  | 'compare'
  | 'generate-variant'
  | 'edit-image';

export type ProcessPromptResponse = {
  action: ProcessPromptAction;
  // The shape of `results` depends on action — we'll switch by action client-side.
  results: AuditResultEntry[] | CompareResultEntry[] | ImageOpResultEntry[];
};
