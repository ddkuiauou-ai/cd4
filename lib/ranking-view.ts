import { companyPath, securityPath } from "./entity-paths";
import { formatBusinessValue } from "./business-analysis";

export type RankingMetric = "marketcap" | "per" | "pbr" | "eps" | "bps" | "div" | "dps";
export type RankingScope = "company" | "security";
export type RankingSearch = Record<string, string | string[] | undefined>;
export interface RankingPublication { asOf: string; revision: string; scopeKey: string; calculationId: string; publishedAt: string }
export type RankingAmount = number | string | null;

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
  close: RankingAmount;
  open?: number;
  date?: string;
  rate?: number | null;
  volume?: RankingAmount;
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
  value: RankingAmount;
  securityId: string | null;
  securityHref: string | null;
  completeness: string | null;
  metricDate?: string | null;
  close: RankingAmount;
  rate: number | null;
  priceDate: string | null;
  volume: RankingAmount;
  prices: RankingPrice[];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function amount(value: unknown): RankingAmount {
  return typeof value === "string" && formatBusinessValue(value) !== "—" ? value : finiteNumber(value);
}
function visualNumber(value: unknown): number | null {
  const exact = amount(value);
  if (exact == null) return null;
  const number = Number(exact);
  return Number.isFinite(number) ? number : null;
}
function routeCode(value: unknown): string | null | undefined {
  return value === null ? null : text(value) || undefined;
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
    const security = scope === "company" ? record(Object.hasOwn(item, "representativeSecurity") ? item.representativeSecurity : securities.find(entry => record(entry).type === "보통주")) : { ...record(securities[0]), ...item };
    const sourcePrices = Array.isArray(item.prices) ? item.prices : Array.isArray(security.prices) ? security.prices : [];
    const orderedPrices = sourcePrices.map(record).toSorted((a, b) => (dateText(a.date) ?? "").localeCompare(dateText(b.date) ?? ""));
    const latest = record(orderedPrices[orderedPrices.length - 1]);
    const exchange = text(security.exchange);
    const ticker = text(security.ticker);
    const rank = finiteNumber(Object.hasOwn(item, "currentRank") ? item.currentRank : item[`${metric}Rank`]);
    const priorRank = finiteNumber(Object.hasOwn(item, "priorRank") ? item.priorRank : item[`${metric}PriorRank`]);
    const name = text(item.korName) || text(item.name) || "이름 정보 없음";
    return {
      id: String(item.securityId ?? item.companyId ?? `${exchange}.${ticker}.${index}`),
      scope, metric, name, ticker, exchange,
      stockType: text(security.type) || null,
      href: scope === "company" ? companyPath({ companyId: String(item.companyId), routeCode: routeCode(item.routeCode) }, metric)
        : securityPath({ securityId: String(item.securityId), exchange, ticker, routeCode: routeCode(item.routeCode) }, metric),
      securityId: text(security.securityId) || null,
      securityHref: text(security.securityId) ? securityPath({ securityId: text(security.securityId), exchange, ticker, routeCode: routeCode(security.routeCode) }, "marketcap") : null,
      completeness: text(item.marketcapCompleteness) || null,
      rank: rank && rank > 0 ? rank : null,
      priorRank: priorRank && priorRank > 0 ? priorRank : null,
      value: amount(Object.hasOwn(item, "value") ? item.value : item[metric]),
      metricDate: dateText(Object.hasOwn(item, "valueObservedAt") ? item.valueObservedAt : item[`${metric}Date`] ?? item.metricDate ?? item.date),
      close: amount(latest.close),
      rate: visualNumber(latest.rate),
      priceDate: dateText(latest.date),
      volume: amount(latest.volume),
      prices: orderedPrices.slice(-30).map(p => ({ close: amount(p.close), open: visualNumber(p.open) ?? undefined, date: dateText(p.date) ?? undefined, rate: visualNumber(p.rate), volume: amount(p.volume) })),
    };
  });
}

export function formatRankingValue(metric: RankingMetric, value: RankingAmount): string {
  if (value == null) return "—";
  const normalized = formatBusinessValue(value).replaceAll(",", "");
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return "—";
  const fraction = match[3] ?? "";
  const coefficient = BigInt(match[2] + fraction);
  const scale = fraction.length;
  const power = metric === "marketcap" ? ([12, 8, 4].find(p => coefficient >= 10n ** BigInt(p + scale)) ?? 0) : 0;
  const digits = metric === "marketcap" ? (power ? 1 : 0) : 2;
  const denominator = 10n ** BigInt(scale + power);
  const rounded = (coefficient * 10n ** BigInt(digits) + denominator / 2n) / denominator;
  const raw = rounded.toString().padStart(digits + 1, "0");
  const decimal = digits ? raw.slice(-digits) : "";
  const fixed = ["per", "pbr", "div"].includes(metric);
  const decimalText = fixed ? decimal : decimal.replace(/0+$/, "");
  const whole = (digits ? raw.slice(0, -digits) : raw).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const unit = metric === "marketcap" ? ({ 12: "조", 8: "억", 4: "만", 0: "원" } as Record<number, string>)[power] : RANKING_METRICS[metric].unit;
  return `${match[1]}${whole}${decimalText ? `.${decimalText}` : ""}${unit}`;
}

export function exactRankingValue(metric: RankingMetric, value: RankingAmount): string {
  return value == null ? "지표 정보 없음" : `${formatBusinessValue(value)}${RANKING_METRICS[metric].unit}`;
}

export function getPriceDateRange(rows: readonly RankingRow[]): string | null {
  const dates = rows.flatMap(row => row.priceDate ? [row.priceDate] : []).sort();
  return !dates.length ? null : dates[0] === dates.at(-1) ? dates[0] : `${dates[0]}–${dates.at(-1)}`;
}

export function compareVolumes(a: RankingAmount, b: RankingAmount): number {
  const parse = (value: RankingAmount) => value == null || !/^\d+$/.test(String(value)) ? null : BigInt(value);
  const left = parse(a), right = parse(b);
  return left === right ? 0 : left === null ? 1 : right === null ? -1 : left > right ? -1 : 1;
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
