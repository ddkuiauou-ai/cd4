import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getMarketCsvMetadata } from "@/lib/data/market-csv";
import { getCompanyRankingPage } from "@/lib/data/company";
import { getSecurityRanksPage } from "@/lib/data/security";
import { createRankingRows, type RankingMetric, type RankingSearch } from "@/lib/ranking-view";
import { RankingPageView } from "./ranking-page-view";
import { Suspense } from "react";
import { isStaticBuild, getStaticRankingManifest } from "@/lib/static-build/server";
import { StaticRankingPage } from "./static-ranking-page";
import { rankingManifestForPage } from "@/lib/static-ranking";

export async function PublishedRankingPage({ metric = "marketcap", company = false, page = 1, search = {}, documentScope }: {
  metric?: RankingMetric; company?: boolean; page?: number; search?: RankingSearch; documentScope?: string;
}) {
  if (!isStaticBuild()) await connection();
  if (!Number.isSafeInteger(page) || page < 1) notFound();
  const expectedRevision = typeof search.revision === "string" ? search.revision : undefined;
  const scopeKey = documentScope ?? (!company && typeof search.scope === "string" && /^[A-Za-z0-9._-]{1,80}$/.test(search.scope) ? search.scope : "krx-all");
  const [snapshot, marketCsv] = await Promise.all([
    company ? getCompanyRankingPage(page, expectedRevision) : getSecurityRanksPage(metric, page, "asc", scopeKey, expectedRevision),
    getMarketCsvMetadata(),
  ]);
  const scope = company ? "company" as const : "security" as const;
  const manifest = isStaticBuild() ? await getStaticRankingManifest(metric, scope) : undefined;
  if (documentScope && (manifest ? !Object.hasOwn(manifest.scopes, documentScope) || manifest.scopes[documentScope].state !== "published"
    : snapshot.state !== "published")) notFound();
  const totalPages = manifest && !documentScope ? Math.max(1, ...Object.values(manifest.scopes).map(entry => entry.totalPages))
    : Math.max(1, snapshot.totalPages);
  if (!snapshot.revisionChanged && page > totalPages) notFound();
  const props = { rows: createRankingRows(snapshot.items, metric, scope), metric, scope,
    latestDate: snapshot.publication?.asOf ?? snapshot.latestDate ?? null,
    totalCount: snapshot.totalCount, currentPage: page, totalPages: snapshot.totalPages,
    basePath: company ? "/marketcaps" : `/${metric}`, publication: snapshot.publication,
    state: snapshot.state, revisionChanged: snapshot.revisionChanged, scopeKey, marketCsv,
    staticCsvSource: manifest?.scopes[scopeKey]?.csv ?? undefined };
  return manifest ? <Suspense fallback={<RankingPageView {...props} />}><StaticRankingPage initial={props} manifest={rankingManifestForPage(manifest, page)} documentScope={documentScope} /></Suspense>
    : <RankingPageView {...props} />;
}
