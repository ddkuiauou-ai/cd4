export type RankingMetric = "marketcap" | "per" | "pbr" | "eps" | "bps" | "div" | "dps";
export type RankingScope = "company" | "security";

export const RANKING_METRICS: Record<RankingMetric, { label: string; title: string; unit: string; description: string }> = {
  marketcap: { label: "시가총액", title: "시가총액 순위", unit: "원", description: "시가총액은 발행주식수와 주가를 곱한 값입니다." },
  per: { label: "PER", title: "PER 순위", unit: "배", description: "PER은 주가를 주당순이익으로 나눈 값입니다. 순위는 지표의 크기와 투자 수익을 구분해서 읽어 주세요." },
  pbr: { label: "PBR", title: "PBR 순위", unit: "배", description: "PBR은 주가를 주당순자산으로 나눈 값입니다." },
  eps: { label: "EPS", title: "EPS 순위", unit: "원", description: "EPS는 주당순이익입니다." },
  bps: { label: "BPS", title: "BPS 순위", unit: "원", description: "BPS는 주당순자산입니다." },
  div: { label: "배당수익률", title: "배당수익률 순위", unit: "%", description: "배당수익률은 주가에 대한 주당배당금의 비율입니다." },
  dps: { label: "주당배당금", title: "주당배당금 순위", unit: "원", description: "주당배당금은 한 주에 지급하는 배당금입니다." },
};

export interface RankingPrice {
  close: number;
  open?: number;
  date?: string;
}

export interface RankingRow {
  id: string;
  scope: RankingScope;
  metric: RankingMetric;
  name: string;
  ticker: string;
  exchange: string;
  stockType: string | null;
  href: string | null;
  rank: number | null;
  priorRank: number | null;
  value: number | null;
  metricDate?: string | null;
  close: number | null;
  rate: number | null;
  priceDate: string | null;
  prices: RankingPrice[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function dateText(value: unknown): string | null {
  if (value == null) return null;
  const date = new Date(value instanceof Date ? value : text(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

/** Keep every ranked entity, including entities without representative prices. */
export function createRankingRows(items: readonly unknown[], metric: RankingMetric, scope: RankingScope): RankingRow[] {
  return items.map((input, index) => {
    const item = record(input);
    const securities = Array.isArray(item.securities) ? item.securities : [];
    const security = scope === "company" ? record(securities[0]) : { ...record(securities[0]), ...item };
    const sourcePrices = Array.isArray(item.prices) ? item.prices : Array.isArray(security.prices) ? security.prices : [];
    const latest = record(sourcePrices[sourcePrices.length - 1]);
    const exchange = text(security.exchange);
    const ticker = text(security.ticker);
    const rank = finiteNumber(item.currentRank ?? item[`${metric}Rank`]);
    const priorRank = finiteNumber(item.priorRank ?? item[`${metric}PriorRank`]);
    const name = text(item.korName) || text(item.name) || "이름 정보 없음";
    return {
      id: String(item.securityId ?? item.companyId ?? `${exchange}.${ticker}.${index}`),
      scope, metric, name, ticker, exchange,
      stockType: text(security.type) || null,
      href: exchange && ticker ? `/${scope}/${exchange}.${ticker}/${metric}` : null,
      rank: rank && rank > 0 ? rank : null,
      priorRank: priorRank && priorRank > 0 ? priorRank : null,
      value: finiteNumber(item.value ?? item[metric]),
      metricDate: dateText(item[`${metric}Date`] ?? item.metricDate ?? item.date),
      close: finiteNumber(latest.close),
      rate: finiteNumber(latest.rate),
      priceDate: dateText(latest.date),
      prices: sourcePrices.slice(-30).flatMap((price) => {
        const p = record(price);
        const close = finiteNumber(p.close);
        return close == null ? [] : [{ close, open: finiteNumber(p.open) ?? undefined, date: dateText(p.date) ?? undefined }];
      }),
    };
  });
}

export function formatRankingValue(metric: RankingMetric, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (metric === "per" || metric === "pbr") return `${value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}배`;
  if (metric === "div") return `${value.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  if (metric !== "marketcap") return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}원`;
  const absolute = Math.abs(value);
  const [divisor, unit] = absolute >= 1e12 ? [1e12, "조"] : absolute >= 1e8 ? [1e8, "억"] : absolute >= 1e4 ? [1e4, "만"] : [1, "원"];
  return `${(value / Number(divisor)).toLocaleString("ko-KR", { maximumFractionDigits: divisor === 1 ? 0 : 1 })}${unit}`;
}

export function formatRankingRate(rate: number | null): string {
  return rate == null ? "—" : `${rate > 0 ? "+" : ""}${rate.toFixed(2)}%`;
}

export function getRankingPriceDate(rows: readonly RankingRow[]): string | null {
  const dates = rows.flatMap(row => row.priceDate ? [row.priceDate] : []).sort();
  return dates[dates.length - 1] ?? null;
}

export function rankMovement(current: number | null | undefined, prior: number | null | undefined) {
  if (current == null || prior == null || !Number.isFinite(current) || !Number.isFinite(prior) || current <= 0 || prior <= 0) return null;
  return prior - current;
}

export function getRankingPager(page: number, totalPages?: number) {
  if (!Number.isSafeInteger(page) || page < 1 || (totalPages != null && (!Number.isSafeInteger(totalPages) || totalPages < 1 || page > totalPages))) return null;
  return {
    prev: page > 1 ? page - 1 : null,
    next: totalPages != null && page >= totalPages ? null : page + 1,
  };
}

export function getRankNeighbors<T>(items: readonly T[], rank: number, getRank: (item: T) => number | null | undefined): { prev: T | null; next: T | null } {
  let prev: T | null = null;
  let next: T | null = null;
  for (const item of items) {
    const itemRank = getRank(item);
    if (itemRank == null || !Number.isFinite(itemRank) || itemRank <= 0) continue;
    if (itemRank < rank && (prev == null || itemRank > (getRank(prev) ?? 0))) prev = item;
    if (itemRank > rank && (next == null || itemRank < (getRank(next) ?? Infinity))) next = item;
  }
  return { prev, next };
}
