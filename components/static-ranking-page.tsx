"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createRankingRows } from "@/lib/ranking-view";
import { selectStaticRanking, validateStaticRankingSnapshot } from "@/lib/static-ranking";
import type { StaticRankingManifest, StaticRankingSnapshot } from "@/lib/static-build/types";
import { RankingPageView, type RankingPageViewProps } from "./ranking-page-view";

export function StaticRankingPage({ initial, manifest }: { initial: RankingPageViewProps; manifest: StaticRankingManifest }) {
  const query = useSearchParams();
  const selected = selectStaticRanking(manifest, new URLSearchParams(query.toString()), initial.currentPage);
  const [loaded, setLoaded] = useState<{ url: string; snapshot: StaticRankingSnapshot } | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const defaultScope = selected.scopeKey === "krx-all";
  const url = !defaultScope ? selected.url : undefined;

  useEffect(() => {
    if (!url) return;
    const abort = new AbortController();
    fetch(url, { signal: abort.signal }).then(async response => {
      if (!response.ok) throw new Error("순위 파일을 가져오지 못했습니다.");
      return validateStaticRankingSnapshot(await response.json(), manifest, selected.scopeKey);
    }).then(snapshot => { if (!abort.signal.aborted) setLoaded({ url, snapshot }); })
      .catch(() => { if (!abort.signal.aborted) setFailedUrl(url); });
    return () => abort.abort();
  }, [url, manifest, selected.scopeKey]);

  const empty: RankingPageViewProps = { ...initial, rows: [], latestDate: selected.scope?.publication?.asOf ?? null,
    publication: selected.scope?.publication ?? null, totalCount: selected.scope?.totalCount ?? 0,
    totalPages: selected.scope?.totalPages ?? 0, scopeKey: selected.scopeKey,
    state: selected.scope?.state ?? "unpublished", revisionChanged: selected.revisionChanged,
    staticCsvSource: selected.scope?.csv ?? undefined };
  if (selected.revisionChanged || !selected.scope || selected.scope.state === "unpublished") return <RankingPageView {...empty} />;
  if (selected.outOfRange) return <RankingPageView {...empty} feedback={{ title: "순위 페이지를 찾을 수 없습니다", description: "현재 조회 범위의 첫 페이지에서 다시 확인해 주세요.", action: <a className="inline-block mt-4 underline underline-offset-4" href={`${initial.basePath}?scope=${encodeURIComponent(selected.scopeKey)}`}>첫 페이지로 이동</a> }} />;
  if (defaultScope) return <RankingPageView {...initial} />;
  if (url && failedUrl === url && loaded?.url !== url) return <RankingPageView {...empty} feedback={{ title: "순위 자료를 불러오지 못했습니다", description: "조회 범위는 유지했습니다. 다시 시도해 주세요.", alert: true, action: <button className="inline-block mt-4 underline underline-offset-4" onClick={() => window.location.reload()}>다시 시도</button> }} />;
  if (!url) return <RankingPageView {...empty} feedback={{ title: "이 순위 페이지의 자료를 찾을 수 없습니다.", alert: true }} />;
  if (loaded?.url !== url) return <RankingPageView {...empty} feedback={{ title: "순위 자료를 불러오고 있어요.", description: "선택한 조회 범위의 공개 자료를 확인하고 있습니다.", busy: true }} />;
  const snapshot = loaded.snapshot;
  return <RankingPageView {...empty} rows={createRankingRows(snapshot.items, manifest.metric, manifest.scope)}
    latestDate={snapshot.publication?.asOf ?? snapshot.latestDate ?? null} />;
}
