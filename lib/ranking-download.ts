export const RANKING_DOWNLOAD_METRICS = [
  "marketcap", "per", "pbr", "eps", "bps", "div", "dps",
] as const;

export type RankingDownloadMetric = (typeof RANKING_DOWNLOAD_METRICS)[number];
export type RankingDownloadScope = "company" | "security";

export function getRankingDownloadUrl(
  scope: RankingDownloadScope,
  metric: RankingDownloadMetric,
): string {
  if (!RANKING_DOWNLOAD_METRICS.includes(metric)) {
    throw new Error("지원하지 않는 순위 지표입니다.");
  }
  if (scope === "company") {
    if (metric !== "marketcap") {
      throw new Error("기업 합산 순위는 시가총액만 제공됩니다.");
    }
    return "/ranking-data/companies-marketcap.csv";
  }
  if (scope !== "security") {
    throw new Error("지원하지 않는 순위 범위입니다.");
  }
  return `/ranking-data/securities-${metric}.csv`;
}

export function getRankingDownloadFilename(
  scope: RankingDownloadScope,
  metric: RankingDownloadMetric,
  referenceDate?: string | null,
): string {
  getRankingDownloadUrl(scope, metric);
  const date = referenceDate?.match(/^\d{4}-\d{2}-\d{2}$/)
    ? referenceDate
    : "undated";
  return `${metric}-${scope === "company" ? "companies" : "securities"}-${date}.csv`;
}
