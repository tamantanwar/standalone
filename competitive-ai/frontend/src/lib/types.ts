export type Competitor = {
  domain: string;
  [key: string]: unknown;
};

export type DomainStat = {
  domain: string;
  searchMonth: string | number;
  searchYear: number | string;
  averageAdRank?: number;
  strength?: number;
  monthlyBudget?: number;
  totalAdsPurchased?: number;
  [key: string]: unknown;
};

export type CompetitorsResponse = {
  competitors: Competitor[];
  statsData: DomainStat[];
};

export type GoogleAdCreative = {
  ad_creative_id: string;
  image?: string;
  advertiser?: string;
  target_domain?: string;
  format?: string;
  total_days_shown?: number;
  first_shown?: number;
  last_shown?: number;
  width?: number;
  height?: number;
  details_link?: string;
  link?: string;
  [key: string]: unknown;
};

export type MetaRange = {
  lower_bound?: string;
  upper_bound?: string;
};

export type FacebookAdCreative = {
  id: string;
  ad_creative_id?: string;
  page_id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_creative_link_descriptions?: string[];
  ad_creative_link_captions?: string[];
  ad_snapshot_url?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  publisher_platforms?: string[];
  languages?: string[];
  bylines?: string;
  currency?: string;
  impressions?: MetaRange;
  spend?: MetaRange;
  estimated_audience_size?: MetaRange;
  /** 'page' = competitor's own Facebook page; 'keyword' = text match (may be other advertisers). */
  match_type?: 'page' | 'keyword';
  [key: string]: unknown;
};

export type LinkedInAdCreative = {
  id: string;
  ad_type?: string;
  advertiser?: { name?: string; thumbnail?: string };
  content?: { headline?: string; image?: string; cta?: string };
  link?: string;
  /** 'page' = the competitor's own LinkedIn page; 'keyword' = related advertiser. */
  match_type?: 'page' | 'keyword';
  [key: string]: unknown;
};

export type AdCreativesResponse =
  | { adCreatives: GoogleAdCreative[]; adSource?: 'Google' }
  | { adCreatives: FacebookAdCreative[]; adSource?: 'Facebook' }
  | { adCreatives: LinkedInAdCreative[]; adSource?: 'LinkedIn' };

export type AdSource = 'Google' | 'Facebook' | 'LinkedIn';

/** Facebook only: ads running now, or running now plus past ads. */
export type AdStatus = 'ACTIVE' | 'ALL';
