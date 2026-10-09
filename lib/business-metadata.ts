import type { Metadata } from "next";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema-postgres";
import { siteConfig } from "@/config/site";
import { companyPath, securityPath } from './entity-paths';
import { getEntityRouteInventory } from './entity-route-inventory';

type Search = Record<string, string | string[] | undefined>;
type Metric = schema.MetricType | "price";
const metricLabels: Record<Metric, string> = {
  price: "종가", marketcap: "시가총액", bps: "BPS", per: "PER", pbr: "PBR",
  eps: "EPS", div: "배당수익률", dps: "주당배당금",
};

export function businessMetadata(title: string, description: string, path: string): Metadata {
  const url = new URL(path, siteConfig.url);
  // Match this project's trailingSlash route convention, keeping query parameters.
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  const canonical = url.toString();
  return {
    title, description,
    alternates: { canonical },
    openGraph: {
      title, description, url: canonical, siteName: siteConfig.name, type: "website", locale: "ko_KR",
      images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
    },
    twitter: { card: "summary_large_image", title, description, images: [siteConfig.ogImage] },
  };
}

/** Route metadata describes its identity and purpose, never reconstructs official results. */
export function rankingMetadata(metric: schema.MetricType | null, path: string, search: Search = {}): Metadata {
  const title = metric ? `${metricLabels[metric]} 종목 순위` : "회사 시가총액 순위";
  const scope = typeof search.scope === "string" && /^[A-Za-z0-9._-]{1,80}$/.test(search.scope) ? search.scope : "krx-all";
  const canonicalPath = metric && scope !== "krx-all" ? `${path}?scope=${encodeURIComponent(scope)}` : path;
  return businessMetadata(title, `${title}를 공개 기준일과 대상 범위, 관측일과 함께 확인하세요. 공개된 계산 결과와 미제공 상태를 구분해 표시합니다.`, canonicalPath);
}

function decodedIdentity(code: string): string | null {
  try { return decodeURIComponent(code); } catch { return null; }
}

async function securityIdentity(code: string) {
  const decoded = decodedIdentity(code);
  if (!decoded) return null;
  const columns = { securityId: true, companyId: true, name: true, korName: true, ticker: true, exchange: true } as const;
  const identity = await db.query.security.findFirst({ columns, where: eq(schema.security.securityId, decoded) });
  if (identity) return identity;
  const separator = decoded.indexOf(".");
  const where = separator > 0
    ? and(eq(schema.security.exchange, decoded.slice(0, separator)), eq(schema.security.ticker, decoded.slice(separator + 1)))
    : or(eq(schema.security.name, decoded), eq(schema.security.korName, decoded), eq(schema.security.ticker, decoded));
  const matches = await db.query.security.findMany({ columns, where, limit: 2 });
  return matches.length === 1 ? matches[0] : null;
}

function missingMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: true }, alternates: { canonical: null }, openGraph: null, twitter: null };
}

export async function securityMetadata(code: string, metric: Metric = "price"): Promise<Metadata> {
  const identity = await securityIdentity(code);
  if (!identity) return missingMetadata("종목을 찾을 수 없습니다");
  const name = identity.korName || identity.name;
  const label = metricLabels[metric];
  const routes = await getEntityRouteInventory();
  const path = securityPath({ ...identity, routeCode: routes.securities.get(identity.securityId) ?? null }, metric);
  return businessMetadata(`${name} ${label}·종목 이력`, `${name} (${identity.exchange} ${identity.ticker})의 ${label}, 최신 관측과 마지막 제공값, 선택 기간의 원천 이력을 확인하세요.`, path);
}

export async function companyMetadata(code: string, marketcapDetail = false): Promise<Metadata> {
  const decoded = decodedIdentity(code);
  if (!decoded) return missingMetadata("회사를 찾을 수 없습니다");
  const columns = { companyId: true, name: true, korName: true } as const;
  let identity = await db.query.company.findFirst({ columns, where: eq(schema.company.companyId, decoded) });
  if (!identity) {
    const security = await securityIdentity(code);
    if (security?.companyId) identity = await db.query.company.findFirst({ columns, where: eq(schema.company.companyId, security.companyId) });
  }
  if (!identity) return missingMetadata("회사를 찾을 수 없습니다");
  const name = identity.korName || identity.name;
  const routes = await getEntityRouteInventory();
  return businessMetadata(`${name} 회사 공식 시가총액`, `${name}의 공식 시가총액, 합산 기준일과 완전성, 공개 순위를 확인하세요. 자료나 연결 근거가 부족한 상태를 함께 표시합니다.`,
    companyPath({ ...identity, routeCode: routes.companies.get(identity.companyId) ?? null }, marketcapDetail ? "marketcap" : undefined));
}

export const dashboardMetadata = businessMetadata("국내 주식 지표 대시보드", "국내 기업의 시가총액과 대표 종목의 주가 흐름을 확인하고 전체 순위를 탐색하세요.", "/dashboard");
