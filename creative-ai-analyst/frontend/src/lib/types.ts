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
  ROAS?: number;
  CPA?: number;
  total_revenue?: number;

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
