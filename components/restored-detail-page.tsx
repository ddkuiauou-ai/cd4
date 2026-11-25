import { notFound } from 'next/navigation';
import { getCompanyDetailSnapshot, getSecurityDetailSnapshot } from '@/lib/data/detail-snapshot';
import { compareBusinessValues, summarizeBusinessWindow } from '@/lib/business-analysis';
import { detailObservations, earlierDate, selectDetailRange, sourceValue, type DetailMetric } from '@/lib/detail-presentation';
import { lastMonthlyObservations, monthlyDetailPoints, type DetailTrendPreview } from './detail-chart-observations';
import { detailMetricOrder } from '@/lib/detail-metric-availability';
import { DetailSurface, prepareDetailAnalysis, type DetailSurfaceProps, type DetailSearch } from './detail-surface';
import { StaticDetailClient } from './static-detail-client';
import { CompanyDetailClient } from './company-detail-client';
import type { DetailCorporation, DetailPublication } from './detail-types';

export type { DetailSearch } from './detail-surface';
const asRows = (rows: readonly object[]) => rows as Record<string, unknown>[];
const corporationView = (row: DetailCorporation): DetailCorporation => ({name: row.name, korName: row.korName,
  logo: row.logo, industry: row.industry, establishedDate: row.establishedDate, homepage: row.homepage});
const publicationView = (row: DetailPublication | null): DetailPublication | null => row
  ? {asOf: row.asOf, revision: row.revision, scopeKey: row.scopeKey} : null;
const detailValueFields = ['price', ...detailMetricOrder].flatMap(metric =>
  [metric, `${metric}Date`, `${metric}State`, `${metric}LastProvided`, `${metric}LastProvidedDate`]);
const compactValues = (row: object) => Object.fromEntries(detailValueFields.flatMap(field =>
  Object.hasOwn(row, field) ? [[field, (row as Record<string, unknown>)[field]]] : []));

/** Retain comparison values, identities and the matching official quote. */
export function compactDetailProps(props: DetailSurfaceProps): DetailSurfaceProps {
  const { security, company, metric } = props;
  const price = security?.state === 'published' && security.priceState === 'provided' ? security.price : null;
  const quote = props.prices.find(row => row.date === security?.priceDate && compareBusinessValues(sourceValue(row.close), price ?? null) === 0);
  return {
    ...props, history: [], sourceHistory: [], prices: quote ? [Object.fromEntries(
      ['date', 'open', 'high', 'low', 'close', 'volume', 'rate'].flatMap(field => Object.hasOwn(quote, field) ? [[field, quote[field]]] : []))] : [],
    security: security ? {
      securityId: security.securityId, routeCode: security.routeCode, name: security.name, korName: security.korName,
      listingPeriods:security.listingPeriods,lifecycleEvents:security.lifecycleEvents,selectedPeriod:security.selectedPeriod,historicalPeriod:security.historicalPeriod,
      ticker: security.ticker, exchange: security.exchange, type: security.type, state: security.state,
      price: security.price, priceDate: security.priceDate, priceState: security.priceState, shares: security.shares, sharesDate: security.sharesDate,
      ...compactValues(security), availableMetrics: security.availableMetrics,
      company: security.company ? corporationView(security.company) : null, publication: publicationView(security.publication),
    } : null,
    company: company ? {
      companyId: company.companyId, routeCode: company.routeCode, companyName: company.companyName, companyKorName: company.companyKorName,
      totalMarketcap: company.totalMarketcap, totalMarketcapDate: company.totalMarketcapDate, marketcapCompleteness: company.marketcapCompleteness,
      marketcapRank: company.marketcapRank, exclusionReason: company.exclusionReason,
      state: company.state, compositionComplete: company.compositionComplete, compositionReason: company.compositionReason,
      compositionObservedCount: company.compositionObservedCount, compositionTargetCount: company.compositionTargetCount,
      company: corporationView(company.company), publication: publicationView(company.publication),
      aggregatedHistory: [], registeredHistory: [], securities: company.securities.map(member => ({
        securityId: member.securityId, routeCode: member.routeCode, name: member.name, korName: member.korName,
        ticker: member.ticker, exchange: member.exchange, type: member.type, marketcap: member.marketcap,
        marketcapDate: member.marketcapDate, percentage: member.percentage, marketcapHistory: [],
      })),
    } : null,
    ranking: props.ranking ? {currentRank: props.ranking.currentRank, priorRank: props.ranking.priorRank, rankDate: props.ranking.rankDate,
      rankingState: props.ranking.rankingState, exclusionReason: props.ranking.exclusionReason} : null,
    companySecs: props.companySecs.map(member => ({
      securityId: member.securityId, routeCode: member.routeCode, name: member.name, korName: member.korName,
      ticker: member.ticker, type: member.type, exchange: member.exchange, ...compactValues(member),
      state: member.state, availableMetrics: member.availableMetrics, dividendHistory: member.dividendHistory,
      dividendReference: member.dividendReference, dpsRanking: member.dpsRanking,
      marketcapReferencePrices: member.marketcapReferencePrices,
      marketcapRanking: member.marketcapRanking,
      prices: member.prices?.slice(0, 1).map(row => ({close: row.close, rate: row.rate, date: row.date})),
    })),
    neighbors: props.neighbors.map(row => ({securityId: row.securityId, companyId: row.companyId, routeCode: row.routeCode,
      exchange: row.exchange, ticker: row.ticker, name: row.name, korName: row.korName, currentRank: row.currentRank,
      marketcapRank: row.marketcapRank, value: row.value ?? row[metric] ?? row.totalMarketcap})),
  };
}

function recentSlice<Row extends { date: string }>(rows: readonly Row[], date: string, warmup = 0) {
  const first = rows.findIndex(row => row.date >= date);
  return first < 0 ? [] : rows.slice(Math.max(0, first - warmup));
}

function seedMarketcapDetail(initial: DetailSurfaceProps, original: DetailSurfaceProps, end: string): DetailSurfaceProps {
  const recent = earlierDate(end, 3);
  const visible = selectDetailRange(original.history, earlierDate(end, 60), end);
  const history = [...lastMonthlyObservations(visible.filter(row => row.date < recent)).values(),
    ...visible.filter(row => row.date >= recent)];
  const aggregates = original.company?.aggregatedHistory ?? [];
  const coverage = lastMonthlyObservations(aggregates.filter(row => row.date >= earlierDate(end, 60) && row.date < recent)
    .map(row => ({ date: row.date, value: row.totalMarketcap })));
  const monthlyDates = new Set([...coverage.values()].map(row => row.date));
  const company = initial.company && {
    ...initial.company,
    aggregatedHistory: aggregates.filter(row => row.date <= end && (row.date >= recent || monthlyDates.has(row.date))),
  };
  const priceRows = original.prices.flatMap(({ date, open, high, low, close, volume, rate }) =>
    typeof date === 'string' ? [{ date, open, high, low, close, volume, rate }] : []);
  const latestPrice = priceRows.at(-1)?.date ?? end;
  const prices = recentSlice(priceRows, earlierDate(latestPrice, 3), 9);
  return { ...initial, history, prices, company };
}

function prepareTrendPreview(props: DetailSurfaceProps, analysis: ReturnType<typeof prepareDetailAnalysis>): DetailTrendPreview {
  const end = analysis.analysisEnd;
  const range = selectDetailRange(props.history, earlierDate(end, props.metric === 'dps' ? 12 : 60), end);
  const points = props.metric === 'bps' ? analysis.annualRows.slice(0, 5).toReversed()
    : props.metric === 'dps' ? range : monthlyDetailPoints(range);
  return { points: points.map(point => [point.date, point.value]), sourceCount: summarizeBusinessWindow(range).count };
}

async function renderDetail(props: DetailSurfaceProps, kind: 'security' | 'company', id: string) {
  if (process.env.NEXT_OUTPUT_MODE?.toLowerCase() !== 'export') return kind === 'company' ? <CompanyDetailClient {...props} /> : <DetailSurface {...props} />;
  const clientKey = `${kind}:${id}:${props.metric}`;
  if (process.env.STATIC_DETAIL_INLINE === '1') return kind === 'company' && props.basic
    ? <CompanyDetailClient {...props} />
    : <StaticDetailClient key={clientKey} initial={props} />;
  const compact = compactDetailProps(props);
  const initial = {...compact, initialAnalysis: prepareDetailAnalysis(props)};
  const { getStaticDetailAssets } = await import('@/lib/static-build/server');
  const assets = getStaticDetailAssets(kind, id, props.metric);
  if (!assets) throw new Error(`Static detail assets missing: ${kind}/${id}`);
  if (assets.yearly && props.basic) return <StaticDetailClient key={clientKey} initial={initial} assets={assets} />;
  if (assets.yearly && props.metric === 'marketcap') {
    return <StaticDetailClient key={clientKey} initial={seedMarketcapDetail(initial, props, initial.initialAnalysis.analysisEnd)} assets={assets} />;
  }
  if (assets.yearly || assets.perHistory && props.metric === 'per' && kind === 'security') {
    return <StaticDetailClient key={clientKey} initial={initial} assets={assets} trendPreview={prepareTrendPreview(props, initial.initialAnalysis)} />;
  }
  return <StaticDetailClient key={clientKey} initial={initial} assets={assets} />;
}

export async function RestoredSecurityDetail({ code, metric = 'marketcap', search = {} }: { code: string; metric?: DetailMetric; search?: DetailSearch }) {
  const periodId=Array.isArray(search.period)?search.period[0]:search.period;
  const data = periodId ? await getSecurityDetailSnapshot(code,metric,undefined,undefined,periodId) : await getSecurityDetailSnapshot(code,metric);
  if (!data) notFound();
  return renderDetail({security: data.security, company: data.company, companySecs: data.companySecs, ranking: data.ranking,
    neighbors: asRows(data.neighbors), history: detailObservations(asRows(data.history), metric),
    sourceHistory: asRows(data.history), prices: asRows(data.priceHistory), metric, basic: false, search}, 'security', data.security.securityId);
}

export async function RestoredCompanyDetail({ code, basic = false, search = {} }: { code: string; basic?: boolean; search?: DetailSearch }) {
  const data = await getCompanyDetailSnapshot(code);
  if (!data) notFound();
  return renderDetail({security: data.security, company: data.company, companySecs: data.companySecs, ranking: data.ranking,
    neighbors: asRows(data.neighbors), history: data.history.map(row => ({...row, value: row.totalMarketcap})),
    sourceHistory: asRows(data.history), prices: asRows(data.priceHistory), metric: 'marketcap', basic, companyPage: true, search}, 'company', data.company.companyId);
}
