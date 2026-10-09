import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getCompanyRankingPage } from "@/lib/data/company";
import { getSecurityRanksPage } from "@/lib/data/security";
import { createRankingRows, type RankingMetric, type RankingSearch } from "@/lib/ranking-view";
import { RankingPageView } from "./ranking-page-view";
import { Suspense } from "react";
import { isStaticBuild, getStaticRankingManifest } from "@/lib/static-build/server";
import { StaticRankingPage } from "./static-ranking-page";

export async function PublishedRankingPage({ metric = "marketcap", company = false, page = 1, search = {} }: {
  metric?: RankingMetric; company?: boolean; page?: number; search?: RankingSearch;
}) {
  if (!isStaticBuild()) await connection();
  if (!Number.isSafeInteger(page) || page < 1) notFound();
  const expectedRevision = typeof search.revision === "string" ? search.revision : undefined;
  const scopeKey = !company && typeof search.scope === "string" && /^[A-Za-z0-9._-]{1,80}$/.test(search.scope) ? search.scope : "krx-all";
  const snapshot = company ? await getCompanyRankingPage(page, expectedRevision) : await getSecurityRanksPage(metric, page, "asc", scopeKey, expectedRevision);
  const scope = company ? "company" as const : "security" as const;
  const manifest = isStaticBuild() ? await getStaticRankingManifest(metric, scope) : undefined;
  const totalPages = manifest ? Math.max(1, ...Object.values(manifest.scopes).map(entry => entry.totalPages))
    : Math.max(1, snapshot.totalPages);
  if (!snapshot.revisionChanged && page > totalPages) notFound();
  const props = { rows: createRankingRows(snapshot.items, metric, scope), metric, scope,
    latestDate: snapshot.publication?.asOf ?? snapshot.latestDate ?? null,
    totalCount: snapshot.totalCount, currentPage: page, totalPages: snapshot.totalPages,
    basePath: company ? "/marketcaps" : `/${metric}`, publication: snapshot.publication,
    state: snapshot.state, revisionChanged: snapshot.revisionChanged, scopeKey,
    staticCsvSource: manifest?.scopes[scopeKey]?.csv ?? undefined };
  return manifest ? <Suspense fallback={<RankingPageView {...props} />}><StaticRankingPage initial={props} manifest={manifest} /></Suspense>
    : <RankingPageView {...props} />;
}
