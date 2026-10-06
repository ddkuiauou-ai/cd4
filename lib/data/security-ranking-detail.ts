import { db } from "@/db";
import * as schema from "@/db/schema-postgres";
import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import { cachedData } from "./cache-policy";
import { getSecurityRankingFilter } from "./security";

type MetricType = schema.MetricType;

async function latestRankDate(metric: MetricType): Promise<string | null> {
  const rows = await db.select({ maxDate: sql<string>`max(${schema.securityRank.rankDate})` })
    .from(schema.securityRank)
    .where(eq(schema.securityRank.metricType, metric));
  return rows[0]?.maxDate ?? null;
}

export interface SecurityMetricDetailRanking {
  currentRank: number | null;
  rankDate: string | null;
}

/** Rank and its basis date are evidence from one fixed, listed metric snapshot. */
export const getSecurityMetricDetailRanking = cachedData(async (
  securityId: string, metric: MetricType,
): Promise<SecurityMetricDetailRanking> => {
  const date = await latestRankDate(metric);
  if (!date) return { currentRank: null, rankDate: null };
  const rows = await db.select({ rank: schema.securityRank.currentRank })
    .from(schema.securityRank)
    .innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
    .where(and(getSecurityRankingFilter(metric, date), eq(schema.securityRank.securityId, securityId)))
    .limit(1);
  const currentRank = rows[0]?.rank ?? null;
  return { currentRank, rankDate: currentRank == null ? null : date };
}, "getSecurityMetricDetailRanking", ["securityMetricRankingDetail"]);

/** Compatibility entry points share the complete ranking evidence cache. */
export const getSecurityMetricDetailRank = async (securityId: string, metric: MetricType) =>
  (await getSecurityMetricDetailRanking(securityId, metric)).currentRank;

/** Read each side independently so a missing adjacent rank or the last rank is safe. */
export const getSecurityMetricNeighbors = cachedData(async (rank: number, metric: MetricType, rankDate?: string | null) => {
  if (!Number.isSafeInteger(rank) || rank < 1) return [];
  const date = rankDate === undefined ? await latestRankDate(metric) : rankDate;
  if (!date) return [];
  const columns = {
    securityId: schema.security.securityId,
    name: schema.security.name,
    korName: schema.security.korName,
    exchange: schema.security.exchange,
    ticker: schema.security.ticker,
    type: schema.security.type,
    companyId: schema.security.companyId,
    currentRank: schema.securityRank.currentRank,
  };
  const [previous, next] = await Promise.all([
    db.select(columns).from(schema.securityRank)
      .innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
      .where(and(getSecurityRankingFilter(metric, date), lt(schema.securityRank.currentRank, rank)))
      .orderBy(desc(schema.securityRank.currentRank), asc(schema.security.securityId)).limit(1),
    db.select(columns).from(schema.securityRank)
      .innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
      .where(and(getSecurityRankingFilter(metric, date), gt(schema.securityRank.currentRank, rank)))
      .orderBy(asc(schema.securityRank.currentRank), asc(schema.security.securityId)).limit(1),
  ]);
  return [...previous, ...next];
}, "getSecurityMetricNeighbors", ["securityMetricRankingDetail"]);

export const getPerRank = (securityId: string) => getSecurityMetricDetailRank(securityId, "per");
export const getPbrRank = (securityId: string) => getSecurityMetricDetailRank(securityId, "pbr");
export const getDivRank = (securityId: string) => getSecurityMetricDetailRank(securityId, "div");
export const getEpsRank = (securityId: string) => getSecurityMetricDetailRank(securityId, "eps");
export const getDpsRank = (securityId: string) => getSecurityMetricDetailRank(securityId, "dps");
export const getBpsRank = (securityId: string) => getSecurityMetricDetailRank(securityId, "bps");
