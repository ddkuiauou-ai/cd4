import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import type { getSecurityDetailSnapshot } from '@/lib/data/detail-snapshot';
import type { SecurityListingPeriod, SecurityLifecycleEvent } from '@/lib/security-lifecycle';
import { businessChangePercent, compareBusinessValues, formatMarketcapAmount, isBusinessDay, subtractBusinessValues, summarizeBusinessWindow } from '@/lib/business-analysis';
import { formatInvestorAmount, formatInvestorNumber, usesInvestorPrecision } from '@/lib/investor-number';
import { prepareDetailComparison } from '@/lib/detail-comparison';
import { DETAIL_METRICS, detailAnnualRows, detailObservations, periodMeans, selectDetailRange, sourceValue, type DetailMetric, type DetailObservation, type DetailAnnualRow } from '@/lib/detail-presentation';
import { companyPath, securityPath, securityRouteCode } from '@/lib/entity-paths';
import { recentDetailPath } from '@/lib/recent-securities';
import { siteConfig } from '@/config/site';
import type { DetailSecurityRow, DetailCompanyView, DetailCorporation, DetailPublication } from './detail-types';
import { CompanyProfile, CompanyMarketcapOverview } from './company-detail-overview';
import { DetailHeaderOutline, DetailInvestorNavigation, DetailInvestorOutline, DetailInvestorRail, DetailMarketcapSwitch, DetailMarketcapTitleSwitch, DetailMetricMenu, type DetailRailFact } from './detail-investor-navigation';
import { hasMarketcapHierarchy, MarketcapAmount, MarketcapBreakdown, type MarketcapCompositionModel } from './detail-marketcap-composition';
import {
  annualDividendComparison, companyMetricLinks, ConstituentsTable, detailEntityMembers, detailHref, detailMetricLabel, detailNavGroups, DetailRecordHeading, detailSwitchCandidates, detailValue,
  dividendComparisonHeading, DividendTable, InvestorTable, metricAvailable, securityName, securityValue, StockSelection,
  valuationReference, ValuationSummary, type ValuationObservation,
} from './detail-investor-records';
import { DetailHistoryChart } from './detail-history-chart';
import { MarketcapRangeLink } from './marketcap-chart-range';
import { PeriodStats } from './detail-period-stats';
import { DetailFinancialAnalysis, DetailPriceHistory, DetailAnnualHistory, DividendComparisonChart } from './restored-detail-charts';
import { FinancialAnnualMetadata } from './detail-annual-table';
import { DetailAnnualSkeleton, DetailChartSkeleton } from './detail-record-skeleton';
import { InteractiveChartSection } from './interactive-chart-section';
import { StickyCompanyHeader } from './sticky-company-header';
import { SecurityLifecycle } from './security-lifecycle';
import { RecentSecurityTracker } from './recent-security-tracker';
import { CsvDownloadButton } from './CsvDownloadButton';
import ShareButton from './share-button';
import styles from './detail-investor-summary.module.css';
import layoutStyles from './detail.module.css';

export type DetailSearch = Record<string, string | string[] | undefined>;
type SecuritySnapshot = NonNullable<Awaited<ReturnType<typeof getSecurityDetailSnapshot>>>;
type MetricField = DetailMetric | `${DetailMetric}Date` | `${DetailMetric}State` | `${DetailMetric}LastProvided` | `${DetailMetric}LastProvidedDate`;
export type DetailSecurityView = Pick<SecuritySnapshot['security'],
  'securityId' | 'routeCode' | 'name' | 'korName' | 'ticker' | 'exchange' | 'type' | 'state'
  | 'price' | 'priceDate' | 'priceState' | 'shares' | 'sharesDate'> & Partial<Pick<SecuritySnapshot['security'], MetricField>> & {
  company: DetailCorporation | null;
  publication: DetailPublication | null;
  listingPeriods?: SecurityListingPeriod[];
  lifecycleEvents?: SecurityLifecycleEvent[];
  selectedPeriod?: SecurityListingPeriod | null;
  historicalPeriod?: boolean;
  availableMetrics?: DetailMetric[];
};

type Ranking = { currentRank: number | null; priorRank?: number | null; rankDate?: string | null; rankingState?: string | null; exclusionReason?: string | null } | null;
const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export interface DetailSurfaceProps {
  security: DetailSecurityView | null;
  company: DetailCompanyView | null;
  companySecs: DetailSecurityRow[];
  ranking: Ranking;
  neighbors: Record<string, unknown>[];
  history: DetailObservation[];
  sourceHistory: Record<string, unknown>[];
  prices: Record<string, unknown>[];
  metric: DetailMetric;
  basic: boolean;
  companyPage?: boolean;
  search: DetailSearch;
  initialAnalysis?: DetailAnalysis;
  initialSnapshotAnalysis?: DetailSnapshotAnalysis;
  historyPending?: boolean;
  historyError?: string;
  onRetry?: () => void;
}

export interface DetailAnalysis {
  analysisEnd: string;
  summary: ReturnType<typeof summarizeBusinessWindow>;
  means: ReturnType<typeof periodMeans>;
  priorObservation: { date: string; value: DetailObservation['value'] } | null;
  priorIsPreviousTrade?: boolean;
  snapshotChange: string | null;
  snapshotDifference: string | null;
  priorValueSign: number | null;
  snapshotComparisonReason: string | null;
  annualRows: DetailAnnualRow[];
  hasHistory: boolean;
  historyEnd?: string;
  previousValuation?: ValuationObservation | null;
  priceAnnual?: DetailAnnualRow[];
}

type DetailSnapshotAnalysis = Pick<DetailAnalysis, 'priorObservation' | 'priorIsPreviousTrade' | 'snapshotChange' | 'snapshotDifference' | 'priorValueSign'
  | 'snapshotComparisonReason' | 'hasHistory' | 'historyEnd' | 'previousValuation'>;

function priceObservations(rows: Record<string, unknown>[]) {
  return rows.flatMap(row => typeof row.date === 'string' && isBusinessDay(row.date) && sourceValue(row.close) != null
    ? [{ date: row.date, value: sourceValue(row.close) }] : []).sort((left, right) => left.date.localeCompare(right.date));
}

function previousTradeDate(prices: Record<string, unknown>[], day: string) {
  let previous: string | null = null;
  for (const row of prices) {
    const date = row.date;
    if (typeof date === 'string' && date < day && (!previous || date > previous)
      && isBusinessDay(date) && compareBusinessValues(sourceValue(row.close), 0) != null) previous = date;
  }
  return previous;
}

type DetailAnalysisInput = Pick<DetailSurfaceProps, 'security' | 'company' | 'history' | 'metric' | 'companyPage' | 'search'>
  & Partial<Pick<DetailSurfaceProps, 'basic' | 'sourceHistory' | 'prices'>>;

export function prepareDetailAnalysis({ security, company, history, metric, companyPage = false, basic, search, sourceHistory = [], prices = [] }: DetailAnalysisInput): DetailAnalysis {
  const snapshot = companyPage
    ? { value: company?.state === 'published' ? company.totalMarketcap : null, date: company?.totalMarketcapDate ?? null }
    : securityValue(security, metric);
  const publication = companyPage ? company?.publication : security?.publication;
  const start = single(search.start), end = single(search.end);
  const invalid = !validRange(start, end);
  const selected = invalid ? [] : selectDetailRange(history, start, end);
  const analysisEnd = validRange(start, end) && end || (security?.historicalPeriod ? history.at(-1)?.date : publication?.asOf) || history.at(-1)?.date || '';
  const snapshotObservation = snapshot.value == null ? null : history.find(row => row.date === snapshot.date && compareBusinessValues(row.value, snapshot.value) === 0);
  const priorObservation = snapshotObservation ? history.findLast(row => row.date < snapshotObservation.date && row.value != null) ?? null : null;
  const sameCoverage = !companyPage || snapshotObservation && priorObservation && JSON.stringify([...(snapshotObservation.observedSecurityIds ?? [])].sort()) === JSON.stringify([...(priorObservation.observedSecurityIds ?? [])].sort());
  const priceRows = metric === 'marketcap' ? priceObservations(prices) : [];
  const priceAnnual = metric === 'marketcap' ? detailAnnualRows(invalid ? [] : selectDetailRange(priceRows, start, end)) : undefined;
  const price = securityValue(security, 'price');
  const priorIsPreviousTrade = !basic && !companyPage && (metric === 'per' || metric === 'pbr' || metric === 'div' || metric === 'dps')
    && !!priorObservation && !!snapshot.date && snapshot.date === price.date && price.value != null
    && prices.some(row => row.date === price.date && compareBusinessValues(sourceValue(row.close), price.value) === 0)
    && previousTradeDate(prices, snapshot.date) === priorObservation.date;
  return {
    analysisEnd, summary: summarizeBusinessWindow(selected), means: periodMeans(selected, analysisEnd),
    priorObservation: priorObservation ? { date: priorObservation.date, value: priorObservation.value } : null,
    priorIsPreviousTrade,
    snapshotChange: priorObservation && sameCoverage ? businessChangePercent(priorObservation.value, snapshot.value) : null,
    snapshotDifference: priorObservation && sameCoverage ? subtractBusinessValues(snapshot.value, priorObservation.value) : null,
    priorValueSign: priorObservation ? compareBusinessValues(priorObservation.value, 0) : null,
    snapshotComparisonReason: snapshot.value == null ? null : !snapshotObservation ? '현재값과 같은 날짜·값의 이력이 없어 비교할 수 없습니다.'
      : !priorObservation ? '이전 제공 이력이 없어 비교할 수 없습니다.'
      : !sameCoverage ? '관측 종목 구성이 달라 이전 이력과의 비교를 표시하지 않습니다.' : null,
    annualRows: detailAnnualRows(selected, metric), hasHistory: history.some(row => row.value != null), historyEnd: history.at(-1)?.date,
    previousValuation: !companyPage && !basic && (metric === 'per' || metric === 'pbr'
      || (metric === 'eps' || metric === 'bps' || metric === 'dps' || metric === 'div') && !security?.historicalPeriod)
      ? valuationReference({ metric, currentDate: snapshot.date, sourceHistory, prices }) : undefined,
    priceAnnual,
  };
}

function validRange(start?: string, end?: string) {
  return !(start && !isBusinessDay(start) || end && !isBusinessDay(end) || start && end && start > end);
}

const stateLabels: Record<string, string> = {
  source_missing: '원천 미제공', unsupported: '미지원', row_missing: '원천 행 미제공', unexplained_missing: '자료 확인 필요', no_observation: '관측 없음',
};

const nonnegativeMarketcap = (value: DetailObservation['value'] | undefined) =>
  (compareBusinessValues(value ?? null, 0) ?? -1) >= 0 ? value ?? null : null;
const validRank = (value: number | null | undefined) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;

type DetailRecord = { id: string; label: string; body: ReactNode };

export function DetailSurface(props: DetailSurfaceProps) {
  const { security, company, companySecs, ranking, neighbors, history, sourceHistory, prices, metric, basic, companyPage = false, search,
    initialAnalysis, initialSnapshotAnalysis, historyPending = false, historyError, onRetry } = props;
  const info = DETAIL_METRICS[metric];
  const label = detailMetricLabel(metric);
  const dividend = !basic && !companyPage && (metric === 'dps' || metric === 'div');
  const valuation = !basic && !companyPage && (metric === 'per' || metric === 'pbr');
  const financialMetric = !basic && !companyPage && usesInvestorPrecision(metric) ? metric : undefined;
  const compactActions = financialMetric !== undefined;
  const marketcapDetail = !basic && metric === 'marketcap';
  const aggregateMarketcap = companyPage && marketcapDetail;
  const pageLabel = companyPage ? basic ? '기업 개요' : '시가총액' : label;
  const name = companyPage ? company?.companyKorName || company?.companyName || '기업' : security ? securityName(security) : '종목';
  const route = companyPage && company ? companyPath(company, basic ? undefined : 'marketcap') : security ? securityPath(security, metric) : '/marketcaps';
  const rankingRoute = companyPage ? '/marketcaps' : '/' + metric;
  const secCode = security ? securityRouteCode(security) : company?.companyId || '';
  const stem = (companyPage ? company?.routeCode || company?.companyId || 'company' : secCode).replace(/[.]/g, '-');
  const start = single(search.start), end = single(search.end);
  const periodId = companyPage ? undefined : security?.selectedPeriod?.periodId;
  const invalid = !validRange(start, end);
  const scope = { start: invalid ? undefined : start, end: invalid ? undefined : end, periodId };
  const publication = companyPage ? company?.publication : security?.publication;
  const snapshot = securityValue(security, metric);
  const price = securityValue(security, 'price');
  const quote = price.date ? prices.find(row => row.date === price.date && compareBusinessValues(sourceValue(row.close), price.value) === 0)
    : security?.historicalPeriod ? prices.findLast(row => sourceValue(row.close) != null) : undefined;
  const lastClose = price.value == null && security?.historicalPeriod ? sourceValue(quote?.close) : null;
  const quoteDate = typeof quote?.date === 'string' && isBusinessDay(quote.date) ? quote.date : price.date;
  const rate = quote?.rate != null && Number.isFinite(Number(quote.rate)) ? Number(quote.rate) : null;
  const financialRate = compactActions && !security?.historicalPeriod && price.value != null && quoteDate ? sourceValue(quote?.rate) : null;
  const financialRateSign = compareBusinessValues(financialRate, 0);
  const publishedQuoteRate = price.value != null ? rate : null;
  const rateText = compactActions ? formatInvestorAmount(financialRate, '%', true)
    : rate == null ? '—' : (rate > 0 ? '+' : '') + detailValue(rate, '%');
  const rateSign = compactActions ? financialRateSign : rate;
  const rateDirection = rateSign == null ? undefined : rateSign === 0 ? 'flat' : rateSign > 0 ? 'up' : 'down';
  const analytics = initialAnalysis ?? prepareDetailAnalysis(props);
  const { analysisEnd, annualRows } = analytics;
  const snapshotAnalysis = initialSnapshotAnalysis ?? analytics;
  const prior = snapshotAnalysis.priorObservation;
  const immediatePrior = snapshotAnalysis.priorIsPreviousTrade;
  const { hasHistory, historyEnd } = snapshotAnalysis;
  const rangePending = historyPending && !initialAnalysis;
  const selected = invalid ? [] : selectDetailRange(history, start, end);
  const navSecurity = security && !companyPage && !basic && hasHistory && !metricAvailable(security, metric)
    ? { ...security, availableMetrics: (Object.keys(DETAIL_METRICS) as DetailMetric[]).filter(key => key === metric || metricAvailable(security, key)) }
    : security;
  const members = detailEntityMembers(security?.historicalPeriod && !companyPage ? null : company, companySecs, security);
  const marketcapComparison = marketcapDetail && company && (companyPage || !security?.historicalPeriod)
    ? prepareDetailComparison(company, members) : undefined;
  const composition = marketcapComparison?.composition;
  const currentMember = !companyPage && navSecurity;
  const selectedMembers = currentMember
    ? members.some(member => member.securityId === currentMember.securityId)
      ? members.map(member => member.securityId === currentMember.securityId ? { ...member, ...currentMember } : member)
      : [currentMember, ...members]
    : members;
  const candidates = detailSwitchCandidates({ members: selectedMembers, current: navSecurity, companyPage, basic, metric, scope });
  const companyCap = company?.state === 'published' ? nonnegativeMarketcap(company.totalMarketcap) : null;
  const companyExclusion = company?.exclusionReason ?? (aggregateMarketcap ? ranking?.exclusionReason : null);
  const compositionModel: MarketcapCompositionModel | undefined = marketcapDetail ? {
    members: candidates.map(candidate => {
      const official = composition && company?.securities.find(member => member.securityId === candidate.securityId);
      const member: DetailSecurityRow | undefined = selectedMembers.find(row => row.securityId === candidate.securityId);
      const memberRank = candidate.selected ? { rank: ranking?.currentRank, date: ranking?.rankDate } : member?.marketcapRanking;
      const amount = official ? company?.state === 'published' ? nonnegativeMarketcap(official.marketcap) : null
        : candidate.selected && !company && !security?.historicalPeriod ? nonnegativeMarketcap(snapshot.value) : null;
      return {
        candidate,
        amount,
        date: amount == null ? null : official ? official.marketcapDate : snapshot.date,
        percentage: composition?.rows.find(row => row.securityId === candidate.securityId)?.percentage ?? null,
        rank: validRank(memberRank?.rank),
        rankDate: memberRank?.date ?? null,
        quote: securityValue(member ?? null, 'price'),
      };
    }),
    aggregate: company && composition ? {
      candidate: {
        securityId: 'company:' + company.companyId, name: '기업 합산', type: null, ticker: null,
        selected: aggregateMarketcap, href: detailHref(companyPath(company, 'marketcap'), { start: scope.start, end: scope.end }),
        value: formatMarketcapAmount(companyCap),
      },
      amount: companyCap,
      memberCount: company.securities.length,
      rank: company.state === 'published' ? validRank(company.marketcapRank ?? (aggregateMarketcap ? ranking?.currentRank : null)) : null,
      date: companyCap == null ? null : composition.date,
      rankDate: company.publication?.asOf ?? (aggregateMarketcap ? ranking?.rankDate ?? null : null),
      status: companyCap != null ? null : company.state === 'unpublished' ? '아직 공개된 기업 합산값이 없습니다.'
        : company.marketcapCompleteness === 'missing_input' ? '합산 자료가 부족합니다.' : '합산 근거를 확인 중입니다.',
      exclusion: company.state === 'published' && companyExclusion
        ? stateLabels[companyExclusion] || (/^[a-z][a-z0-9_]*$/.test(companyExclusion) ? '기업 순위 산정 기준을 충족하지 않습니다.' : companyExclusion) : null,
    } : null,
    basis: publication?.asOf,
    complete: composition?.complete ?? false,
    reason: composition?.reason ?? null,
  } : undefined;
  const canShowMetric = companyPage || basic || Boolean(security && metricAvailable(security, metric)) || hasHistory;
  const siblingMetricLinks = security && !canShowMetric ? selectedMembers.filter(row => row.securityId !== security.securityId && metricAvailable(row, metric)) : [];
  const metricState = security?.[`${metric}State`] ?? 'no_observation';
  const lastValue = sourceValue(security?.[`${metric}LastProvided`]);
  const lastDate = security?.[`${metric}LastProvidedDate`];
  const missing = !basic && !companyPage && snapshot.value == null && <p role="status" className="investor-muted">
    {security?.historicalPeriod ? '선택한 상장기의 공개 현재값이 없습니다.' : security?.state === 'unpublished' ? '아직 공개된 종목 지표가 없습니다.'
      : (compactActions ? '' : label + ' 현재값 미제공 · ') + (stateLabels[metricState] || '자료 확인 필요')}
    {security?.state === 'published' && !security.historicalPeriod && lastValue != null && typeof lastDate === 'string'
      && <> · 마지막 제공값 {compactActions ? formatInvestorAmount(lastValue, info.unit) : detailValue(lastValue, info.unit)} ({lastDate})</>}
  </p>;
  const exclusion = ranking?.exclusionReason;
  const exclusionLabel = exclusion && !(snapshot.value == null && exclusion === metricState)
    ? stateLabels[exclusion] || (/^[a-z][a-z0-9_]*$/.test(exclusion) ? '순위 산정 기준을 충족하지 않습니다.' : exclusion) : null;

  const pendingHistory = historyPending && !historyError && !invalid;
  const state = invalid ? <p role="alert" className="investor-muted">시작일과 종료일을 확인해 주세요. 시작일은 종료일 이전이어야 합니다.</p> : historyError
    ? <p className="investor-muted">이력 자료를 표시할 수 없습니다.</p> : historyPending && !compactActions && !marketcapDetail
      ? <p role="status" className="investor-pending">이력 자료를 불러오는 중…</p> : null;
  const showHistoryCsv = !basic && hasHistory;
  const fileMetric = companyPage ? 'company-marketcap' : metric;
  const fileLabel = name + ' ' + (aggregateMarketcap ? '기업 합산 시가총액' : marketcapDetail ? '종목 시가총액' : pageLabel) + ' 전체 이력 CSV';
  const fileName = [stem, fileMetric, periodId ? security?.selectedPeriod?.listingDate : null, historyEnd].filter(Boolean).join('-') + '.csv';
  const headerCompact = compactActions || marketcapDetail;
  const download = (showHistoryCsv || headerCompact && historyPending) && <div id="history-download" className={`investor-history-action ${styles.historyAction}`}>
    <CsvDownloadButton key={fileName} data={historyPending || historyError ? undefined : historyCsvRows(props)} filename={fileName} label={fileLabel}
      buttonText={headerCompact ? 'CSV' : '전체 이력 CSV'} compact={headerCompact}
      historyFeedback={headerCompact ? 'toast' : undefined} />
  </div>;
  const section = (id: string, title: string, content: ReactNode, accessory?: ReactNode): DetailRecord => ({
    id, label: title, body: <section id={id} tabIndex={-1} className="investor-record"><DetailRecordHeading title={title}>{accessory}</DetailRecordHeading>{content}</section>,
  });
  const marketcapBreakdown = canShowMetric && marketcapComparison && compositionModel
    && (marketcapComparison.composition.complete && members.length > 1 || marketcapComparison.priceComparisons.length > 0)
    ? section('marketcap-breakdown', '시가총액 구성과 가격 차이',
      <MarketcapBreakdown comparison={marketcapComparison} members={compositionModel.members}
        selectedSecurityId={companyPage ? undefined : security?.securityId} />)
    : null;
  const currentRank = validRank(marketcapDetail && !companyPage && security?.historicalPeriod ? null : ranking?.currentRank);
  const order: DetailRecord[] = [];

  const priceHistory = () => section('price-history', marketcapDetail ? companyPage ? '대표 보통주 주가·거래량' : name + ' 주가·거래량'
    : name + ' 주가',
    headerCompact && pendingHistory ? <DetailChartSkeleton variant="price" />
      : state || (marketcapDetail && !prices.some(row => sourceValue(row.close) != null) ? <p className="investor-muted" role="status">
        {companyPage && !security ? '대표 보통주 거래 자료가 없습니다.' : '제공된 주가·거래량 이력이 없습니다.'}
      </p> : <DetailPriceHistory rows={prices} start={start} end={end} usePlotSkeleton={headerCompact}
        marketcapRange={marketcapDetail ? { initial: single(search.priceRange) } : undefined} />),
    marketcapDetail ? <div className="flex flex-wrap items-center gap-2">
      {companyPage && security && <span className="investor-muted">{securityName(security)}{security.ticker && ' · ' + security.ticker}</span>}
      {security && <CsvDownloadButton key={security.securityId + ':' + (security.selectedPeriod?.periodId ?? '')} compact
        data={historyPending || historyError ? undefined : priceCsvRows(prices)}
        filename={[securityRouteCode(security).replace(/[.]/g, '-'), 'price', security.selectedPeriod?.listingDate].filter(Boolean).join('-') + '.csv'}
        label={securityName(security) + ' 주가 전체 이력 CSV'} buttonText="주가 CSV" historyFeedback="toast" />}
    </div> : <span className="investor-muted">{start || end ? '선택 기간' : '최근 3개월'}</span>);
  const tradeInfo = () => section('price-information', '거래 정보', <TradeInfo security={security} quote={quote} date={quoteDate}
    closingPrice={price.value ?? lastClose} />,
    quoteDate && quoteDate !== publication?.asOf && <span className="investor-muted">거래 기준 {quoteDate}</span>);
  const annualPrice = () => {
    const rows = analytics.priceAnnual ?? [];
    return section('annual-prices', '연도별 종가',
      pendingHistory ? <DetailAnnualSkeleton closingPrice />
        : state || <DetailAnnualHistory rows={rows} label="종가" unit="원" metric="price" />,
      !pendingHistory && !state && rows.length > 0 ? <span className="investor-muted flex-1">{rows.length}개 연도</span> : undefined);
  };
  const annual = () => {
    const comparison = dividend ? annualDividendComparison({ members, securityId: security?.securityId, metric, rows: annualRows, scope }) : undefined;
    const unavailable = invalid || (marketcapDetail ? historyPending || historyError : compactActions ? (historyPending || historyError) && !initialAnalysis
      : historyError || rangePending || historyPending && !annualRows.length);
    return section('annual-data', metric === 'bps' ? '연말 기록' : marketcapDetail ? '연도별 시가총액' : '연도별 기록', unavailable
      ? marketcapDetail && pendingHistory ? <DetailAnnualSkeleton marketcap={companyPage ? 'company' : 'security'} />
        : compactActions && pendingHistory ? <DetailAnnualSkeleton comparison={Boolean(comparison?.pairs.length)} /> : state
      : <DetailAnnualHistory rows={annualRows} label={companyPage ? '등록 종목 합계' : label} unit={info.unit} metric={metric} yearEndOnly={metric === 'bps'}
        dividendComparison={comparison} />,
    marketcapDetail && !unavailable && annualRows.length > 0 ? <span className="investor-muted flex-1">{annualRows.length}개 연도</span>
      : compactActions && !unavailable && <FinancialAnnualMetadata count={annualRows.length} yearEndOnly={metric === 'bps'} dividendComparison={comparison} />);
  };
  const average = () => {
    const compareCurrentDps = metric === 'dps' && !security?.historicalPeriod && (!end || end === (publication?.asOf ?? snapshot.date));
    const marketcapDate = companyPage ? company?.totalMarketcapDate : snapshot.date;
    const compareCurrentMarketcap = marketcapDetail && !security?.historicalPeriod && (!end || end === (publication?.asOf ?? marketcapDate));
    const currentValue = compareCurrentMarketcap ? (companyPage ? companyCap : nonnegativeMarketcap(snapshot.value))
      : valuation || compareCurrentDps ? snapshot.value : undefined;
    return section('indicators', '기간별 평균', rangePending || historyError && !(compactActions && initialAnalysis)
      ? headerCompact && pendingHistory ? <DetailAnnualSkeleton /> : state
      : <PeriodStats metric={metric} analysis={analytics} info={info} companyPage={companyPage} basis={publication?.asOf}
        currentValue={currentValue} currentDate={compareCurrentMarketcap ? marketcapDate : undefined} />,
      Boolean(start || end) && <span className="investor-muted">지정한 기간</span>);
  };
  const extra = (kind: 'distribution' | 'monthly') => section(kind === 'distribution' ? 'metric-analysis' : 'monthly-records',
    kind === 'distribution' ? '과거 분포' : '월별 기록', compactActions && pendingHistory
      ? <DetailChartSkeleton variant={kind} />
      : state || <DetailFinancialAnalysis rows={selected} metric={metric} name={name} kind={kind} currentValue={snapshot.value} />);
  const perShare = metric === 'eps' || metric === 'bps';
  const dividendComparison = dividend && members.filter(member => member.dividendHistory?.some(row => row[metric] != null)
    || metricAvailable(member, metric)).length >= 2
    ? section('dividend-comparison', '구성 종목 ' + label + ' 비교 추이',
      invalid ? state : <DividendComparisonChart members={members} selectedSecurityId={security?.securityId} metric={metric} start={start} end={end} />,
      <span className="investor-muted">{start || end ? '선택 기간' : '최근 5년'}</span>) : null;

  const trend = () => {
    const metricTitle = metric === 'dps' ? '주당배당금과 변화율' : label + ' 추이';
    const chart = marketcapDetail && pendingHistory
      ? <DetailChartSkeleton variant="marketcap" marketcapScope={companyPage ? 'company' : 'security'} customRange={Boolean(start || end)} /> : financialMetric && pendingHistory
      ? <DetailChartSkeleton variant={financialMetric} customRange={Boolean(start || end)} /> : state || (marketcapDetail
      ? <InteractiveChartSection companyMarketcapData={security?.historicalPeriod ? null : company} companySecs={companySecs} type="summary"
        selectedSecurityId={companyPage ? undefined : security?.securityId} start={start} end={end}
        unified={{ rows: selected, selectedLabel: companyPage ? '기업 합산' : name, initialRange: single(search.capRange) }} />
      : <DetailHistoryChart key={route} rows={selected} metric={metric} label={label} unit={info.unit} selectedStart={start}
        selectedEnd={end || analysisEnd} annual={metric === 'bps'} customRange={Boolean(start || end)} withStatistics />);
    return section('chart-analysis', marketcapDetail ? '시가총액 추이' : metric === 'bps' ? '연말 BPS'
      : dividend ? name + ' ' + metricTitle : metricTitle,
      marketcapDetail && !state && !pendingHistory && hasHistory ? <>
        {chart}
        <div className={styles.marketcapComparison}><SnapshotDifference analysis={snapshotAnalysis} unit={info.unit} /></div>
      </> : chart);
  };

  if (companyPage && basic) {
    const links = companyMetricLinks(members, scope);
    order.push(section('securities-summary', '구성 종목별 시가총액',
      <ConstituentsTable members={members} scope={scope} csvStem={stem}
        company={company} showCsv basis={publication?.asOf} candidates={candidates} />));
    if (links.length) order.push(section('investment-metrics', '투자 지표', <div className="investor-investment-links">
      {links.map(({ metric: key, member, value, href }) => <Link key={key} href={href} prefetch={false}>
        <span>{detailMetricLabel(key)} <small>{securityName(member)}</small></span><strong>{detailValue(value.value, DETAIL_METRICS[key].unit)}</strong>
        {value.date && value.date !== publication?.asOf && <small>{value.date}</small>}
      </Link>)}
    </div>));
    const dividendTarget = members.find(member => metricAvailable(member, 'div'));
    if (members.length) order.push(section('dividend-summary', '배당 비교', <DividendTable members={members} scope={scope} basis={publication?.asOf} />,
      dividendTarget && <Link prefetch={false} href={detailHref(securityPath(dividendTarget, 'div'), scope)}>
        {securityName(dividendTarget)} 배당수익률 보기
      </Link>));
    order.push({ id: 'company-information', label: '기업 개요', body: <CompanyProfile company={company} members={members} title="기업 개요" /> });
  } else if (canShowMetric || marketcapDetail) {
    switch (metric) {
      case 'marketcap':
        order.push(trend(), priceHistory());
        if (security) order.push(tradeInfo());
        order.push(annual());
        if (security) order.push(annualPrice());
        order.push(average());
        break;
      case 'per':
        order.push(trend(), extra('distribution'), average(), extra('monthly'), annual(), priceHistory());
        break;
      case 'pbr':
        order.push(trend(), section('book-value', '연말 BPS', pendingHistory ? <DetailChartSkeleton variant="bps" customRange={Boolean(start || end)} withStatistics={false} /> : state || <DetailHistoryChart rows={detailObservations(sourceHistory, 'bps')}
          label="BPS" unit="원" metric="bps" annual selectedStart={start} selectedEnd={end || analysisEnd} customRange={Boolean(start || end)} />,
        security && metricAvailable(security, 'bps') && <Link prefetch={false} href={detailHref(securityPath(security, 'bps'), scope)}>BPS 상세 보기</Link>),
        average(), annual(), priceHistory());
        break;
      case 'eps':
        order.push(trend(), annual(), average(), priceHistory());
        break;
      case 'bps':
        order.push(trend(), annual(), average(), extra('distribution'), extra('monthly'), priceHistory());
        break;
      case 'dps':
        order.push(trend(), annual());
        if (dividendComparison) order.push(dividendComparison);
        order.push(extra('monthly'), average(), extra('distribution'), priceHistory());
        break;
      case 'div':
        if (dividendComparison) order.push(dividendComparison);
        order.push(trend(), annual(), extra('distribution'), priceHistory(), average());
        break;
    }
    const nearby = currentRank == null ? null : nearbyRankLinks(neighbors, currentRank, {
      currentId: companyPage ? company?.companyId : security?.securityId, metric, companyPage, scope,
    });
    if (nearby) {
      order.push(section('nearby-ranks', '가까운 ' + (companyPage ? '기업 시가총액' : label) + ' 순위', nearby,
        <Link prefetch={false} href={rankingRoute} className={layoutStyles.nearbyRankingLink}>전체 순위 보기</Link>));
    }
  }
  const listingPeriods = security?.listingPeriods ?? [];
  const lifecycleEvents = security?.lifecycleEvents ?? [];
  const hasListingHistory = listingPeriods.length > 1 || listingPeriods.some(period => period.delistingDate)
    || lifecycleEvents.length > 0 || security?.historicalPeriod;
  if (marketcapDetail && hasListingHistory) order.push({ id: 'listing-history', label: '상장 기간 · 이름 변경', body:
    <section id="listing-history" tabIndex={-1} className="investor-record detail-listing-history" aria-label="상장 이력">
      <SecurityLifecycle periods={listingPeriods} events={lifecycleEvents} selected={security?.selectedPeriod ?? null}
        route={companyPage && security ? securityPath(security, 'marketcap') : route} search={search} />
    </section>,
  });
  const sections = order.map(({ id, label: sectionLabel }) => ({ id, label: sectionLabel }));
  if (marketcapBreakdown) sections.unshift({ id: marketcapBreakdown.id, label: marketcapBreakdown.label });
  if (marketcapDetail) sections.unshift({ id: 'current-overview', label: '요약' });
  if (dividend && selectedMembers.length > 1) sections.unshift({ id: 'dividend-summary', label: dividendComparisonHeading(selectedMembers) });
  const compactShare = detailHref(route + '/', scope);
  const previous = snapshotAnalysis.previousValuation ?? null;
  const previousAmount = previous?.metric;
  const basis = publication?.asOf;
  const rankHref = sections.some(item => item.id === 'nearby-ranks') ? '#nearby-ranks' : rankingRoute;
  const rankNumber = currentRank?.toLocaleString('ko-KR');
  const rankText = rankNumber ? rankNumber + '위' : null;
  const rankDate = ranking?.rankDate && ranking.rankDate !== basis ? ranking.rankDate : null;
  const headlineValue = aggregateMarketcap ? companyCap : marketcapDetail ? nonnegativeMarketcap(snapshot.value) : snapshot.value;
  const headlineDate = aggregateMarketcap ? company?.totalMarketcapDate : snapshot.date;
  const headlineLabel = marketcapDetail ? companyPage ? '기업 합산 시가총액' : '종목 시가총액' : label;
  const headline = <dl className={styles.headlineRow} data-compact-summary data-ranked={Boolean(rankText) || undefined}>
    <div className={styles.headlineColumn}>
      <dt>현재 {headlineLabel}</dt>
      <dd className={headlineValue == null ? styles.headlineMissing
        : `investor-primary-value ${styles.headlineAmount}${valuation ? ' ' + styles.multipleHeadlineAmount : ''}`}>
        {headlineValue == null ? '미제공' : marketcapDetail ? <MarketcapAmount value={headlineValue} />
          : <>{formatInvestorNumber(headlineValue, info.unit)}<span className={styles.headlineUnit}>{info.unit}</span></>}
      </dd>
      {headlineValue != null && headlineDate && headlineDate !== basis
        && <dd className="investor-muted"><time dateTime={headlineDate}>{headlineDate}</time></dd>}
    </div>
    {rankText && <div className={`${styles.headlineColumn} ${styles.rankColumn}`}>
      <dt>{headlineLabel} 순위</dt>
      <dd><Link className={styles.headlineRank} data-rank={currentRank} prefetch={false} href={rankHref}
        aria-label={headlineLabel + ' 순위 ' + rankText}>
        <strong>{rankNumber}</strong><span className={styles.rankUnit}>위</span>
      </Link></dd>
      {rankDate && <dd className="investor-muted"><time dateTime={rankDate}>{rankDate}</time></dd>}
    </div>}
  </dl>;
  const hasValuationComposition = metric !== 'per' || price.value != null
    || securityValue(security, 'eps').value != null || previous != null;
  const hasQuoteChange = compactActions ? financialRateSign != null : publishedQuoteRate != null;
  const quoteChange = hasQuoteChange && <span className={styles.quoteChange}>
    <span>주가 전일 대비</span>{' '}
    <strong className={rateDirection === 'up' ? 'market-up' : rateDirection === 'down' ? 'market-down' : undefined}>{rateText}</strong>
    {dividend && quoteDate && quoteDate !== basis && <small><time dateTime={quoteDate}>{quoteDate}</time></small>}
  </span>;
  const valuationSupport = (perShare || valuation && canShowMetric || dividend) && security && hasValuationComposition &&
    <ValuationSummary metric={metric} security={security} previous={previous} scope={scope} quoteChange={dividend ? undefined : quoteChange} />;
  const facts: DetailRailFact[] = [];
  const fact = (label: string, value: string, date?: string | null, href?: string, direction?: DetailRailFact['direction']) => {
    facts.push({ label, value, date: date && date !== basis ? date : undefined, href, direction });
  };
  const quoteHref = security && price.value != null
    ? marketcapDetail ? '#price-history' : detailHref(securityPath(security, 'marketcap'), scope) + '#price-history' : undefined;
  if (companyPage) {
    const cap = company?.state === 'published' ? company.totalMarketcap : null;
    fact('합산 시가총액', marketcapDetail ? formatMarketcapAmount(cap) : detailValue(cap, '원', true), typeof company?.totalMarketcapDate === 'string' ? company.totalMarketcapDate : null,
      company && basic ? detailHref(companyPath(company, 'marketcap'), scope) : undefined);
  } else {
    fact(label, compactActions ? formatInvestorAmount(snapshot.value, info.unit)
      : marketcapDetail ? formatMarketcapAmount(snapshot.value) : detailValue(snapshot.value, info.unit), snapshot.date);
  }
  if (security && (!companyPage || security.type === '보통주')) fact(companyPage ? '대표 보통주 종가' : '종가',
    compactActions ? formatInvestorAmount(price.value, '원') : detailValue(price.value, '원'), price.date, quoteHref);
  if (!companyPage && hasQuoteChange) fact('주가 전일 대비', rateText, quoteDate, undefined, rateDirection);
  if (valuation && previous) fact('1년 전 기준', compactActions ? formatInvestorAmount(previous.metric, info.unit) : detailValue(previous.metric, info.unit), previous.date);
  if (rankText) fact(companyPage ? '기업 순위' : label + ' 순위', rankText, ranking?.rankDate, rankHref);
  const metricGroups = detailNavGroups({ company, security: navSecurity, companyPage, basic, metric, scope });
  const marketcapHierarchy = compositionModel && hasMarketcapHierarchy(compositionModel);
  const selectedConstituent = marketcapHierarchy && compositionModel.members.find(({ candidate }) => candidate.selected);
  const differentSnapshot = selectedConstituent && headlineValue != null &&
    (compareBusinessValues(headlineValue, selectedConstituent.amount) !== 0 || headlineDate !== selectedConstituent.date);
  const marketcapQuote = !companyPage && <span className={`${styles.reference} ${styles.marketcapQuote}`}>
    <span>종가</span>
    {quoteHref ? <Link prefetch={false} href={quoteHref}>{detailValue(price.value, '원')}</Link> : '—'}
    {price.date && price.date !== basis && <time dateTime={price.date}>{price.date}</time>}
  </span>;
  const marketcapSelection = selectedConstituent && <>
    {differentSnapshot && <span className={styles.reference}>
      <span>현재 종목 시가총액</span><strong><MarketcapAmount value={headlineValue} /></strong>
      {headlineDate && headlineDate !== basis && <time dateTime={headlineDate}>{headlineDate}</time>}
    </span>}
    {missing}
  </>;
  const selectedSeriesType = marketcapDetail && !companyPage && !security?.historicalPeriod && company && company.securities.length > 1
    ? company.securities.find(member => member.securityId === security?.securityId)?.type : undefined;

  return <div className="app-container detail-grid investor-detail" data-detail-route={route}>
    {security && <RecentSecurityTracker secCode={secCode} securityId={security.securityId} routeCode={security.routeCode}
      lastPath={recentDetailPath(route, { period: scope.periodId, start: scope.start, end: scope.end })}
      lastCompanyMarketcap={aggregateMarketcap ? companyCap : undefined}
      name={security.name} korName={security.korName} ticker={security.ticker} exchange={security.exchange}
      metricType={metric} metricValue={snapshot.value} />}
    <DetailInvestorNavigation groups={metricGroups} name={name} sections={sections} />
    <div className={`detail-content investor-content${headerCompact ? ' ' + styles.focusedContent : ''}${marketcapDetail ? ' ' + styles.marketcapContent : ''}${compactActions ? ' ' + styles.financialContent : ''}`}>
      <nav aria-label="Breadcrumb" className="detail-breadcrumb investor-breadcrumb">
        <Link prefetch={false} href="/">홈</Link><span aria-hidden="true">·</span><Link prefetch={false} href={rankingRoute}>
          {companyPage ? '기업 시가총액 순위' : label + ' 순위'}
        </Link><span aria-hidden="true">·</span><span>{name}</span>
      </nav>
      <StickyCompanyHeader displayName={name} companyName={company?.companyKorName || security?.company?.korName}
        logoUrl={security?.company?.logo || company?.company?.logo} titleSuffix={' ' + pageLabel}
        titleAction={<>
          <DetailMetricMenu groups={metricGroups} name={name} metricLabel={pageLabel} />
          {compositionModel && <DetailMarketcapTitleSwitch model={compositionModel} sections={sections} seriesType={selectedSeriesType} />}
        </>}
        outlineAction={sections.length > 0 && <DetailHeaderOutline sections={sections} />}
        historyAction={download} compactActions={headerCompact} className={`${styles.mobileMetricHeader}${headerCompact ? ' ' + styles.compactMetricHeader : ''}`}
        actions={<ShareButton className={styles.shareActions} compactActions={headerCompact} preserveChartRanges={marketcapDetail} title={name + ' ' + pageLabel} text={siteConfig.name + '에서 ' + name + '의 ' + pageLabel + ' 기록을 확인하세요.'}
          url={new URL(compactShare, siteConfig.url).href} />} />
      <div className="detail-identity-meta">
        <p>{companyPage ? '기업 전체' : [security?.type, security?.ticker, security?.exchange].filter(Boolean).join(' · ')}</p>
        <p>공개 기준일 {publication?.asOf || '미공개'}</p>
      </div>
      {historyError && <p role="alert" className="investor-error">{historyError} <button type="button" onClick={onRetry}>다시 시도</button></p>}
      {(start || end) && <div className="investor-legacy-range">
        <span>선택 기간 {start || '처음'} ~ {end || '마지막'}</span>
        {marketcapDetail
          ? <MarketcapRangeLink prefetch={false} href={detailHref(route, { periodId })}>기간 초기화</MarketcapRangeLink>
          : <Link prefetch={false} href={detailHref(route, { periodId })}>기간 초기화</Link>}
      </div>}
      {security?.historicalPeriod && !companyPage && <p className="investor-muted">
        이전 상장기의 자료입니다. 현재 공개값과 순위는 현재 상장기의 자료입니다.
        {' '}<Link prefetch={false} href={marketcapDetail ? '#listing-history'
          : detailHref(securityPath(security, 'marketcap'), scope) + '#listing-history'}>상장 이력 보기</Link>
      </p>}

      <div className="investor-overview">
        {compositionModel ? <section id="current-overview" tabIndex={-1} aria-label="시가총액 요약">
          {!marketcapHierarchy && <div className={`${styles.summaryHero} ${styles.marketcapHero}`}>
            {headline}
            {missing}
            {marketcapQuote && <div className={styles.comparisonStrip}>{marketcapQuote}</div>}
          </div>}
          <DetailMarketcapSwitch model={compositionModel} breakdown={marketcapBreakdown?.body}
            selectedDetail={marketcapSelection} rankHref={rankHref} />
        </section> : companyPage ? <CompanyMarketcapOverview company={company} members={members} ranking={ranking} basis={publication?.asOf} /> :
          <section id="current-overview" aria-label="현재 공개값">
            <div className={styles.summaryHero}>
              {headline}
              {missing}
              <div className={styles.comparisonStrip}>
                {dividend && prior && <p className={styles.reference}>
                  <span>{immediatePrior ? '직전 거래일' : '직전 제공값'}</span><strong>{formatInvestorAmount(prior.value, info.unit)}</strong>
                  {!immediatePrior && <time dateTime={prior.date}>{prior.date}</time>}
                </p>}
                {(valuation || perShare) && canShowMetric && <SnapshotDifference analysis={snapshotAnalysis} unit={info.unit} label={label}
                  immediate={immediatePrior} financialComparison />}
                {previous && previousAmount != null && <p className={styles.reference} data-valuation-reference={previous.date}>
                  <span>1년 전 기준</span><strong>{formatInvestorAmount(previousAmount, info.unit)}</strong>
                </p>}
                {dividend && quoteChange}
              </div>
            </div>
            {valuationSupport && <div className={styles.valuationSupport}>{valuationSupport}</div>}
            {dividend && <DividendTable members={selectedMembers} securityId={security?.securityId} metric={metric}
              csvStem={stem} scope={scope} basis={basis} candidates={candidates} referenceDay={previous?.date} />}
          </section>}
        {!companyPage && !dividend && !marketcapDetail && canShowMetric && <StockSelection candidates={candidates} label="종목 전환" />}
        {!basic && !companyPage && exclusionLabel && <p className="investor-muted">순위 제외 사유 · {exclusionLabel}</p>}
        {!canShowMetric && !historyPending && !historyError && <div className="investor-unavailable">
          <p>이 종목의 {label} 제공 이력이 없습니다. 지표 이동에서 제공되는 다른 기록을 볼 수 있습니다.</p>
          {siblingMetricLinks.map(member => <Link key={member.securityId} prefetch={false}
            href={detailHref(securityPath(member, metric), { start: scope.start, end: scope.end })}>{securityName(member)} {label} 보기</Link>)}
        </div>}
      </div>

      <DetailInvestorOutline sections={sections} placement="inline" />
      {headerCompact && <p role="status" className="sr-only">{pendingHistory && '이력 자료를 불러오는 중…'}</p>}
      {order.map(({ id, body }) => <Fragment key={id}>{body}</Fragment>)}
    </div>
    <DetailInvestorRail candidates={candidates} facts={facts} sections={sections} secCode={secCode} name={name} basis={basis}
      route={marketcapDetail ? route : undefined} candidateTitle={companyPage ? '종목 시총 보기' : undefined} preserveSections={marketcapDetail || !companyPage}
      composition={compositionModel} selectedSeriesType={selectedSeriesType}
      historyReady={!historyPending || Boolean(historyError)} />
  </div>;
}

function SnapshotDifference({ analysis, unit, label, immediate, financialComparison }: {
  analysis: DetailSnapshotAnalysis; unit: string; label?: string; immediate?: boolean; financialComparison?: boolean;
}) {
  const { priorObservation, snapshotChange, snapshotDifference, priorValueSign, snapshotComparisonReason } = analysis;
  if (snapshotComparisonReason) return <p className="investor-muted">{snapshotComparisonReason}</p>;
  if (!priorObservation) return null;
  const date = priorObservation.date;
  const sign = compareBusinessValues(snapshotChange, 0);
  if (snapshotChange != null && label) return <p className={styles.reference} data-prior-observation={date}>
    <span>{label} {immediate ? '전일 대비' : '직전 제공값 대비'}</span>
    <strong className={sign === 1 ? 'market-up' : sign === -1 ? 'market-down' : undefined}>
      {sign === 1 ? '+' : ''}{(financialComparison ? formatInvestorAmount(snapshotChange, '%') : detailValue(snapshotChange, '%')).replace(/^-/, '−')}
    </strong>
    {!immediate && <time dateTime={date}>{date}</time>}
  </p>;
  if (snapshotChange != null) return <p className="investor-muted" data-prior-observation={date}>
    {date} 이력 대비 {compareBusinessValues(snapshotChange, 0) === 1 ? '+' : ''}{detailValue(snapshotChange, '%')}
  </p>;
  if (snapshotDifference == null || priorValueSign == null || priorValueSign > 0) return null;
  const reason = '이전 값이 ' + (priorValueSign === 0 ? '0' : '음수') + '라 증감률 계산 불가';
  if (financialComparison && label) return <p className={styles.reference} data-prior-observation={date}>
    <span>{label} 직전 제공값과 차이</span>
    <strong>{unit === '원' ? detailValue(snapshotDifference, unit).replace(/^-/, '−') : formatInvestorAmount(snapshotDifference, unit)}</strong>
    <time dateTime={date}>{date}</time>
    <small className={styles.comparisonNote}>{reason}</small>
  </p>;
  return <p className="investor-muted" data-prior-observation={date}>
    {label ? label + ' 직전 제공값과 차이' : date + ' 이력 대비 차이'} {detailValue(snapshotDifference, unit)}
    {label && <> <time dateTime={date}>{date}</time></>} · {reason}
  </p>;
}

function TradeInfo({ security, quote, date, closingPrice }: {
  security: DetailSecurityView | null; quote?: Record<string, unknown>; date: string | null; closingPrice?: ReturnType<typeof sourceValue>;
}) {
  const quoteFields = [['시가', 'open'], ['고가', 'high'], ['저가', 'low'], ['거래량', 'volume']] as const;
  const values = quoteFields.map(([label, key]) => ({ key, cells: [{ value: label }, { value: detailValue(sourceValue(quote?.[key]), key === 'volume' ? '주' : '원'), date }] }));
  const rows = [
    ...(closingPrice !== undefined ? [
      { key: 'close', cells: [{ value: '종가' }, { value: detailValue(closingPrice, '원'), date }] },
      { key: 'rate', cells: [{ value: '전일 대비' }, { value: formatInvestorAmount(sourceValue(quote?.rate), '%', true), date }] },
    ] : []),
    ...values,
    { key: 'shares', cells: [{ value: '발행주식 수' }, { value: detailValue(security?.shares, '주'), date: security?.sharesDate }] },
    { key: 'code', cells: [{ value: '종목코드' }, { value: security?.ticker ?? null }] },
  ];
  return <InvestorTable columns={['항목', '값']} rows={rows} label="거래 정보" basis={date} />;
}

function nearbyRankLinks(rows: Record<string, unknown>[], currentRank: number, { currentId, metric, companyPage, scope }: {
  currentId?: string; metric: DetailMetric; companyPage: boolean; scope: { start?: string; end?: string };
}) {
  if (!Number.isSafeInteger(currentRank) || currentRank <= 0) return null;
  const marketcap = metric === 'marketcap';
  const unit = DETAIL_METRICS[metric].unit;
  const candidates = rows.flatMap(row => {
    const rawRank = marketcap ? row.currentRank ?? row.marketcapRank : row.currentRank;
    if (typeof rawRank !== 'number' && (typeof rawRank !== 'string' || !/^\d+$/.test(rawRank))) return [];
    const position = Number(rawRank);
    const id = companyPage ? row.companyId : row.securityId;
    const rawValue = Object.hasOwn(row, 'value') ? row.value : row[metric];
    const value = sourceValue(marketcap ? rawValue ?? (companyPage ? row.totalMarketcap : row.marketcap) : rawValue);
    const name = row.korName || row.name || row.ticker;
    if (typeof id !== 'string' || !id || id === currentId || typeof name !== 'string' || !name || (!marketcap && value == null)
      || !Number.isSafeInteger(position) || position <= 0 || position === currentRank) return [];
    const routeCode = typeof row.routeCode === 'string' ? row.routeCode : null;
    const path = companyPage ? companyPath({ companyId: id, routeCode }, 'marketcap')
      : securityPath({ securityId: id, routeCode, ticker: String(row.ticker ?? ''), exchange: String(row.exchange ?? '') }, metric);
    return [{ id, name, position, value, href: detailHref(path, { start: scope.start, end: scope.end }) }];
  }).sort((left, right) => left.position - right.position);
  const higher = candidates.findLast(row => row.position < currentRank);
  const lower = candidates.find(row => row.position > currentRank);
  if (!higher && !lower) return null;
  return <nav className={styles.nearbyRanks} aria-label="인접 순위">
    {[higher, lower].map((row, index) => {
      if (!row) return null;
      const isHigher = index === 0;
      const Chevron = isHigher ? ChevronLeft : ChevronRight;
      return <Link key={row.id} prefetch={false} href={row.href} data-direction={isHigher ? 'higher' : 'lower'}>
        <span className={styles.nearbyRankText}>
          <span className={styles.nearbyRankDirection}>{isHigher ? '높은 순위' : '낮은 순위'}</span>
          <strong className={styles.nearbyRankPosition}>{row.position.toLocaleString('ko-KR')}위</strong>
          <span className={styles.nearbyRankName}>{row.name}</span>
          <span className={styles.nearbyRankValue}>{marketcap ? detailValue(row.value, unit, true) : formatInvestorAmount(row.value, unit)}</span>
        </span>
        <Chevron size={18} aria-hidden="true" />
      </Link>;
    })}
  </nav>;
}

function priceCsvRows(prices: Record<string, unknown>[]) {
  return prices.filter(row => typeof row.date === 'string' && isBusinessDay(row.date)).map(row => ({
    '거래일': row.date, '시가': sourceValue(row.open), '고가': sourceValue(row.high), '저가': sourceValue(row.low),
    '종가': sourceValue(row.close), '거래량': sourceValue(row.volume),
  }));
}

function historyCsvRows({ companyPage, company, sourceHistory, metric }: DetailSurfaceProps) {
  if (companyPage) return sourceHistory.map(row => {
    const result: Record<string, unknown> = { date: row.date, '등록 종목 합계': row.totalMarketcap, observedCount: row.observedCount, targetCount: row.targetCount };
    const breakdown = row.securitiesBreakdown as Record<string, unknown> | undefined;
    for (const member of company?.securities ?? []) {
      const column = securityName(member) + ' (' + (member.ticker || '—') + ' · ' + member.securityId + ')';
      result[column] = breakdown?.[member.securityId] ?? null;
    }
    return result;
  });
  return sourceHistory.map(row => ({
    date: row.date, [metric]: row[metric] ?? null,
    ...(metric === 'per' ? { eps: row.eps ?? null } : metric === 'pbr' ? { bps: row.bps ?? null } : {}),
    state: row[metric + 'State'] ?? 'provided',
  }));
}
