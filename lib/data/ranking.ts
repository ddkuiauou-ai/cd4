// Placeholder for shared ranking utilities (e.g., effective rank date policies)

export function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

// Security ranking helpers (migrated from lib/getRanking.ts)
import { db } from "@/db";
import * as schema from "@/db/schema-postgres";
import { and, eq, sql } from "drizzle-orm";

export type MetricType = 'marketcap' | 'bps' | 'per' | 'pbr' | 'eps' | 'div' | 'dps';

export async function getEffectiveRankDate(metric: string): Promise<string> {
  try {
    const rows = metric === 'multi'
      ? await db
          .select({ maxDate: sql<Date>`max(${schema.securityRank.rankDate})` })
          .from(schema.securityRank)
          .limit(1)
      : await db
          .select({ maxDate: sql<Date>`max(${schema.securityRank.rankDate})` })
          .from(schema.securityRank)
          .where(eq(schema.securityRank.metricType, metric as MetricType))
          .limit(1);

    const latestDate = rows[0]?.maxDate;

    if (!latestDate) {
      throw new Error(`No rank date found for metric ${metric}`);
    }

    return latestDate instanceof Date
      ? latestDate.toISOString().split('T')[0]
      : new Date(latestDate).toISOString().split('T')[0];
  } catch (error) {
    console.error(`[getEffectiveRankDate] Failed to resolve rank date for metric ${metric}:`, error);
    return getTodayISO();
  }
}

export async function getSecurityRank(
  securityId: string,
  metricType: MetricType,
  rankDate?: string
): Promise<number | null> {
  try {
    const targetDate = rankDate || await getEffectiveRankDate(metricType);
    const result = await db
      .select({ rank: schema.securityRank.currentRank })
      .from(schema.securityRank)
      .where(and(
        eq(schema.securityRank.securityId, securityId),
        eq(schema.securityRank.metricType, metricType),
        eq(schema.securityRank.rankDate, targetDate)
      ))
      .limit(1);
    return result[0]?.rank || null;
  } catch (e) {
    console.error(`Error fetching ${metricType} rank for ${securityId}:`, e);
    return null;
  }
}

export async function getSecurityRanks(
  securityId: string,
  metricTypes: MetricType[],
  rankDate?: string
): Promise<Record<MetricType, number | null>> {
  try {
    const targetDate = rankDate || await getEffectiveRankDate('multi');
    const results = await db
      .select({ metricType: schema.securityRank.metricType, rank: schema.securityRank.currentRank })
      .from(schema.securityRank)
      .where(and(
        eq(schema.securityRank.securityId, securityId),
        sql`${schema.securityRank.metricType} = ANY(${metricTypes})`,
        eq(schema.securityRank.rankDate, targetDate)
      ));
    const ranksMap = {} as Record<MetricType, number | null>;
    metricTypes.forEach(mt => { ranksMap[mt] = null; });
    results.forEach(r => { if (r.metricType) ranksMap[r.metricType as MetricType] = r.rank; });
    return ranksMap;
  } catch (e) {
    console.error(`Error fetching ranks for ${securityId}:`, e);
    return {} as Record<MetricType, number | null>;
  }
}

export async function getTopRankedSecurities(
  metricType: MetricType,
  limit: number = 10,
  rankDate?: string
) {
  try {
    const targetDate = rankDate || await getEffectiveRankDate(metricType);
    const results = await db
      .select({
        securityId: schema.securityRank.securityId,
        rank: schema.securityRank.currentRank,
        value: schema.securityRank.value,
        security: {
          ticker: schema.security.ticker,
          name: schema.security.name,
          korName: schema.security.korName,
          exchange: schema.security.exchange,
        }
      })
      .from(schema.securityRank)
      .innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
      .where(and(
        eq(schema.securityRank.metricType, metricType),
        eq(schema.securityRank.rankDate, targetDate)
      ))
      .orderBy(schema.securityRank.currentRank)
      .limit(limit);
    return results;
  } catch (e) {
    console.error(`Error fetching top ${metricType} rankings:`, e);
    return [];
  }
}

export async function getRankingContext(
  securityId: string,
  metricType: MetricType,
  contextSize: number = 5,
  rankDate?: string
) {
  try {
    const targetDate = rankDate || await getEffectiveRankDate(metricType);
    const currentRank = await getSecurityRank(securityId, metricType, targetDate);
    if (!currentRank) return [];
    const startRank = Math.max(1, currentRank - contextSize);
    const endRank = currentRank + contextSize;
    const results = await db
      .select({
        securityId: schema.securityRank.securityId,
        rank: schema.securityRank.currentRank,
        value: schema.securityRank.value,
        security: {
          ticker: schema.security.ticker,
          name: schema.security.name,
          korName: schema.security.korName,
          exchange: schema.security.exchange,
        }
      })
      .from(schema.securityRank)
      .innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
      .where(and(
        eq(schema.securityRank.metricType, metricType),
        eq(schema.securityRank.rankDate, targetDate),
        sql`${schema.securityRank.currentRank} BETWEEN ${startRank} AND ${endRank}`
      ))
      .orderBy(schema.securityRank.currentRank);
    return results;
  } catch (e) {
    console.error(`Error fetching ranking context for ${securityId}:`, e);
    return [];
  }
}
