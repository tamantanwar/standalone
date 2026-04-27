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

export type FacebookAdCreative = {
  id: string;
  ad_creative_id?: string;
  page_id?: string;
  page_name?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  [key: string]: unknown;
};

export type AdCreativesResponse =
  | { adCreatives: GoogleAdCreative[]; adSource?: 'Google' }
  | { adCreatives: FacebookAdCreative[]; adSource?: 'Facebook' };

export type AdSource = 'Google' | 'Facebook';
