import { db } from "@/db";
import * as schema from "@/db/schema-postgres";
import { asc, eq, sql } from "drizzle-orm";
import {
  csvDate,
  serializeRankingCsv,
  type RankingExportRow,
  type RankingExportSnapshot,
} from "@/lib/csv/ranking";
import {
  getRankingDownloadFilename,
  getRankingDownloadUrl,
  type RankingDownloadMetric,
  type RankingDownloadScope,
} from "@/lib/ranking-download";
import { cachedData } from "./cache-policy";
import { getCompanyMarketcapRankingFilter, getListedCommonSecurityFilter } from "./company";
import { getSecurityRankingFilter, getSecurityRankingOrder } from "./security";

const securityMetricDates = {
  marketcap: schema.security.marketcapDate,
  per: schema.security.perDate,
  pbr: schema.security.pbrDate,
  eps: schema.security.epsDate,
  bps: schema.security.bpsDate,
  div: schema.security.divDate,
  dps: schema.security.dpsDate,
};

// Use one unpaginated result and its length, rather than joining independently
// cached pages or counts that may belong to different ranking dates.
export const getWholeRankingExport = cachedData(
  async (scope: RankingDownloadScope, metric: RankingDownloadMetric): Promise<RankingExportSnapshot> => {
    getRankingDownloadUrl(scope, metric);
    if (scope === "company") {
      const companies = await db.query.company.findMany({
        where: getCompanyMarketcapRankingFilter(),
        orderBy: [asc(schema.company.marketcapRank)],
        columns: {
          companyId: true, name: true, korName: true,
          marketcap: true, marketcapRank: true, marketcapPriorRank: true, marketcapDate: true,
        },
        with: {
          securities: {
            where: getListedCommonSecurityFilter(),
            columns: { securityId: true, ticker: true, exchange: true, type: true },
            limit: 1,
          },
        },
      });
      const rows: RankingExportRow[] = companies.map((company) => {
        const representative = company.securities[0];
        return {
          currentRank: company.marketcapRank,
          priorRank: company.marketcapPriorRank,
          companyId: company.companyId,
          securityId: representative?.securityId ?? null,
          name: company.korName || company.name,
          ticker: representative?.ticker ?? "",
          exchange: representative?.exchange ?? "",
          type: representative?.type ?? null,
          value: company.marketcap,
          metricDate: csvDate(company.marketcapDate),
        };
      });
      return {
        scope, metric, rows, totalCount: rows.length,
        rankDate: null,
        referenceDate: rows[0]?.metricDate ?? null,
        generatedAt: new Date().toISOString(),
      };
    }

    const latest = await db.select({ rankDate: sql<string>`max(${schema.securityRank.rankDate})` })
      .from(schema.securityRank).where(eq(schema.securityRank.metricType, metric));
    const rankDate = latest[0]?.rankDate ?? null;
    if (!rankDate) {
      return { scope, metric, rows: [], totalCount: 0, rankDate: null, referenceDate: null, generatedAt: new Date().toISOString() };
    }
    const securities = await db.select({
      currentRank: schema.securityRank.currentRank,
      priorRank: schema.securityRank.priorRank,
      companyId: schema.security.companyId,
      securityId: schema.security.securityId,
      name: schema.security.name,
      korName: schema.security.korName,
      ticker: schema.security.ticker,
      exchange: schema.security.exchange,
      type: schema.security.type,
      value: schema.securityRank.value,
      metricDate: securityMetricDates[metric],
    }).from(schema.security)
      .innerJoin(schema.securityRank, eq(schema.securityRank.securityId, schema.security.securityId))
      .where(getSecurityRankingFilter(metric, rankDate))
      .orderBy(getSecurityRankingOrder(metric));
    const rows: RankingExportRow[] = securities.map(({ korName, metricDate, ...row }) => ({
      ...row, name: korName || row.name, metricDate: csvDate(metricDate),
    }));
    return {
      scope, metric, rows, totalCount: rows.length,
      rankDate, referenceDate: rankDate, generatedAt: new Date().toISOString(),
    };
  },
  "getWholeRankingExport",
  ["getWholeRankingExport", "getCompanyMarketcapsPage", "countCompanyMarketcaps", "getSecurityRanksPage", "countSecurityRanks"],
);

export async function createRankingCsvResponse(scope: RankingDownloadScope, metric: RankingDownloadMetric) {
  // Query failures propagate: a static build must not publish a successful empty
  // CSV in place of a failed dataset. Runtime errors use Next's error response.
  const snapshot = await getWholeRankingExport(scope, metric);
  if (!snapshot.totalCount) {
    return new Response("내려받을 순위 데이터가 없습니다.", {
      status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(serializeRankingCsv(snapshot), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${getRankingDownloadFilename(scope, metric, snapshot.referenceDate)}"`,
      "X-Ranking-Row-Count": String(snapshot.totalCount),
      "X-Ranking-Generated-At": snapshot.generatedAt,
    },
  });
}
