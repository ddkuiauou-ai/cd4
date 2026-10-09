import { isStaticBuild, getStaticSecurityDetail, getStaticCompanyDetail } from '../static-build/server';
import * as schema from "@/db/schema-postgres";
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { toDataDTO } from "./dto";
import { readCompanyAggregatedMarketcap, getCompanyMarketcapRankingFilter, representativeSecurityOrder } from "./company";
import { readCompanySecurities, readSecurityByCode } from "./security";
import { historyRange, readMetricsHistory, readRouteCodes } from "./history";
import { readSecurityMetricDetailRanking, readSecurityMetricNeighbors } from "./security-ranking-detail";
import { COMPANY_PUBLICATION_KEY, readPublication, readSnapshot, type ReadDatabase } from "./publication";

export type DetailMetric = schema.MetricType | "price" | "shares";
const inWindow = <Row extends { date: string }>(rows: Row[], start?: string, end?: string) =>
  rows.filter(row => (!start || row.date >= start) && (!end || row.date <= end));

/** Official snapshots, source histories, membership and neighbors share one DB snapshot. */
function getLiveSecurityDetailSnapshot(code: string, metric: DetailMetric = "marketcap", start?: string, end?: string) {
  historyRange(start, end);
  return readSnapshot(async tx => {
    const security = await readSecurityByCode(tx, code);
    if (!security) return null;
    const company = security.companyId ? await readCompanyAggregatedMarketcap(tx, security.companyId) : null;
    const companySecs = security.companyId ? await readCompanySecurities(tx, security.companyId) : [];
    const ranking = metric === "price" || metric === "shares" ? null
      : await readSecurityMetricDetailRanking(tx, security.securityId, metric);
    const neighbors = ranking?.currentRank != null && metric !== "price" && metric !== "shares"
      ? await readSecurityMetricNeighbors(tx, ranking.currentRank, metric, ranking.rankDate, ranking.publication?.revision) : [];
    const priceHistory = security.prices.toReversed();
    const history = metric === "price" ? inWindow(priceHistory, start, end)
      : metric === "marketcap" || metric === "shares" ? inWindow(security.marketcaps, start, end)
      : await readMetricsHistory(tx, security.securityId, start, end ?? security.publication?.asOf);
    return { security, company, companySecs, ranking, neighbors, history, priceHistory };
  });
}

async function companyNeighbors(tx: ReadDatabase, rank: number | null) {
  if (rank == null) return [];
  const header = await readPublication(tx, COMPANY_PUBLICATION_KEY);
  if (!header) return [];
  const withRepresentative = { securities: { where: eq(schema.security.type, "보통주"),
    columns: { securityId: true }, orderBy: representativeSecurityOrder(), limit: 1 } } as const;
  const previous = await tx.query.company.findMany({ where: and(getCompanyMarketcapRankingFilter(header), lt(schema.company.marketcapRank, rank)),
    orderBy: [desc(schema.company.marketcapRank), asc(schema.company.companyId)], limit: 1, with: withRepresentative });
  const next = await tx.query.company.findMany({ where: and(getCompanyMarketcapRankingFilter(header), gt(schema.company.marketcapRank, rank)),
    orderBy: [asc(schema.company.marketcapRank), asc(schema.company.companyId)], limit: 1, with: withRepresentative });
  const routeCodes = await readRouteCodes(tx);
  return toDataDTO([...previous, ...next]).map(row => ({ ...row,
    routeCode: row.securities[0] ? routeCodes.get(row.securities[0].securityId) ?? null : null }));
}

function getLiveCompanyDetailSnapshot(code: string, start?: string, end?: string) {
  historyRange(start, end);
  return readSnapshot(async tx => {
    const decoded = (() => { try { return decodeURIComponent(code); } catch { return ""; } })();
    if (!decoded) return null;
    // A company stable ID has precedence; historical market.ticker links are aliases.
    const identity = await tx.query.company.findFirst({ where: eq(schema.company.companyId, decoded) });
    const aliasSecurity = identity ? null : await readSecurityByCode(tx, code);
    const companyId = identity?.companyId ?? aliasSecurity?.companyId;
    if (!companyId) return null;
    const company = await readCompanyAggregatedMarketcap(tx, companyId);
    if (!company) return null;
    const companySecs = await readCompanySecurities(tx, companyId);
    const representative = companySecs.find(member => member.type === "보통주") ?? null;
    const security = representative ? await readSecurityByCode(tx, representative.securityId) : null;
    const priceHistory = security?.prices.toReversed() ?? [];
    const history = inWindow(company.registeredHistory, start, end);
    const ranking = { currentRank: company.marketcapRank, priorRank: company.marketcapPriorRank,
      rankingState: company.rankingState, exclusionReason: company.exclusionReason, publication: company.publication,
      state: company.state, value: company.totalMarketcap, rankDate: company.publication?.asOf ?? null };
    return { company, security, companySecs, history, priceHistory, ranking,
      neighbors: await companyNeighbors(tx, company.marketcapRank) };
  });
}

export function getSecurityDetailSnapshot(code: string, metric: DetailMetric = "marketcap", start?: string, end?: string) {
  historyRange(start, end);
  if (isStaticBuild()) return Promise.resolve(getStaticSecurityDetail<Awaited<ReturnType<typeof getLiveSecurityDetailSnapshot>>>(code, metric, start, end));
  return getLiveSecurityDetailSnapshot(code, metric, start, end);
}
export function getCompanyDetailSnapshot(code: string, start?: string, end?: string) {
  historyRange(start, end);
  if (isStaticBuild()) return Promise.resolve(getStaticCompanyDetail<Awaited<ReturnType<typeof getLiveCompanyDetailSnapshot>>>(code, start, end));
  return getLiveCompanyDetailSnapshot(code, start, end);
}
