import type { StaticRankingManifest } from "./static-build/types";

const scopeSyntax = "[A-Za-z0-9._-]{1,80}";
const scopedSegment = new RegExp(`^(${scopeSyntax})~([1-9]\\d*)$`);

export function scopedRankingPagePath(basePath: string, scopeKey: string, page: number) {
  if (scopeKey === "krx-all") return page === 1 ? basePath : `${basePath}/${page}`;
  return `${basePath}/${scopeKey}~${page}`;
}

export function parseRankingPageSegment(segment: string) {
  const scoped = scopedSegment.exec(segment);
  return { page: Number(scoped ? scoped[2] : segment), scopeKey: scoped?.[1] };
}

export function getScopedRankingParams(manifest: StaticRankingManifest) {
  return Object.entries(manifest.scopes).flatMap(([scopeKey, data]) =>
    scopeKey === "krx-all" || data.state !== "published" ? [] : Object.keys(data.pages)
      .map(page => ({ page: `${scopeKey}~${page}` })));
}
