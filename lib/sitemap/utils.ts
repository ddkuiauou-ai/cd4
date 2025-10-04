import { siteConfig } from "@/config/site";
import type { MetricType } from "@/db/schema-postgres";
import { countCompanyMarketcaps } from "@/lib/data/company";
import { computeTotalPagesMixed } from "@/lib/data/pagination";
import { countSecurityRanks } from "@/lib/data/security";
import { getAllCompanyCodes, getAllSecurityCodes } from "@/lib/select";

const METRIC_CONFIG: Array<{ metric: MetricType; basePath: string }> = [
  { metric: "marketcap", basePath: "/marketcap" },
  { metric: "per", basePath: "/per" },
  { metric: "pbr", basePath: "/pbr" },
  { metric: "bps", basePath: "/bps" },
  { metric: "eps", basePath: "/eps" },
  { metric: "div", basePath: "/div" },
  { metric: "dps", basePath: "/dps" },
];

const SECURITY_DETAIL_SEGMENTS = [
  "marketcap",
  "per",
  "pbr",
  "bps",
  "eps",
  "div",
  "dps",
] as const;

const CORE_STATIC_PATHS = ["/", "/dashboard"];

export const SITEMAP_CHUNK_SIZE = 5000;

const dedupe = (paths: string[]) => Array.from(new Set(paths));

const ensureLeadingSlash = (path: string) =>
  path.startsWith("/") ? path : `/${path}`;

async function getMetricPaths(): Promise<string[]> {
  const metricPageLists = await Promise.all(
    METRIC_CONFIG.map(async ({ metric, basePath }) => {
      const total = await countSecurityRanks(metric);
      const totalPages = computeTotalPagesMixed(total);

      const paths: string[] = [basePath];

      for (let page = 2; page <= totalPages; page += 1) {
        paths.push(`${basePath}/${page}`);
      }

      return paths;
    })
  );

  const companyTotal = await countCompanyMarketcaps();
  const companyPages = computeTotalPagesMixed(companyTotal);
  const marketcapsPaths: string[] = ["/marketcaps"];

  for (let page = 2; page <= companyPages; page += 1) {
    marketcapsPaths.push(`/marketcaps/${page}`);
  }

  return dedupe(metricPageLists.flat().concat(marketcapsPaths));
}

export async function getCorePaths(): Promise<string[]> {
  const metricPaths = await getMetricPaths();
  const combined = CORE_STATIC_PATHS.concat(metricPaths);
  return dedupe(combined.map(ensureLeadingSlash));
}

export async function getSecurityPaths(): Promise<string[]> {
  const codes = await getAllSecurityCodes();
  const paths: string[] = [];

  for (const rawCode of dedupe(codes)) {
    const encodedCode = encodeURIComponent(rawCode);
    const basePath = `/security/${encodedCode}`;
    paths.push(basePath);

    for (const segment of SECURITY_DETAIL_SEGMENTS) {
      paths.push(`${basePath}/${segment}`);
    }
  }

  return paths;
}

export async function getCompanyPaths(): Promise<string[]> {
  const codes = await getAllCompanyCodes();
  const paths: string[] = [];

  for (const rawCode of dedupe(codes)) {
    const encodedCode = encodeURIComponent(rawCode);
    const basePath = `/company/${encodedCode}`;
    paths.push(basePath, `${basePath}/marketcap`);
  }

  return paths;
}

export function chunkPaths(paths: string[]): string[][] {
  if (paths.length === 0) {
    return [];
  }

  const chunks: string[][] = [];
  for (let i = 0; i < paths.length; i += SITEMAP_CHUNK_SIZE) {
    chunks.push(paths.slice(i, i + SITEMAP_CHUNK_SIZE));
  }
  return chunks;
}

export async function getSitemapChunks() {
  const [corePaths, securityPaths, companyPaths] = await Promise.all([
    getCorePaths(),
    getSecurityPaths(),
    getCompanyPaths(),
  ]);

  return {
    core: chunkPaths(corePaths),
    securities: chunkPaths(securityPaths),
    companies: chunkPaths(companyPaths),
  } as const;
}

export const withBaseUrl = (
  paths: string[],
  lastModified: Date,
  baseUrl: string = siteConfig.url
) =>
  paths.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified,
  }));
