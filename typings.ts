export type Company = {
  companyId: string;
  name: string;
  korName: string;
  Address?: string;
  korAddress?: string;
  country?: string;
  type?: string;
  tel?: string;
  fax?: string;
  postalCode?: string;
  homepage?: string;
  industry?: string;
  establishedDate?: Date;
  marketcap?: number;
  securities: Security[];
};

export type Security = {
  companyId: string;
  securityId: string;
  ticker: string;
  name: string | null;
  korName: string | null;
  exchange: string | null;
  type: string | null;
  prices: Price[];
  marketcaps: Marketcap[];
  marketcap: number;
  marketcapDate: Date;
  shares: number;
  sharesDate: Date;
  // Financial metrics
  per: number | null;
  perDate: Date | null;
  pbr: number | null;
  pbrDate: Date | null;
  eps: number | null;
  epsDate: Date | null;
  dps: number | null;
  dpsDate: Date | null;
  bps: number | null;
  bpsDate: Date | null;
  div: number | null;
  divDate: Date | null;
  createdAt: Date;
  updatedAt: Date;

  country?: string;
};

export type Marketcap = {
  id: number;
  securityId: string | null;
  date: Date;
  ticker: string;
  name: string | null;
  korName: string | null;
  exchange: string;
  marketcap: number;
  volume: number;
  transaction: number | null;
  shares: number;
  createdAt: Date;
  updatedAt: Date;
};

export type Price = {
  id: number;
  securityId: string;
  date: Date;
  ticker: string;
  name: string | null;
  korName: string | null;
  exchange: string | null;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint;
  fvolume: number | null;
  transaction: bigint | null;
  rate: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SearchPriceResults = {
  page: number;
  prices: Price[];
  total_pages: number;
  total_results: number;
};
