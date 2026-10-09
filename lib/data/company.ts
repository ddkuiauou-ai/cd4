import { isStaticBuild, getStaticRankingPage, getStaticRankingManifest } from '../static-build/server';
import * as schema from "@/db/schema-postgres";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { businessDate, toDataDTO, type DataDTO } from "./dto";
import { computeMixedPagination, computeTotalPagesMixed } from "./pagination";
import { COMPANY_PUBLICATION_KEY, isCurrentResult, publicationState, readPublication, readSnapshot, type PublicationRow, type PublicationDTO, type ReadDatabase } from "./publication";
import { readMarketcapHistory, readRecentPrices, readRouteCodes, type MarketcapDTO } from "./history";
import { aggregateRegisteredCompanyHistory, exactPercentage, type RegisteredCompanyObservation } from "./registered-company-history";

/** The official snapshot and registered-history analysis remain separate. */
export interface CompanyMarketcapAggregated {
  company: DataDTO<typeof schema.company.$inferSelect>;
  companyId: string;
  companyName: string;
  companyKorName: string | null;
  totalMarketcap: string | null;
  totalMarketcapDate: string | null;
  marketcapCompleteness: "complete" | "missing_input" | "insufficient_evidence" | null;
  marketcapRank: number | null;
  marketcapPriorRank: number | null;
  rankingState: "included" | "excluded" | null;
  exclusionReason: string | null;
  resultSourceRef: string | null;
  state: "published" | "unpublished";
  publication: PublicationDTO | null;
  routeCode: string | null;
  compositionComplete: boolean;
  compositionReason: "unpublished" | "missing_input" | "different_total" | null;
  compositionObservedCount: number;
  compositionTargetCount: number;
  securities: Array<{
    securityId: string; name: string | null; korName: string | null; ticker: string | null; type: string | null;
    exchange: string; routeCode: string | null;
    marketcap: string | null; marketcapDate: string | null; percentage: number | null;
    marketcapHistory: MarketcapDTO[];
  }>;
  aggregatedHistory: RegisteredCompanyObservation[];
  registeredHistory: RegisteredCompanyObservation[];
}

export function currentCompany<Row extends typeof schema.company.$inferSelect>(row: Row, publication: PublicationRow | null): Row {
  if (isCurrentResult(row, publication)) return row;
  const cleared = { ...row } as Row;
  const record = cleared as Record<string, unknown>;
  for (const field of ["marketcap", "marketcapDate", "marketcapRank", "marketcapPriorRank", "marketcapCompleteness", "rankingState", "exclusionReason", "resultSourceRef", "publicationKey", "resultRevision", "calculationId"]) record[field] = null;
  return cleared;
}

/** A representative is descriptive only and cannot remove a tem-ranked company. */
export function getListedCommonSecurityFilter() {
  return eq(schema.security.type, "보통주");
}
export const representativeSecurityOrder = () => [desc(isNull(schema.security.delistingDate)),
  asc(schema.security.exchange), asc(schema.security.ticker), asc(schema.security.securityId)];

export function getCompanyMarketcapRankingFilter(publication: PublicationRow) {
  return and(
    eq(schema.company.publicationKey, publication.publicationKey),
    eq(schema.company.resultRevision, publication.revision),
    eq(schema.company.calculationId, publication.calculationId),
    eq(schema.company.rankingState, "included"),
  );
}

export async function countCompanyMarketcaps() {
  if (isStaticBuild()) return getStaticRankingManifest("marketcap", "company").scopes["krx-all"]?.totalCount ?? 0;
  return readSnapshot(async (tx) => (await readPublication(tx, COMPANY_PUBLICATION_KEY))?.includedCount ?? 0);
}

async function getLiveCompanyRankingPage(page: number, expectedRevision?: string | null) {
  return readSnapshot(async (tx) => {
    const publication = await readPublication(tx, COMPANY_PUBLICATION_KEY);
    const status = publicationState(publication, expectedRevision);
    const { limit, skip, page: currentPage, pageSize } = computeMixedPagination(page);
    const rows = !publication || status.revisionChanged ? [] : await tx.query.company.findMany({
      where: getCompanyMarketcapRankingFilter(publication),
      orderBy: [asc(schema.company.marketcapRank), asc(schema.company.companyId)],
      limit, offset: skip,
      with: { securities: { where: getListedCommonSecurityFilter(), columns: { securityId: true, exchange: true, ticker: true, type: true, name: true, korName: true }, orderBy: representativeSecurityOrder(), limit: 1 } },
    });
    const prices = await readRecentPrices(tx, rows.flatMap(row => row.securities.map(security => security.securityId)), 30, status.publication?.asOf);
    const routeCodes = rows.length ? await readRouteCodes(tx) : new Map<string, string | null>();
    return {
      ...status,
      items: toDataDTO(rows).map(row => {
        const securities = row.securities.map(security => ({ ...security, routeCode: routeCodes.get(security.securityId) ?? null,
          prices: prices[security.securityId] ?? [] }));
        return { ...row, securities, representativeSecurity: securities[0] ?? null,
          routeCode: securities[0]?.routeCode ?? null, prices: securities[0]?.prices ?? [] };
      }),
      page: currentPage, pageSize, skip,
      latestDate: status.publication?.asOf ?? null,
      totalCount: publication?.includedCount ?? 0,
      totalPages: computeTotalPagesMixed(publication?.includedCount ?? 0),
    };
  });
}
export const getCompanyMarketcapsPage = getCompanyRankingPage;

export async function readCompanyAggregatedMarketcap(tx: ReadDatabase, companyId: string): Promise<CompanyMarketcapAggregated | null> {
    if (!companyId) return null;
    const row = await tx.query.company.findFirst({ where: eq(schema.company.companyId, companyId) });
    if (!row) return null;
    const publication = await readPublication(tx, COMPANY_PUBLICATION_KEY);
    const current = isCurrentResult(row, publication);
    const dto = toDataDTO(row);
    const allMembers = await tx.query.security.findMany({ where: eq(schema.security.companyId, companyId),
      orderBy: representativeSecurityOrder() });
    const members = allMembers.filter(member => member.delistingDate == null);
    const ids = members.map(member => member.securityId);
    const histories = await readMarketcapHistory(tx, ids, undefined, publication ? businessDate(publication.asOf)! : undefined);
    const routeCodes = allMembers.length ? await readRouteCodes(tx) : new Map<string, string | null>();
    const grouped = new Map<string, MarketcapDTO[]>();
    for (const observation of histories) if (observation.securityId) {
      const history = grouped.get(observation.securityId) ?? [];
      history.push(observation); grouped.set(observation.securityId, history);
    }
    const asOf = current ? dto.marketcapDate : null;
    const registeredHistory = aggregateRegisteredCompanyHistory(ids, histories, asOf ? [asOf] : []);
    const composition = asOf ? registeredHistory.find(observation => observation.date === asOf) : undefined;
    const complete = current && dto.marketcap != null && row.marketcapCompleteness === "complete" && composition != null
      && !composition.partial && composition.totalMarketcap === dto.marketcap;
    const securities = members.map(member => ({ securityId: member.securityId, name: member.name, korName: member.korName,
      ticker: member.ticker, exchange: member.exchange, type: member.type, routeCode: routeCodes.get(member.securityId) ?? null,
      marketcap: composition?.securitiesBreakdown[member.securityId] ?? null,
      marketcapDate: composition?.securitiesBreakdown[member.securityId] != null ? asOf : null,
      percentage: complete && dto.marketcap != null && composition.securitiesBreakdown[member.securityId] != null
        ? exactPercentage(composition.securitiesBreakdown[member.securityId]!, dto.marketcap) : null,
      marketcapHistory: grouped.get(member.securityId) ?? [] }));
    const representative = allMembers.find(member => member.type === "보통주");
    return {
      company: toDataDTO(currentCompany(row, publication)),
      companyId: row.companyId, companyName: row.name, companyKorName: row.korName,
      totalMarketcap: current ? dto.marketcap : null,
      totalMarketcapDate: current ? dto.marketcapDate : null,
      marketcapCompleteness: current ? row.marketcapCompleteness : null,
      marketcapRank: current ? row.marketcapRank : null,
      marketcapPriorRank: current ? row.marketcapPriorRank : null,
      rankingState: current ? row.rankingState : null,
      exclusionReason: current ? row.exclusionReason : null,
      resultSourceRef: current ? row.resultSourceRef : null,
      state: current ? "published" : "unpublished",
      publication: current && publication ? toDataDTO(publication) : null,
      routeCode: representative ? routeCodes.get(representative.securityId) ?? null : null,
      compositionComplete: complete,
      compositionReason: !current ? "unpublished" : !composition || composition.observedCount === 0 || composition.partial || row.marketcapCompleteness !== "complete"
        ? "missing_input" : !complete ? "different_total" : null,
      compositionObservedCount: composition?.observedCount ?? 0, compositionTargetCount: ids.length,
      securities, registeredHistory, aggregatedHistory: registeredHistory,
    };
}

export const getCompanyAggregatedMarketcap = (companyId: string) => readSnapshot(tx => readCompanyAggregatedMarketcap(tx, companyId));

export async function getCompanyMarketCapPageData(rank: number) {
  if (!Number.isSafeInteger(rank) || rank < 1) return [];
  return readSnapshot(async (tx) => {
    const publication = await readPublication(tx, COMPANY_PUBLICATION_KEY);
    if (!publication) return [];
    const rows = await tx.query.company.findMany({
      where: and(getCompanyMarketcapRankingFilter(publication), inArray(schema.company.marketcapRank, [rank - 1, rank, rank + 1])),
      orderBy: [asc(schema.company.marketcapRank), asc(schema.company.companyId)],
      with: { securities: { where: getListedCommonSecurityFilter(), columns: { securityId: true, ticker: true, exchange: true }, orderBy: representativeSecurityOrder(), limit: 1 } },
    });
    const routeCodes = rows.length ? await readRouteCodes(tx) : new Map<string, string | null>();
    return toDataDTO(rows).map(row => ({ ...row, primaryTicker: row.securities[0]?.ticker ?? "", exchange: row.securities[0]?.exchange ?? "",
      routeCode: row.securities[0] ? routeCodes.get(row.securities[0].securityId) ?? null : null }));
  });
}
export const getMarketCapPageData = getCompanyMarketCapPageData;

export async function getCompanyRankingPage(page: number, expectedRevision?: string | null) {
  if (isStaticBuild()) return getStaticRankingPage<Awaited<ReturnType<typeof getLiveCompanyRankingPage>>>("marketcap", "company", page, "krx-all", expectedRevision);
  return getLiveCompanyRankingPage(page, expectedRevision);
}
