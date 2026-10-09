import type { DetailMetric } from './detail-presentation';

/** Immutable public assets captured from the same snapshot as the page. */
export interface StaticDetailAssets {
  prices?: string;
  marketcap?: string;
  metrics?: Partial<Record<DetailMetric, string>>;
  companyHistory?: string;
  memberMarketcaps?: Record<string, string>;
  memberPrices?: Record<string, string>;
}

export interface StaticTableAsset {
  schemaVersion: 1;
  columns: string[];
  rows: unknown[][];
}
