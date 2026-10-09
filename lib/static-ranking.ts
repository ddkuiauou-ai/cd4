import type { StaticRankingManifest, StaticRankingSnapshot } from "@/lib/static-build/types";

export function selectStaticRanking(manifest: StaticRankingManifest, query: URLSearchParams, page: number) {
  const single = (key: string) => query.getAll(key).length === 1 ? query.get(key) : null;
  const requestedScope = single("scope");
  const scopeKey = manifest.scope === "security" && requestedScope && /^[A-Za-z0-9._-]{1,80}$/.test(requestedScope)
    ? requestedScope : "krx-all";
  const scope = Object.hasOwn(manifest.scopes, scopeKey) ? manifest.scopes[scopeKey] : undefined;
  const revision = single("revision");
  const revisionChanged = revision !== null && (!scope?.publication || scope.publication.revision !== revision);
  return { scopeKey, scope, revisionChanged,
    url: !revisionChanged && scope ? scope.pages[String(page)] : undefined,
    outOfRange: Boolean(scope && !revisionChanged && page > Math.max(1, scope.totalPages)),
  };
}

export function validateStaticRankingSnapshot(value: unknown, manifest: StaticRankingManifest, scopeKey: string): StaticRankingSnapshot {
  const scope = manifest.scopes[scopeKey];
  if (!value || typeof value !== "object" || !scope) throw new Error("순위 파일의 범위를 확인할 수 없습니다.");
  const snapshot = value as StaticRankingSnapshot;
  if (!Array.isArray(snapshot.items) || snapshot.totalCount !== scope.totalCount || snapshot.totalPages !== scope.totalPages
    || snapshot.state !== scope.state || snapshot.revisionChanged !== false
    || snapshot.publication?.revision !== scope.publication?.revision
    || snapshot.publication?.calculationId !== scope.publication?.calculationId
    || snapshot.publication?.scopeKey !== scope.publication?.scopeKey) {
    throw new Error("순위 파일의 공개 기준이 일치하지 않습니다.");
  }
  return snapshot;
}
