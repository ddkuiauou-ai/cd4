import { isStaticBuild, getStaticManifest } from './static-build/server';
import { db } from "@/db";
import * as schema from "@/db/schema-postgres";
import { asc, eq } from "drizzle-orm";
import { toDataDTO } from "./data/dto";
import { getEntityRouteInventory } from "./entity-route-inventory";
import { getSecurityByCode } from "./data/security";
import { getSecurityMetricDetailRanking } from "./data/security-ranking-detail";
import { currentRankFilter, readPublication, readSnapshot, securityRankPublicationKey } from "./data/publication";

export async function getCompanies(skip = 0, limit = 100) {
  return toDataDTO(await db.query.company.findMany({
    columns: { companyId: true, name: true, korName: true, logo: true },
    orderBy: [asc(schema.company.name)], limit, offset: skip,
  }));
}
export const getSecurityById = getSecurityByCode;

export async function getSecurityMarketCapRanking(securityId: string) {
  const row = await getSecurityMetricDetailRanking(securityId, "marketcap");
  if (row.currentRank == null) return null;
  return { ...row, rankChange: row.priorRank == null ? null : row.currentRank - row.priorRank };
}

export async function getAllSecuritiesWithType() {
  return db.query.security.findMany({
    columns: { securityId: true, exchange: true, ticker: true, type: true },
    orderBy: [asc(schema.security.securityId)],
  });
}

/** Detail links use stable IDs, including historical/delisted and reused-code securities. */
export async function getAllSecurityCodes(): Promise<string[]> {
  if (isStaticBuild()) return getStaticManifest().securityCodes;
  const inventory = await getEntityRouteInventory();
  return inventory.identities.map(row => inventory.securities.get(row.securityId) || row.securityId);
}
export async function getAllCompanyCodes(): Promise<string[]> {
  if (isStaticBuild()) return getStaticManifest().companyCodes;
  const inventory = await getEntityRouteInventory();
  return (await db.query.company.findMany({ columns: { companyId: true }, orderBy: [asc(schema.company.companyId)] })).map(row => inventory.companies.get(row.companyId) || row.companyId);
}

async function rankedMeta(metric: schema.MetricType, limit: number) {
  return readSnapshot(async (tx) => {
    const publication = await readPublication(tx, securityRankPublicationKey(metric));
    if (!publication) return [];
    return tx.select({ securityId: schema.security.securityId, companyId: schema.security.companyId, type: schema.security.type })
      .from(schema.securityRank).innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
      .where(currentRankFilter(publication))
      .orderBy(asc(schema.securityRank.currentRank), asc(schema.security.securityId))
      .limit(Math.max(1, Math.min(1000, limit)));
  });
}

export async function getTopSecurityCodesByMetric(metric: schema.MetricType, limit = 10) {
  const inventory = await getEntityRouteInventory();
  return (await rankedMeta(metric, limit)).map(row => inventory.securities.get(row.securityId) || row.securityId);
}
export async function getTopCompanyCodesByMetric(metric: schema.MetricType, limit = 10) {
  const inventory = await getEntityRouteInventory();
  return [...new Set((await rankedMeta(metric, limit * 2)).map(row => row.companyId).filter((id): id is string => id != null))].slice(0, limit).map(id => inventory.companies.get(id) || id);
}
export async function getTopSecuritiesWithTypeByMetric(metric: schema.MetricType, limit = 10) {
  const inventory = await getEntityRouteInventory();
  return (await rankedMeta(metric, limit)).map(row => ({ code: inventory.securities.get(row.securityId) || row.securityId, type: row.type, companyId: row.companyId }));
}
