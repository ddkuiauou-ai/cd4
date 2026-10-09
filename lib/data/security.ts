import { isStaticBuild, getStaticRankingPage, getStaticRankingManifest } from '../static-build/server';
import * as schema from "@/db/schema-postgres";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { businessDate, toDataDTO } from "./dto";
import { computeMixedPagination, computeTotalPagesMixed } from "./pagination";
import { currentCompany, representativeSecurityOrder } from "./company";
import { readMarketcapHistory, readMetricsHistory, readPriceHistory, readRecentPrices, readRouteCodes } from "./history";
import {
  COMPANY_PUBLICATION_KEY, currentRankFilter, DEFAULT_SCOPE, isCurrentResult, publicationState,
  readPublication, readSnapshot, SECURITY_PUBLICATION_KEY, securityRankPublicationKey,
  type PublicationRow, type ReadDatabase,
} from "./publication";

export const SECURITY_METRICS = ["price", "shares", "marketcap", "bps", "per", "pbr", "eps", "div", "dps"] as const;

/** Only tem's published membership decides inclusion; current master status is not a filter. */
export function getSecurityRankingFilter(metricType: schema.MetricType, publication: PublicationRow) {
  return and(eq(schema.securityRank.metricType, metricType), currentRankFilter(publication));
}

export function getSecurityRankingOrder(_metricType: schema.MetricType, sortOrder: "asc" | "desc" = "asc") {
  return (sortOrder === "asc" ? asc : desc)(schema.securityRank.currentRank);
}

export async function countSecurityRanks(metric: schema.MetricType, scopeKey = DEFAULT_SCOPE) {
  if (isStaticBuild()) return getStaticRankingManifest(metric, "security").scopes[scopeKey]?.totalCount ?? 0;
  return readSnapshot(async (tx) => {
    const publication = await readPublication(tx, securityRankPublicationKey(metric, scopeKey));
    return publication?.includedCount ?? 0;
  });
}

async function getLiveSecurityRanksPage(
  metric: schema.MetricType, page: number, sortOrder: "asc" | "desc" = "asc",
  scopeKey = DEFAULT_SCOPE, expectedRevision?: string | null,
) {
  return readSnapshot(async (tx) => {
    const publication = await readPublication(tx, securityRankPublicationKey(metric, scopeKey));
    const { limit, skip, page: currentPage, pageSize } = computeMixedPagination(page);
    const status = publicationState(publication, expectedRevision);
    const rows = !publication || status.revisionChanged ? [] : await tx.select({
      securityId: schema.security.securityId,
      name: schema.security.name, korName: schema.security.korName,
      exchange: schema.security.exchange, ticker: schema.security.ticker,
      type: schema.security.type, companyId: schema.security.companyId,
      value: schema.securityRank.value,
      valueObservedAt: schema.securityRank.valueObservedAt,
      currentRank: schema.securityRank.currentRank, priorRank: schema.securityRank.priorRank,
      rankingState: schema.securityRank.rankingState, evidenceRef: schema.securityRank.evidenceRef,
      updatedAt: schema.securityRank.updatedAt,
      company: { korName: schema.company.korName, logo: schema.company.logo },
    }).from(schema.securityRank)
      .innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
      .leftJoin(schema.company, eq(schema.security.companyId, schema.company.companyId))
      .where(currentRankFilter(publication))
      .orderBy(getSecurityRankingOrder(metric, sortOrder), asc(schema.security.securityId))
      .limit(limit).offset(skip);
    const prices = await readRecentPrices(tx, rows.map(row => row.securityId), 30, status.publication?.asOf);
    const routeCodes = rows.length ? await readRouteCodes(tx) : new Map<string, string | null>();
    return {
      ...status, items: toDataDTO(rows).map(row => ({ ...row, routeCode: routeCodes.get(row.securityId) ?? null,
        prices: prices[row.securityId] ?? [] })),
      latestDate: status.publication?.asOf ?? null,
      totalCount: publication?.includedCount ?? 0,
      page: currentPage, pageSize, skip,
      totalPages: computeTotalPagesMixed(publication?.includedCount ?? 0),
    };
  });
}

/** Prevent a master row from presenting an old/nonpublished revision as current. */
export function currentSecurity<Row extends typeof schema.security.$inferSelect>(row: Row, publication: PublicationRow | null): Row {
  if (isCurrentResult(row, publication)) return row;
  const cleared = { ...row } as Row;
  const record = cleared as Record<string, unknown>;
  for (const metric of SECURITY_METRICS) {
    record[metric] = null;
    record[`${metric}Date`] = null;
    record[`${metric}State`] = "no_observation";
    record[`${metric}SourceRef`] = null;
    record[`${metric}LastProvided`] = null;
    record[`${metric}LastProvidedDate`] = null;
    record[`${metric}LastProvidedSourceRef`] = null;
  }
  record.publicationKey = null;
  record.resultRevision = null;
  record.calculationId = null;
  return cleared;
}

/** Stable security ID is preferred. market.ticker/name aliases must have exactly one match. */
export async function readSecurityByCode(tx: ReadDatabase, code: string) {
  if (!code) return null;
  let decoded: string;
  try { decoded = decodeURIComponent(code); } catch { return null; }
  const byId = await tx.query.security.findFirst({ where: eq(schema.security.securityId, decoded) });
  let identity = byId;
  if (!identity) {
    const separator = decoded.indexOf(".");
    const where = separator > 0
      ? and(eq(schema.security.exchange, decoded.slice(0, separator)), eq(schema.security.ticker, decoded.slice(separator + 1)))
      : or(eq(schema.security.name, decoded), eq(schema.security.korName, decoded), eq(schema.security.ticker, decoded));
    const matches = await tx.query.security.findMany({ where, limit: 2 });
    if (matches.length !== 1) return null;
    identity = matches[0];
  }
  const row = await tx.query.security.findFirst({ where: eq(schema.security.securityId, identity.securityId), with: { company: true } });
  if (!row) return null;
  const publication = await readPublication(tx, SECURITY_PUBLICATION_KEY);
  const current = isCurrentResult(row, publication);
  const companyPublication = row.company ? await readPublication(tx, COMPANY_PUBLICATION_KEY) : null;
  const safeRow = { ...currentSecurity(row, publication), company: row.company ? currentCompany(row.company, companyPublication) : null };
  const asOf = publication ? businessDate(publication.asOf)! : undefined;
  const prices = await readPriceHistory(tx, [row.securityId], undefined, asOf);
  const marketcaps = await readMarketcapHistory(tx, [row.securityId], undefined, asOf);
  const routeCodes = await readRouteCodes(tx);
  return { ...toDataDTO(safeRow), prices: prices.toReversed(), marketcaps,
    routeCode: routeCodes.get(row.securityId) ?? null,
    publication: current && publication ? toDataDTO(publication) : null,
    state: current ? "published" as const : "unpublished" as const };
}

export const getSecurityByCode = (code: string) => readSnapshot(tx => readSecurityByCode(tx, code));

export async function readCompanySecurities(tx: ReadDatabase, companyId: string) {
  if (!companyId) return [];
  const publication = await readPublication(tx, SECURITY_PUBLICATION_KEY);
  const companyPublication = await readPublication(tx, COMPANY_PUBLICATION_KEY);
  const rows = await tx.query.security.findMany({ where: eq(schema.security.companyId, companyId),
    with: { company: true }, orderBy: [asc(schema.security.type), ...representativeSecurityOrder()] });
  const ids = rows.map(row => row.securityId);
  const asOf = publication ? businessDate(publication.asOf)! : undefined;
  const prices = await readRecentPrices(tx, ids, 1, asOf);
  const marketcaps = await readMarketcapHistory(tx, ids, undefined, asOf);
  const routeCodes = await readRouteCodes(tx);
  return toDataDTO(rows.map(row => ({ ...currentSecurity(row, publication),
    company: row.company ? currentCompany(row.company, companyPublication) : null,
    prices: prices[row.securityId] ?? [], marketcaps: marketcaps.filter(item => item.securityId === row.securityId),
    routeCode: routeCodes.get(row.securityId) ?? null })));
}

export const getCompanySecurities = (companyId: string) => readSnapshot(tx => readCompanySecurities(tx, companyId));
export const getSecurityPriceHistory = (id: string, start?: string, end?: string) =>
  id ? readSnapshot(tx => readPriceHistory(tx, [id], start, end)) : Promise.resolve([]);
export const getSecurityMetricsHistory = (id: string, start?: string, end?: string) =>
  id ? readSnapshot(tx => readMetricsHistory(tx, id, start, end)) : Promise.resolve([]);
export const getMarketCapHistoryBySecurityId = (id: string, start?: string, end?: string) =>
  id ? readSnapshot(tx => readMarketcapHistory(tx, [id], start, end)) : Promise.resolve([]);

export async function getMarketCapHistoryBySecurityIds(securityIds: string[]) {
  return readSnapshot(async tx => {
    const rows = await readMarketcapHistory(tx, securityIds);
    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) if (row.securityId) (grouped[row.securityId] ??= []).push(row);
    return grouped;
  });
}
export const getPricesBySecurityIds = (securityIds: string[]) => readSnapshot(async tx => {
  const publication = await readPublication(tx, SECURITY_PUBLICATION_KEY);
  return readRecentPrices(tx, securityIds, 30, publication ? businessDate(publication.asOf) : undefined);
});

// Older callers use these names; all now read the same tem-published ranking.
export { getPerRank, getPbrRank, getDivRank, getEpsRank, getDpsRank, getBpsRank } from "./security-ranking-detail";
import { getSecurityMetricNeighbors } from "./security-ranking-detail";
export const getSecurityMarketCapPageData = (rank: number) => getSecurityMetricNeighbors(rank, "marketcap");
export const getSecurityPerPageData = (rank: number) => getSecurityMetricNeighbors(rank, "per");
export const getSecurityPbrPageData = (rank: number) => getSecurityMetricNeighbors(rank, "pbr");
export const getSecurityDivPageData = (rank: number) => getSecurityMetricNeighbors(rank, "div");
export const getSecurityEpsPageData = (rank: number) => getSecurityMetricNeighbors(rank, "eps");
export const getSecurityDpsPageData = (rank: number) => getSecurityMetricNeighbors(rank, "dps");
export const getSecurityBpsPageData = (rank: number) => getSecurityMetricNeighbors(rank, "bps");

export async function getSecurityRanksPage(metric: schema.MetricType, page: number, sortOrder: "asc" | "desc" = "asc", scopeKey = DEFAULT_SCOPE, expectedRevision?: string | null) {
  if (isStaticBuild()) return getStaticRankingPage<Awaited<ReturnType<typeof getLiveSecurityRanksPage>>>(metric, "security", page, scopeKey, expectedRevision, sortOrder === "desc");
  return getLiveSecurityRanksPage(metric, page, sortOrder, scopeKey, expectedRevision);
}
