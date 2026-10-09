import fs from 'node:fs';
import path from 'node:path';
import type { readSecurityByCode, readCompanySecurities } from '../data/security';
import type { readMetricsHistory } from '../data/history';
import type { CompanyMarketcapAggregated } from '../data/company';
import type { StaticDetailAssets } from '../static-detail-contract';
import type { StaticRankingManifest } from './types';

export function isStaticBuild() {
  return process.env.NEXT_OUTPUT_MODE?.toLowerCase() === 'export' && process.env.STATIC_PREPARING !== '1';
}
export type StaticIdentity = {
  securityId: string; companyId: string | null; name: string; korName: string;
  ticker: string; exchange: string; type: string | null; delistingDate: string | null;
  routeCode: string | null; companyRouteCode: string | null;
};
export type StaticManifest = {
  version: 1; snapshotId: string; generatedAt: string;
  sample: { enabled: boolean; selection?: string; securities: number; companies: number };
  routes: { path: string; kind: 'page' }[]; aliases: { path: string; target: string }[];
  securityCodes: string[]; companyCodes: string[];
  assets: { path: string; bytes: number; sha256: string }[]; requiredFiles: string[];
  securityAliases: Record<string, string>; companyAliases: Record<string, string>;
  companyRoutes: Record<string, string | null>;
  sourceRevisions: Record<string, string>;
  sourcePublications?: Record<string, { asOf: string | null; revision: string }>;
  referenceDate?: string | null;
};
type SecurityFile = {
  security: NonNullable<Awaited<ReturnType<typeof readSecurityByCode>>>;
  metrics: Awaited<ReturnType<typeof readMetricsHistory>>;
  assets: StaticDetailAssets;
  rankings: Record<string, { ranking: Record<string, unknown>; neighbors: Record<string, unknown>[] }>;
};
type CompanyFile = {
  company: CompanyMarketcapAggregated;
  companySecs: Awaited<ReturnType<typeof readCompanySecurities>>;
  assets: StaticDetailAssets; neighbors: Record<string, unknown>[];
};
const cache = new Map<string, { value: unknown; bytes: number }>();
let cachedBytes = 0;
let manifestMemo: StaticManifest | undefined;
let cachedGeneration: string | undefined;
export function staticInputDirectory() {
  return path.resolve(process.env.STATIC_SNAPSHOT_DIR || '.static-build');
}
function refreshStaticCache() {
  const directory = staticInputDirectory();
  const stat = fs.statSync(path.join(directory, 'manifest.json'), { bigint: true });
  const generation = `${directory}:${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
  if (generation !== cachedGeneration) {
    cache.clear(); cachedBytes = 0; manifestMemo = undefined; cachedGeneration = generation;
  }
}
export function readStaticJson<T>(relative: string): T {
  refreshStaticCache();
  const filename = path.join(staticInputDirectory(), relative);
  const cached = cache.get(filename);
  if (cached) { cache.delete(filename); cache.set(filename, cached); return cached.value as T; }
  const source = fs.readFileSync(filename, 'utf8');
  const value: unknown = JSON.parse(source);
  const bytes = Buffer.byteLength(source);
  if (bytes <= 16 * 1024 * 1024) {
    while (cachedBytes + bytes > 16 * 1024 * 1024 && cache.size) {
      const key = cache.keys().next().value!;
      cachedBytes -= cache.get(key)!.bytes; cache.delete(key);
    }
    cache.set(filename, { value, bytes }); cachedBytes += bytes;
  }
  return value as T;
}
export function getStaticManifest() {
  refreshStaticCache();
  if (manifestMemo) return manifestMemo;
  const manifest = readStaticJson<StaticManifest>('manifest.json');
  if (manifest.version !== 1) throw new Error('Unsupported static input version');
  manifestMemo = manifest;
  return manifest;
}
export function getStaticIdentities() { return readStaticJson<StaticIdentity[]>('identities.json'); }
export function resolveStaticSecurity(code: string) {
  let decoded: string; try { decoded = decodeURIComponent(code); } catch { return null; }
  const aliases = getStaticManifest().securityAliases;
  const id = Object.hasOwn(aliases, decoded) ? aliases[decoded] : undefined;
  return id ? getStaticIdentities().find(row => row.securityId === id) ?? null : null;
}
export function resolveStaticCompany(code: string) {
  let decoded: string; try { decoded = decodeURIComponent(code); } catch { return null; }
  const aliases = getStaticManifest().companyAliases;
  const id = Object.hasOwn(aliases, decoded) ? aliases[decoded] : undefined;
  return id ? readStaticJson<{ companyId: string; name: string; korName: string | null }[]>(
    'companies.json').find(row => row.companyId === id) ?? null : null;
}
export function getStaticRouteParams(kind: 'security' | 'company') {
  return getStaticManifest()[kind === 'security' ? 'securityCodes' : 'companyCodes'].map(secCode => ({ secCode }));
}
export function getStaticRankingManifest(metric: string, scope: 'security' | 'company'): StaticRankingManifest {
  return readStaticJson<StaticRankingManifest>(`rankings/${scope}-${metric}.json`);
}
export function getStaticRankingParams(metric: string, scope: 'security' | 'company') {
  const max = Math.max(1, ...Object.values(getStaticRankingManifest(metric, scope).scopes).map(row => row.totalPages));
  return Array.from({ length: max }, (_, index) => ({ page: String(index + 1) }));
}
export function getStaticRankingPage<T>(metric: string, scope: 'security' | 'company', page: number, scopeKey = 'krx-all', expectedRevision?: string | null, descending = false): T {
  const scopes = getStaticRankingManifest(metric, scope).scopes;
  const entry = Object.hasOwn(scopes, scopeKey) ? scopes[scopeKey] : undefined;
  const changed = expectedRevision != null && (!entry?.publication || entry.publication.revision !== expectedRevision);
  const normalPage = Math.max(1, Math.floor(page) || 1);
  const skip = normalPage === 1 ? 0 : 20 + (normalPage - 2) * 100;
  if (!entry?.pages[String(normalPage)] || changed) return {
    state: entry?.state ?? 'unpublished', publication: entry?.publication ?? null,
    revisionChanged: changed, items: [], latestDate: entry?.publication?.asOf ?? null,
    totalCount: entry?.totalCount ?? 0, totalPages: entry?.totalPages ?? 1,
    page: normalPage, pageSize: normalPage === 1 ? 20 : 100, skip,
  } as T;
  const result = readStaticJson<T & { items: unknown[] }>(`assets/${entry.pages[String(normalPage)].replace(/^\//, '')}`);
  if (!descending) return result;
  // Stable sort retains the provider's ascending ID tie-break within a rank.
  // Descending queries are rare; normal exported pages read only one file.
  const items = Object.entries(entry.pages).sort(([a], [b]) => Number(a) - Number(b)).flatMap(([, url]) =>
    readStaticJson<{ items: Record<string, unknown>[] }>(`assets/${url.replace(/^\//, '')}`).items);
  items.sort((a, b) => Number(b.currentRank ?? b.marketcapRank) - Number(a.currentRank ?? a.marketcapRank));
  return { ...result, items: items.slice(skip, skip + (normalPage === 1 ? 20 : 100)) };
}
export function getStaticRankingCsv(scope: 'security' | 'company', metric: string) {
  const entry = getStaticRankingManifest(metric, scope).scopes['krx-all'];
  if (!entry?.csv) return { body: '순위 결과가 아직 공개되지 않았습니다.', status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' } };
  return { body: fs.readFileSync(path.join(staticInputDirectory(), 'assets', entry.csv.url), 'utf8'), status: 200,
    headers: readStaticJson<Record<string, string>>(`rankings/${scope}-${metric}-headers.json`) };
}
export function getStaticDetailAssets(kind: 'security' | 'company', id: string): StaticDetailAssets | null {
  return readStaticJson<SecurityFile | CompanyFile>(`data/${kind}/${id}.json`).assets;
}
export function getStaticSecurityDetail<T>(code: string, metric: string, start?: string, end?: string): T | null {
  const identity = resolveStaticSecurity(code); if (!identity) return null;
  const file = readStaticJson<SecurityFile>(`data/security/${identity.securityId}.json`);
  const companyFile = identity.companyId ? readStaticJson<CompanyFile>(`data/company/${identity.companyId}.json`) : null;
  const priceHistory = file.security.prices.toReversed();
  const source = metric === 'price' ? priceHistory : metric === 'marketcap' || metric === 'shares'
    ? file.security.marketcaps : file.metrics;
  return { security: file.security, company: companyFile?.company ?? null, companySecs: companyFile?.companySecs ?? [],
    priceHistory, history: source.filter(row => (!start || row.date >= start) && (!end || row.date <= end)),
    ranking: file.rankings[metric]?.ranking ?? null, neighbors: file.rankings[metric]?.neighbors ?? [] } as T;
}
export function getStaticCompanyDetail<T>(code: string, start?: string, end?: string): T | null {
  const identity = resolveStaticCompany(code); if (!identity) return null;
  const file = readStaticJson<CompanyFile>(`data/company/${identity.companyId}.json`);
  const representative = file.companySecs.find(row => row.type === '보통주');
  const security = representative ? readStaticJson<SecurityFile>(`data/security/${representative.securityId}.json`).security : null;
  const company = file.company;
  return { company, companySecs: file.companySecs, security, priceHistory: security?.prices.toReversed() ?? [],
    history: company.registeredHistory.filter(row => (!start || row.date >= start) && (!end || row.date <= end)),
    ranking: { currentRank: company.marketcapRank, priorRank: company.marketcapPriorRank,
      rankingState: company.rankingState, exclusionReason: company.exclusionReason, publication: company.publication,
      state: company.state, value: company.totalMarketcap, rankDate: company.publication?.asOf ?? null }, neighbors: file.neighbors } as T;
}
