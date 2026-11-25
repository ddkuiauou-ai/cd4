import type { DetailMetric } from './detail-presentation';

/** Immutable public assets captured from the same snapshot as the page. */
export interface StaticDetailAssets {
  yearly?: {
    prices?: YearlyHistory;
    marketcap?: YearlyHistory;
    companyHistory?: YearlyHistory;
    metrics?: Partial<Record<DetailMetric, YearlyHistory>>;
  };
  perHistory?: { metric: YearlyHistory; prices: YearlyHistory };
  prices?: string;
  marketcap?: string;
  metrics?: Partial<Record<DetailMetric, string>>;
  historyCutoff?: string;
  listingMetricAvailability?: Array<{ periodId: string; metrics: DetailMetric[] }>;
  companyHistory?: string;
  memberMarketcaps?: Record<string, string>;
  memberPrices?: Record<string, string>;
}

export type YearlyHistory = {
  archive?: string;
  current?: string;
  currentStart?: string;
  archiveDates?: [string, string];
  currentDates?: [string, string];
  pair?: [string, string];
  latestDate?: string;
  warmupThrough?: string;
};

export interface StaticTableAsset {
  schemaVersion: 1;
  columns: string[];
  rows: unknown[][];
}
