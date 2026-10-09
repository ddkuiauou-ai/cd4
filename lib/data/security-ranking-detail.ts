import * as schema from "@/db/schema-postgres";
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { businessDate, toDataDTO } from "./dto";
import { readRouteCodes } from "./history";
import { currentRankFilter, currentRankResultFilter, DEFAULT_SCOPE, publicationState, readPublication, readSnapshot, securityRankPublicationKey, type ReadDatabase } from "./publication";

export async function readSecurityMetricDetailRanking(tx: ReadDatabase, securityId: string, metric: schema.MetricType, scopeKey = DEFAULT_SCOPE) {
    const publication = await readPublication(tx, securityRankPublicationKey(metric, scopeKey));
    const row = publication ? await tx.query.securityRank.findFirst({ where: and(
      eq(schema.securityRank.securityId, securityId),
      currentRankResultFilter(publication),
    ) }) : null;
    return {
      ...publicationState(publication),
      currentRank: row?.currentRank ?? null, priorRank: row?.priorRank ?? null,
      rankingState: row?.rankingState ?? null, exclusionReason: row?.exclusionReason ?? null,
      value: row?.value ?? null,
      valueObservedAt: row?.valueObservedAt ? businessDate(row.valueObservedAt) : null,
      rankDate: publication ? businessDate(publication.asOf) : null,
    };
}
export const getSecurityMetricDetailRanking = (id: string, metric: schema.MetricType, scopeKey = DEFAULT_SCOPE) =>
  readSnapshot(tx => readSecurityMetricDetailRanking(tx, id, metric, scopeKey));

export const getSecurityMetricDetailRank = async (securityId: string, metric: schema.MetricType) =>
  (await getSecurityMetricDetailRanking(securityId, metric)).currentRank;

export async function readSecurityMetricNeighbors(
  tx: ReadDatabase, rank: number, metric: schema.MetricType, rankDate?: string | null, expectedRevision?: string | null,
) {
  if (!Number.isSafeInteger(rank) || rank < 1 || rankDate === null) return [];
    const publication = await readPublication(tx, securityRankPublicationKey(metric));
    if (!publication || (rankDate && businessDate(publication.asOf) !== rankDate)
      || (expectedRevision && String(publication.revision) !== expectedRevision)) return [];
    const columns = { securityId: schema.security.securityId, name: schema.security.name, korName: schema.security.korName,
      exchange: schema.security.exchange, ticker: schema.security.ticker, type: schema.security.type,
      companyId: schema.security.companyId, currentRank: schema.securityRank.currentRank };
    const previous = await tx.select(columns).from(schema.securityRank)
      .innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
      .where(and(currentRankFilter(publication), lt(schema.securityRank.currentRank, rank)))
      .orderBy(desc(schema.securityRank.currentRank), asc(schema.security.securityId)).limit(1);
    const next = await tx.select(columns).from(schema.securityRank)
      .innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
      .where(and(currentRankFilter(publication), gt(schema.securityRank.currentRank, rank)))
      .orderBy(asc(schema.securityRank.currentRank), asc(schema.security.securityId)).limit(1);
    const routeCodes = previous.length || next.length ? await readRouteCodes(tx) : new Map<string, string | null>();
    return toDataDTO([...previous, ...next]).map(row => ({ ...row, routeCode: routeCodes.get(row.securityId) ?? null }));
}
export const getSecurityMetricNeighbors = (rank: number, metric: schema.MetricType, rankDate?: string | null, expectedRevision?: string | null) =>
  readSnapshot(tx => readSecurityMetricNeighbors(tx, rank, metric, rankDate, expectedRevision));

export const getPerRank = (id: string) => getSecurityMetricDetailRank(id, "per");
export const getPbrRank = (id: string) => getSecurityMetricDetailRank(id, "pbr");
export const getDivRank = (id: string) => getSecurityMetricDetailRank(id, "div");
export const getEpsRank = (id: string) => getSecurityMetricDetailRank(id, "eps");
export const getDpsRank = (id: string) => getSecurityMetricDetailRank(id, "dps");
export const getBpsRank = (id: string) => getSecurityMetricDetailRank(id, "bps");
