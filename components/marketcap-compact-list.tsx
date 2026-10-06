import { RankingMobileList } from "@/components/ranking-mobile-list";
import { createRankingRows, type RankingMetric, type RankingScope } from "@/lib/ranking-view";

interface Props {
  items: unknown[];
  limit?: number;
  className?: string;
  metric?: RankingMetric;
  scope?: RankingScope;
}

/** Compatibility entry point; all ranking lists share the same row adapter. */
export default function MarketcapCompactList({ items, limit, className, metric = "marketcap", scope = items.some(item => item != null && typeof item === "object" && "securityId" in item) ? "security" : "company" }: Props) {
  const list = limit == null ? items : items.slice(0, Math.max(0, Math.floor(limit)));
  return <div className={className}><RankingMobileList rows={createRankingRows(list, metric, scope)} metric={metric} scope={scope} /></div>;
}
