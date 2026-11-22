export interface MarketcapSecurityIdentity {
  securityId: string;
  name?: string | null;
  korName?: string | null;
  ticker?: string | null;
  type?: string | null;
}

export interface MarketcapSeries {
  key: string;
  securityId: string;
  label: string;
  type: string | null;
}

export type MarketcapChartPoint = {
  date: string;
  [key: string]: string | number | boolean | null | undefined;
};

export const isMarketcapTotalKey = (key: string) =>
  key === "총합계" || key === "totalValue" || key === "totalMarketcap";

export function marketcapDateAxis(dates: readonly string[]) {
  const first = dates[0];
  const last = dates.at(-1);
  const yearOf = (date: string) => Number(date.slice(0, 4));
  if (!first || !last || yearOf(last) - yearOf(first) <= 2) {
    return { formatDate: (date: string) => date.replaceAll('-', '.') };
  }
  const span = yearOf(last) - yearOf(first);
  const step = span > 15 ? 5 : span > 7 ? 2 : 1;
  const years = new Map<number, string>();
  for (const date of dates) {
    const year = yearOf(date);
    if (year > yearOf(first) && year < yearOf(last) && year % step === 0 && !years.has(year)) years.set(year, date);
  }
  return { formatDate: (date: string) => date.slice(0, 4), dateTicks: [first, ...years.values(), last] };
}

export function createMarketcapSeries(securities: readonly MarketcapSecurityIdentity[]): MarketcapSeries[] {
  return securities.map((security) => ({
    // Recharts interprets periods in string dataKey values as property paths.
    key: `security_${encodeURIComponent(security.securityId).replace(/\./g, "%2E")}`,
    securityId: security.securityId,
    label: `${security.type || security.korName || security.name || "종목"} · ${security.ticker || security.securityId}`,
    type: security.type ?? null,
  }));
}

export function createMarketcapChartData(
  history: readonly { date: Date | string; totalMarketcap: number | string | null; securitiesBreakdown: Record<string, number | string | null> }[],
  series: readonly MarketcapSeries[],
): MarketcapChartPoint[] {
  return history.map((item) => {
    const point: MarketcapChartPoint = {
      date: item.date instanceof Date ? item.date.toISOString().slice(0, 10) : String(item.date),
      value: item.totalMarketcap,
      총합계: item.totalMarketcap,
    };
    for (const security of series) {
      point[security.key] = item.securitiesBreakdown?.[security.securityId] ?? null;
    }
    return point;
  });
}

export function getMarketcapSeriesLabel(key: string, series: readonly MarketcapSeries[] = [], totalLabel = "전체 시총"): string {
  return isMarketcapTotalKey(key) ? totalLabel : series.find((item) => item.key === key)?.label ?? key;
}

export function isMarketcapSeriesSelected(
  key: string,
  series: readonly MarketcapSeries[] = [],
  selectedSecurityId?: string,
  selectedType = "시가총액 구성",
): boolean {
  if (selectedSecurityId) {
    return series.some((item) => item.key === key && item.securityId === selectedSecurityId);
  }
  return selectedType === "시가총액 구성" && isMarketcapTotalKey(key);
}

export function getMarketcapSelectionColor(
  key: string,
  series: readonly MarketcapSeries[] = [],
  selectedSecurityId?: string,
  selectedType = "시가총액 구성",
): string | undefined {
  if (!isMarketcapSeriesSelected(key, series, selectedSecurityId, selectedType)) return undefined;
  return getMarketcapScopeColor(isMarketcapTotalKey(key) ? null : series.find((item) => item.key === key)?.type);
}

export function getMarketcapScopeColor(type?: string | null): string {
  return type?.includes("보통주") ? "var(--market-up)"
    : type?.includes("우선주") ? "var(--market-down)" : "var(--brand-ink)";
}
