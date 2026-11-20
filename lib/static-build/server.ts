import {filterListingRows,isolateListingValues,listingContains,nameForListingPeriod,selectListingPeriod} from '../security-lifecycle';
import { availableDetailMetrics, financialDetailMetrics, financialMetricProvided, monthlyDividendHistory } from '../detail-metric-availability';
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
  archive?: {prices:SecurityFile['security']['prices'];marketcaps:SecurityFile['security']['marketcaps'];metrics:SecurityFile['metrics']};
  assets: StaticDetailAssets;
  rankings: Record<string, { ranking: Record<string, unknown>; neighbors: Record<string, unknown>[] }>;
};
type CompanyFile = {
  company: CompanyMarketcapAggregated;
  companySecs: Awaited<ReturnType<typeof readCompanySecurities>>;
  assets: StaticDetailAssets; neighbors: Record<string, unknown>[];
};
const cache = new Map<string, { value: unknown; bytes: number }>();
const detailAssetCache = new Map<string, StaticDetailAssets>();
const neighborValueCache = new Map<string, Map<string, unknown>>();
type Period = ReturnType<typeof selectListingPeriod>;
const memberCache = new Map<string, { period: Period; state: 'published' | 'unpublished'; availableMetrics: ReturnType<typeof availableDetailMetrics> }>();
const dividendCache = new Map<string, ReturnType<typeof monthlyDividendHistory>>();
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
    detailAssetCache.clear(); memberCache.clear(); dividendCache.clear(); neighborValueCache.clear();
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

export const STATIC_SEARCH_SECURITY_IDS_FILE = 'search-security-ids.json';

export function getStaticSearchIdentities() {
  const ids = readStaticJson<unknown>(STATIC_SEARCH_SECURITY_IDS_FILE);
  if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string')) {
    throw new Error('Invalid static search security IDs');
  }
  const searchable = new Set(ids);
  const rows = getStaticIdentities().filter(row => searchable.has(row.securityId));
  if (rows.length !== ids.length) throw new Error('Inconsistent static search security IDs');
  return rows;
}
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
  if (kind === 'company') return readStaticJson<CompanyFile>(`data/company/${id}.json`).assets;
  refreshStaticCache();
  return detailAssetCache.get(id) ?? securityDetailAssets(readStaticJson<SecurityFile>(`data/security/${id}.json`));
}
function securityDetailAssets(file: SecurityFile) {
  const cached = detailAssetCache.get(file.security.securityId);
  if (cached) return cached;
  const cutoff = securityHistoryCutoff(file);
  const periods = file.security.listingPeriods ?? [];
  const latest = selectListingPeriod(periods);
  const assets = { ...file.assets, historyCutoff: cutoff,
    listingMetricAvailability: periods.length > 1 ? periods.map(period => ({ periodId: period.periodId,
      metrics: staticAvailability(file, period, period.periodId === latest?.periodId ? cutoff : undefined,
        period.periodId !== latest?.periodId) })) : undefined };
  detailAssetCache.set(file.security.securityId, assets);
  return assets;
}

function securityHistoryCutoff(file: SecurityFile) {
  return getStaticManifest().sourcePublications?.['security_latest/krx-all']?.asOf ?? file.security.publication?.asOf;
}

function staticAvailability(file: SecurityFile, period: Period, cutoff?: string, historical = false) {
  const within = (row: { date: string }) => listingContains(period, row.date) && (!cutoff || row.date <= cutoff);
  const pending = new Set(financialDetailMetrics);
  for (const row of file.archive?.metrics ?? file.metrics) if (within(row)) {
    for (const metric of pending) if (financialMetricProvided(row, metric)) pending.delete(metric);
    if (!pending.size) break;
  }
  const observed = financialDetailMetrics.filter(metric => !pending.has(metric));
  const marketcap = (file.archive?.marketcaps ?? file.security.marketcaps).some(row => row.marketcap != null && within(row));
  return availableDetailMetrics(historical ? {} : file.security, marketcap ? ['marketcap', ...observed] : observed, period, cutoff);
}

function staticMemberDetails(file: SecurityFile) {
  const { security } = file;
  const cached = memberCache.get(security.securityId);
  if (cached) return cached;
  const period = selectListingPeriod(security.listingPeriods ?? []);
  const state = security.state === 'published' && listingContains(period, security.publication?.asOf) ? 'published' : 'unpublished';
  const details = { period, state, availableMetrics: staticAvailability(file, period, securityHistoryCutoff(file)) } as const;
  memberCache.set(security.securityId, details);
  return details;
}

function staticCompanyMembers(file: CompanyFile | null, includeDividends = false, current?: SecurityFile | null) {
  return file?.companySecs.map(member => {
    const id = member.securityId;
    let source = current?.security.securityId === id ? current : null;
    const getSource = () => source ??= readStaticJson<SecurityFile>(`data/security/${id}.json`);
    const { period, state, availableMetrics } = memberCache.get(id) ?? staticMemberDetails(getSource());
    const safe = isolateListingValues(member, period, false);
    let dividendHistory = includeDividends ? dividendCache.get(id) : undefined;
    if (includeDividends && !dividendHistory) {
      const observations = getSource();
      dividendHistory = monthlyDividendHistory(filterListingRows(observations.archive?.metrics ?? observations.metrics, period), securityHistoryCutoff(observations));
      dividendCache.set(id, dividendHistory);
      if (dividendCache.size > 256) dividendCache.delete(dividendCache.keys().next().value!);
    }
    return { ...safe, state, availableMetrics, ...(includeDividends ? { dividendHistory } : {}) };
  }) ?? [];
}

function staticSelectedSecurity(file: SecurityFile, selectedPeriod: Period, historicalPeriod: boolean) {
  const cutoff = historicalPeriod ? undefined : securityHistoryCutoff(file);
  const within = (row: { date: string }) => listingContains(selectedPeriod, row.date) && (!cutoff || row.date <= cutoff);
  const security = isolateListingValues(file.security, selectedPeriod, historicalPeriod);
  const published = security.state === 'published' && listingContains(selectedPeriod, security.publication?.asOf);
  return { ...security, selectedPeriod, historicalPeriod, historyCutoff: cutoff,
    korName: historicalPeriod ? nameForListingPeriod(file.security.korName || file.security.name, file.security.lifecycleEvents ?? [], selectedPeriod) : file.security.korName,
    exchange: historicalPeriod ? selectedPeriod?.displayExchange ?? file.security.exchange : file.security.exchange,
    prices: (file.archive?.prices ?? file.security.prices.toReversed()).filter(within).reverse(),
    marketcaps: (file.archive?.marketcaps ?? file.security.marketcaps).filter(within),
    publication: published ? security.publication : null, state: published ? 'published' as const : 'unpublished' as const,
    availableMetrics: historicalPeriod ? staticAvailability(file, selectedPeriod, cutoff, true) : staticMemberDetails(file).availableMetrics };
}

/** Older frozen inputs store neighbor identities in detail files and values in ranking pages. */
function staticSecurityNeighbors(file: SecurityFile, metric: string) {
  const rows = file.rankings[metric]?.neighbors ?? [];
  if (!rows.some(row => !Object.hasOwn(row, 'value')) || !getStaticManifest().sourcePublications?.[`security_rank/krx-all/${metric}`]) return rows;
  let values = neighborValueCache.get(metric);
  if (!values) {
    const pages = getStaticRankingManifest(metric, 'security').scopes['krx-all']?.pages ?? {};
    values = new Map();
    for (const url of Object.values(pages)) {
      const page = readStaticJson<{ items: {securityId: string; currentRank: number; value: unknown}[] }>(`assets/${url.replace(/^\//, '')}`);
      for (const row of page.items) values.set(`${row.currentRank}/${row.securityId}`, row.value);
    }
    neighborValueCache.set(metric, values);
  }
  return rows.map(row => ({ ...row, value: row.value ?? values.get(`${row.currentRank}/${row.securityId}`) ?? null }));
}

export function getStaticSecurityDetail<T>(code: string, metric: string, start?: string, end?: string,periodId?:string): T | null {
  const identity = resolveStaticSecurity(code); if (!identity) return null;
  const file = readStaticJson<SecurityFile>(`data/security/${identity.securityId}.json`);
  const selectedPeriod=selectListingPeriod(file.security.listingPeriods ?? [],periodId);
  if (periodId && !selectedPeriod) return null;
  const latest=selectListingPeriod(file.security.listingPeriods ?? []);
  const historicalPeriod=Boolean(selectedPeriod&&latest&&selectedPeriod.periodId!==latest.periodId);
  const companyFile = !historicalPeriod && identity.companyId ? readStaticJson<CompanyFile>(`data/company/${identity.companyId}.json`) : null;
  const security = staticSelectedSecurity(file, selectedPeriod, historicalPeriod);
  securityDetailAssets(file);
  const candidateRanking=historicalPeriod?null:file.rankings[metric]?.ranking;
  const ranking=candidateRanking && listingContains(selectedPeriod,typeof candidateRanking.rankDate==='string'?candidateRanking.rankDate:null)
    && (candidateRanking.valueObservedAt==null || listingContains(selectedPeriod,typeof candidateRanking.valueObservedAt==='string'?candidateRanking.valueObservedAt:null)) ? candidateRanking:null;
  const priceHistory=security.prices.toReversed();
  const source = metric === 'price' ? priceHistory : metric === 'marketcap' || metric === 'shares'
    ? security.marketcaps : file.archive?.metrics ?? file.metrics;
  return { security, company: companyFile?.company ?? null, companySecs: staticCompanyMembers(companyFile, metric === 'div' || metric === 'dps', file),
    priceHistory, history: filterListingRows<{date:string}>(source,selectedPeriod).filter(row => (!start || row.date >= start) && (!end || row.date <= end) && (!security.historyCutoff || row.date <= security.historyCutoff)),
    ranking, neighbors:ranking?.currentRank != null?staticSecurityNeighbors(file, metric):[] } as T;
}
export function getStaticCompanyDetail<T>(code: string, start?: string, end?: string): T | null {
  const identity = resolveStaticCompany(code); if (!identity) return null;
  const file = readStaticJson<CompanyFile>(`data/company/${identity.companyId}.json`);
  const representative = file.companySecs.find(row => row.type === '보통주');
  const representativeFile = representative ? readStaticJson<SecurityFile>(`data/security/${representative.securityId}.json`) : null;
  const security = representativeFile ? staticSelectedSecurity(representativeFile, selectListingPeriod(representativeFile.security.listingPeriods ?? []), false) : null;
  const company = file.company;
  return { company, companySecs: staticCompanyMembers(file, false, representativeFile), security, priceHistory: security?.prices.toReversed() ?? [],
    history: company.registeredHistory.filter(row => (!start || row.date >= start) && (!end || row.date <= end)),
    ranking: { currentRank: company.marketcapRank, priorRank: company.marketcapPriorRank,
      rankingState: company.rankingState, exclusionReason: company.exclusionReason, publication: company.publication,
      state: company.state, value: company.totalMarketcap, rankDate: company.publication?.asOf ?? null }, neighbors: file.neighbors } as T;
}
