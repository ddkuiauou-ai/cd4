import * as schema from "@/db/schema-postgres";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { businessDate, toDataDTO } from "./dto";
import { currentRankFilter, readPublication, readSnapshot, securityRankPublicationKey } from "./publication";
import { getSecurityMetricDetailRanking } from "./security-ranking-detail";

export type MetricType = schema.MetricType;
export function getTodayISO(): string { return businessDate(new Date())!; }

export async function getEffectiveRankDate(metric: string): Promise<string | null> {
  if (!schema.metricTypeEnum.enumValues.includes(metric as MetricType)) return null;
  return readSnapshot(async (tx) => {
    const publication = await readPublication(tx, securityRankPublicationKey(metric as MetricType));
    return publication ? businessDate(publication.asOf) : null;
  });
}

export async function getSecurityRank(id: string, metric: MetricType, rankDate?: string) {
  const result = await getSecurityMetricDetailRanking(id, metric);
  return rankDate && result.rankDate !== rankDate ? null : result.currentRank;
}

export async function getSecurityRanks(id: string, metrics: MetricType[], rankDate?: string): Promise<Record<MetricType, number | null>> {
  return readSnapshot(async (tx) => {
    const result = Object.fromEntries(schema.metricTypeEnum.enumValues.map(metric => [metric, null])) as Record<MetricType, number | null>;
    for (const metric of metrics) {
      const publication = await readPublication(tx, securityRankPublicationKey(metric));
      if (!publication || (rankDate && businessDate(publication.asOf) !== rankDate)) continue;
      const rows = await tx.select({ rank: schema.securityRank.currentRank }).from(schema.securityRank)
        .where(and(currentRankFilter(publication), eq(schema.securityRank.securityId, id))).limit(1);
      result[metric] = rows[0]?.rank ?? null;
    }
    return result;
  });
}

const rankColumns = { securityId: schema.securityRank.securityId, rank: schema.securityRank.currentRank, value: schema.securityRank.value,
  security: { ticker: schema.security.ticker, name: schema.security.name, korName: schema.security.korName, exchange: schema.security.exchange } };

export async function getTopRankedSecurities(metric: MetricType, limit = 10, rankDate?: string) {
  return readSnapshot(async (tx) => {
    const publication = await readPublication(tx, securityRankPublicationKey(metric));
    if (!publication || (rankDate && businessDate(publication.asOf) !== rankDate)) return [];
    return toDataDTO(await tx.select(rankColumns).from(schema.securityRank)
      .innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
      .where(currentRankFilter(publication)).orderBy(asc(schema.securityRank.currentRank), asc(schema.security.securityId))
      .limit(Math.max(1, Math.min(1000, limit))));
  });
}

export async function getRankingContext(id: string, metric: MetricType, contextSize = 5, rankDate?: string) {
  return readSnapshot(async (tx) => {
    const publication = await readPublication(tx, securityRankPublicationKey(metric));
    if (!publication || (rankDate && businessDate(publication.asOf) !== rankDate)) return [];
    const current = await tx.select({ rank: schema.securityRank.currentRank }).from(schema.securityRank)
      .where(and(currentRankFilter(publication), eq(schema.securityRank.securityId, id))).limit(1);
    const rank = current[0]?.rank;
    if (rank == null) return [];
    return toDataDTO(await tx.select(rankColumns).from(schema.securityRank)
      .innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
      .where(and(currentRankFilter(publication), gte(schema.securityRank.currentRank, Math.max(1, rank - contextSize)), lte(schema.securityRank.currentRank, rank + contextSize)))
      .orderBy(asc(schema.securityRank.currentRank), asc(schema.security.securityId)));
  });
}
