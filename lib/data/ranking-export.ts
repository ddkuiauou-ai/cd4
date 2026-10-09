import * as schema from "@/db/schema-postgres";
import { asc, eq } from "drizzle-orm";
import { csvDate, serializeRankingCsv, type RankingExportRow, type RankingExportSnapshot } from "@/lib/csv/ranking";
import { getRankingDownloadFilename, getRankingDownloadUrl, type RankingDownloadMetric, type RankingDownloadScope } from "@/lib/ranking-download";
import { getCompanyMarketcapRankingFilter, getListedCommonSecurityFilter, representativeSecurityOrder } from "./company";
import { COMPANY_PUBLICATION_KEY, currentRankFilter, DEFAULT_SCOPE, publicationState, readPublication, readSnapshot, securityRankPublicationKey } from "./publication";

/** All rows and their header come from one read-only REPEATABLE READ snapshot. */
export async function getWholeRankingExport(
  scope: RankingDownloadScope, metric: RankingDownloadMetric, expectedRevision?: string | null, scopeKey = DEFAULT_SCOPE,
): Promise<RankingExportSnapshot> {
  getRankingDownloadUrl(scope, metric);
  return readSnapshot(async (tx) => {
    const key = scope === "company" ? COMPANY_PUBLICATION_KEY : securityRankPublicationKey(metric, scopeKey);
    const publication = await readPublication(tx, key);
    const status = publicationState(publication, expectedRevision);
    const rows: RankingExportRow[] = [];
    if (publication && !status.revisionChanged) {
      if (scope === "company") {
        const companies = await tx.query.company.findMany({
          where: getCompanyMarketcapRankingFilter(publication),
          orderBy: [asc(schema.company.marketcapRank), asc(schema.company.companyId)],
          with: { securities: { where: getListedCommonSecurityFilter(), columns: { securityId: true, ticker: true, exchange: true, type: true }, orderBy: representativeSecurityOrder(), limit: 1 } },
        });
        for (const company of companies) rows.push({
          currentRank: company.marketcapRank, priorRank: company.marketcapPriorRank,
          companyId: company.companyId, securityId: company.securities[0]?.securityId ?? null,
          name: company.korName || company.name, ticker: company.securities[0]?.ticker ?? "",
          exchange: company.securities[0]?.exchange ?? "", type: company.securities[0]?.type ?? null,
          value: company.marketcap, metricDate: csvDate(company.marketcapDate),
        });
      } else {
        const securities = await tx.select({
          currentRank: schema.securityRank.currentRank, priorRank: schema.securityRank.priorRank,
          companyId: schema.security.companyId, securityId: schema.security.securityId,
          name: schema.security.name, korName: schema.security.korName,
          ticker: schema.security.ticker, exchange: schema.security.exchange, type: schema.security.type,
          value: schema.securityRank.value, metricDate: schema.securityRank.valueObservedAt,
        }).from(schema.securityRank)
          .innerJoin(schema.security, eq(schema.securityRank.securityId, schema.security.securityId))
          .where(currentRankFilter(publication))
          .orderBy(asc(schema.securityRank.currentRank), asc(schema.security.securityId));
        for (const { korName, metricDate, ...row } of securities) rows.push({
          ...row, name: korName || row.name, metricDate: csvDate(metricDate),
        });
      }
      if (rows.length !== publication.includedCount) throw new Error("공개 순위의 행 개수가 헤더와 일치하지 않습니다.");
    }
    return {
      scope, metric, rows, totalCount: rows.length,
      rankDate: status.publication?.asOf ?? null,
      referenceDate: status.publication?.asOf ?? null,
      generatedAt: new Date().toISOString(),
      ...status,
      publicationKey: publication?.publicationKey ?? null,
      scopeKey: publication?.scopeKey ?? scopeKey,
      revision: publication ? String(publication.revision) : null,
      calculationId: publication?.calculationId ?? null,
    };
  });
}

export async function createRankingCsvResponse(
  scope: RankingDownloadScope, metric: RankingDownloadMetric, expectedRevision?: string | null, scopeKey = DEFAULT_SCOPE,
) {
  const snapshot = await getWholeRankingExport(scope, metric, expectedRevision, scopeKey);
  if (snapshot.revisionChanged) return new Response("순위 결과가 갱신되었습니다. 최신 결과를 확인한 뒤 다시 내려받아 주세요.", {
    status: 409, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
  if (snapshot.state === "unpublished") return new Response("순위 결과가 아직 공개되지 않았습니다.", {
    status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
  return new Response(serializeRankingCsv(snapshot), { headers: {
    "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
    "Content-Disposition": `attachment; filename="${getRankingDownloadFilename(scope, metric, snapshot.referenceDate)}"`,
    "X-Ranking-Row-Count": String(snapshot.totalCount), "X-Ranking-Generated-At": snapshot.generatedAt,
    "X-Ranking-Revision": snapshot.revision!, "X-Ranking-Calculation-Id": snapshot.calculationId!,
    "X-Ranking-Publication-Key": snapshot.publicationKey!,
    "X-Ranking-Scope": scope, "X-Ranking-Metric": metric, "X-Ranking-Scope-Key": snapshot.scopeKey!,
    "X-Ranking-Reference-Date": snapshot.referenceDate ?? "",
  } });
}
