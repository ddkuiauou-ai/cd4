import type * as schema from '@/db/schema-postgres';
import type { DataDTO } from '../data/dto';
import { escapeCsvValue } from './ranking';

const metrics = {
  marketcap: '시가총액', per: 'PER', pbr: 'PBR', eps: 'EPS', bps: 'BPS', div: '배당수익률', dps: '주당배당금',
} as const;
export type MarketCsvMetric = keyof typeof metrics;
export const marketCsvMetrics = Object.keys(metrics) as MarketCsvMetric[];
const header = [
  '기준일', '종목 ID', '종목코드', '거래소', '종목명', '종목 구분', '거래일', '시가', '고가', '저가', '종가', '거래량', '거래 상태',
  ...marketCsvMetrics.flatMap(metric => ['값', '관측일', '상태', '종목 순위', '순위 기준일', '순위 상태'].map(label => `${metrics[metric]} ${label}`)),
];

type Security = typeof schema.security.$inferSelect;
type CanonicalRank = { rankDate: string | null; currentRank: number | null; rankingState: string | null };
type Price = DataDTO<Pick<typeof schema.price.$inferSelect, 'securityId' | 'ticker' | 'exchange' | 'date' | 'open' | 'high' | 'low' | 'close' | 'volume'>>;
type SecurityValues = Pick<DataDTO<Security>, 'securityId' | 'ticker' | 'exchange' | 'korName' | 'name' | 'type'
  | MarketCsvMetric | `${MarketCsvMetric}Date` | `${MarketCsvMetric}State`>;
export type MarketCsvRow = {
  security: SecurityValues;
  current: boolean;
  price: Price | undefined;
  ranks: Partial<Record<MarketCsvMetric, CanonicalRank>>;
};
export type MarketCsvMetadata = { date: string; rowCount: number; url: string };
export const MARKET_CSV_INPUT = 'data/market-download.csv';
// Next's export requires one parameter even for a missing publication.
export const MARKET_CSV_EMPTY_PARAM = '_unpublished';

export function marketCsvMetadata(date: string, rowCount: number): MarketCsvMetadata {
  return { date, rowCount, url: `/downloads/market/${date}.csv` };
}

export function isMarketCsvTrade(price: Price, security: SecurityValues, date: string) {
  return price.date === date && price.securityId === security.securityId
    && price.exchange === security.exchange && price.ticker === security.ticker;
}

export function serializeMarketCsv(date: string, rows: readonly MarketCsvRow[]) {
  const compare = (a: string, b: string) => a < b ? -1 : Number(a > b);
  const sorted = [...rows].sort(({ security: a }, { security: b }) => compare(a.exchange, b.exchange)
    || compare(a.ticker, b.ticker) || compare(a.securityId, b.securityId));
  const data = sorted.map(({ security: row, current, price: observed, ranks }) => {
    const price = observed && isMarketCsvTrade(observed, row, date) ? observed : undefined;
    const metricValues = marketCsvMetrics.flatMap(metric => {
      const observedAt = current ? row[`${metric}Date`] : null;
      const inRange = !observedAt || observedAt <= date;
      const state = !current ? 'unpublished' : !inRange ? 'future_observation' : row[`${metric}State`];
      const rank = ranks[metric];
      const rankDate = rank?.rankDate && rank.rankDate <= date ? rank.rankDate : null;
      const rankState = rankDate === date ? rank?.rankingState ?? 'no_result' : rankDate ? 'stale' : 'unpublished';
      return [
        state === 'provided' && observedAt ? row[metric] : null, inRange ? observedAt : null, state,
        rankState === 'included' ? rank?.currentRank : null, rankDate, rankState,
      ];
    });
    return [
      date, row.securityId, row.ticker, row.exchange, row.korName || row.name, row.type,
      price?.date, price?.open, price?.high, price?.low, price?.close, price?.volume,
      price ? 'provided' : 'no_observation', ...metricValues,
    ];
  });
  return {
    metadata: marketCsvMetadata(date, sorted.length),
    body: '\uFEFF' + [header, ...data].map(columns => columns.map(escapeCsvValue).join(',')).join('\n'),
  };
}
