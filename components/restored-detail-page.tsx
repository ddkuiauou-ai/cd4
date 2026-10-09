import { notFound } from 'next/navigation';
import { getCompanyDetailSnapshot, getSecurityDetailSnapshot } from '@/lib/data/detail-snapshot';
import { compareBusinessValues } from '@/lib/business-analysis';
import { detailObservations, sourceValue, type DetailMetric } from '@/lib/detail-presentation';
import { DetailSurface, prepareDetailAnalysis, type DetailSurfaceProps, type DetailSearch } from './detail-surface';
import { StaticDetailClient } from './static-detail-client';
import type { DetailCorporation, DetailPublication } from './detail-types';

export type { DetailSearch } from './detail-surface';
const asRows = (rows: readonly object[]) => rows as Record<string, unknown>[];
const corporationView = (row: DetailCorporation): DetailCorporation => ({name: row.name, korName: row.korName,
  logo: row.logo, industry: row.industry, establishedDate: row.establishedDate, homepage: row.homepage});
const publicationView = (row: DetailPublication | null): DetailPublication | null => row
  ? {asOf: row.asOf, revision: row.revision, scopeKey: row.scopeKey} : null;

/** Retain only current comparison values, identities and the matching official quote. */
export function compactDetailProps(props: DetailSurfaceProps): DetailSurfaceProps {
  const { security, company, metric } = props;
  const price = security?.state === 'published' && security.priceState === 'provided' ? security.price : null;
  const quote = props.prices.find(row => row.date === security?.priceDate && compareBusinessValues(sourceValue(row.close), price ?? null) === 0);
  return {
    ...props, history: [], sourceHistory: [], prices: quote ? [{date: quote.date, close: quote.close, rate: quote.rate, open: quote.open, volume: quote.volume}] : [],
    security: security ? {
      securityId: security.securityId, routeCode: security.routeCode, name: security.name, korName: security.korName,
      ticker: security.ticker, exchange: security.exchange, type: security.type, state: security.state,
      price: security.price, priceDate: security.priceDate, priceState: security.priceState, shares: security.shares, sharesDate: security.sharesDate,
      [metric]: security[metric], [`${metric}Date`]: security[`${metric}Date`], [`${metric}State`]: security[`${metric}State`],
      [`${metric}LastProvided`]: security[`${metric}LastProvided`], [`${metric}LastProvidedDate`]: security[`${metric}LastProvidedDate`],
      company: security.company ? corporationView(security.company) : null, publication: publicationView(security.publication),
    } : null,
    company: company ? {
      companyId: company.companyId, routeCode: company.routeCode, companyName: company.companyName, companyKorName: company.companyKorName,
      totalMarketcap: company.totalMarketcap, totalMarketcapDate: company.totalMarketcapDate, marketcapCompleteness: company.marketcapCompleteness,
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
      ticker: member.ticker, type: member.type, exchange: member.exchange, [metric]: member[metric],
      prices: member.prices?.slice(0, 1).map(row => ({close: row.close, rate: row.rate, date: row.date})),
    })),
    neighbors: props.neighbors.map(row => ({securityId: row.securityId, companyId: row.companyId, routeCode: row.routeCode,
      exchange: row.exchange, ticker: row.ticker, name: row.name, korName: row.korName, currentRank: row.currentRank, marketcapRank: row.marketcapRank})),
  };
}

async function renderDetail(props: DetailSurfaceProps, kind: 'security' | 'company', id: string) {
  if (process.env.NEXT_OUTPUT_MODE?.toLowerCase() !== 'export') return <DetailSurface {...props} />;
  const clientKey = `${kind}:${id}:${props.metric}`;
  if (process.env.STATIC_DETAIL_INLINE === '1') return props.basic ? <DetailSurface {...props} /> : <StaticDetailClient key={clientKey} initial={props} />;
  const compact = compactDetailProps(props);
  if (props.basic) return <DetailSurface {...compact} />;
  const initial = {...compact, initialAnalysis: prepareDetailAnalysis(props)};
  const { getStaticDetailAssets } = await import('@/lib/static-build/server');
  const assets = getStaticDetailAssets(kind, id);
  if (!assets) throw new Error(`Static detail assets missing: ${kind}/${id}`);
  return <StaticDetailClient key={clientKey} initial={initial} assets={assets} />;
}

export async function RestoredSecurityDetail({ code, metric = 'marketcap', basic = false, search = {} }: { code: string; metric?: DetailMetric; basic?: boolean; search?: DetailSearch }) {
  const data = await getSecurityDetailSnapshot(code, basic ? 'price' : metric);
  if (!data) notFound();
  return renderDetail({security: data.security, company: data.company, companySecs: data.companySecs, ranking: data.ranking,
    neighbors: asRows(data.neighbors), history: basic ? [] : detailObservations(asRows(data.history), metric),
    sourceHistory: asRows(data.history), prices: asRows(data.priceHistory), metric, basic, search}, 'security', data.security.securityId);
}

export async function RestoredCompanyDetail({ code, basic = false, search = {} }: { code: string; basic?: boolean; search?: DetailSearch }) {
  const data = await getCompanyDetailSnapshot(code);
  if (!data) notFound();
  return renderDetail({security: data.security, company: data.company, companySecs: data.companySecs, ranking: data.ranking,
    neighbors: asRows(data.neighbors), history: data.history.map(row => ({...row, value: row.totalMarketcap})),
    sourceHistory: asRows(data.history), prices: asRows(data.priceHistory), metric: 'marketcap', basic, companyPage: true, search}, 'company', data.company.companyId);
}
