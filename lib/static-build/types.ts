import type { RankingCsvMetadata } from "@/lib/csv/ranking";
import type { RankingMetric, RankingPublication, RankingScope } from "@/lib/ranking-view";

export interface StaticCsvSource {
  url: string;
  metadata: RankingCsvMetadata;
}

export interface StaticRankingSnapshot {
  items: unknown[];
  totalCount: number;
  totalPages: number;
  latestDate?: string | null;
  publication: RankingPublication | null;
  state: "published" | "unpublished";
  revisionChanged: boolean;
}

export interface StaticRankingScope {
  state: "published" | "unpublished";
  publication: RankingPublication | null;
  totalCount: number;
  totalPages: number;
  pages: Record<string, string>;
  csv: StaticCsvSource | null;
}

export interface StaticRankingManifest {
  version: 1;
  metric: RankingMetric;
  scope: RankingScope;
  scopes: Record<string, StaticRankingScope>;
}
