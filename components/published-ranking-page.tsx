import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getCompanyRankingPage } from "@/lib/data/company";
import { getSecurityRanksPage } from "@/lib/data/security";
import { createRankingRows, type RankingMetric, type RankingSearch } from "@/lib/ranking-view";
import { RankingPageView } from "./ranking-page-view";

export async function PublishedRankingPage({ metric = "marketcap", company = false, page = 1, search = {} }: {
  metric?: RankingMetric; company?: boolean; page?: number; search?: RankingSearch;
}) {
  await connection();
  if (!Number.isSafeInteger(page) || page < 1) notFound();
  const expectedRevision = typeof search.revision === "string" ? search.revision : undefined;
  const scopeKey = !company && typeof search.scope === "string" && /^[A-Za-z0-9._-]{1,80}$/.test(search.scope) ? search.scope : "krx-all";
  const snapshot = company ? await getCompanyRankingPage(page, expectedRevision) : await getSecurityRanksPage(metric, page, "asc", scopeKey, expectedRevision);
  if (!snapshot.revisionChanged && page > Math.max(1, snapshot.totalPages)) notFound();
  return <RankingPageView rows={createRankingRows(snapshot.items, metric, company ? "company" : "security")}
    metric={metric} scope={company ? "company" : "security"} latestDate={snapshot.publication?.asOf ?? snapshot.latestDate}
    totalCount={snapshot.totalCount} currentPage={page} totalPages={snapshot.totalPages}
    basePath={company ? "/marketcaps" : `/${metric}`} publication={snapshot.publication}
    state={snapshot.state} revisionChanged={snapshot.revisionChanged} scopeKey={scopeKey} />;
}
