import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import type { getSecurityDetailSnapshot } from '@/lib/data/detail-snapshot';
import type { SecurityListingPeriod, SecurityLifecycleEvent } from '@/lib/security-lifecycle';
import { businessChangePercent, compareBusinessValues, isBusinessDay, subtractBusinessValues, summarizeBusinessWindow } from '@/lib/business-analysis';
import { DETAIL_METRICS, detailAnnualRows, detailObservations, earlierDate, periodMeans, selectDetailRange, sourceValue, type DetailMetric, type DetailObservation, type DetailAnnualRow } from '@/lib/detail-presentation';
import { companyPath, securityPath, securityRouteCode } from '@/lib/entity-paths';
import { recentDetailPath } from '@/lib/recent-securities';
import { siteConfig } from '@/config/site';
import type { DetailSecurityRow, DetailCompanyView, DetailCorporation, DetailPublication } from './detail-types';
import { CompanyProfile, CompanyMarketcapOverview } from './company-detail-overview';
import { DetailInvestorNavigation, DetailInvestorOutline } from './detail-investor-navigation';
import {
  companyMetricLinks, ConstituentsTable, detailHref, detailMetricLabel, detailNavGroups, DetailRecordHeading, detailValue,
  DividendTable, InvestorTable, metricAvailable, securityName, securityValue, StockSelection,
  valuationReference, ValuationSummary, type ValuationObservation,
} from './detail-investor-records';
import { detailEntityMembers } from './detail-entity-selector';
import { DetailHistoryChart } from './detail-history-chart';
import { DetailFinancialAnalysis, DetailPriceHistory, DetailAnnualHistory, DividendComparisonChart } from './restored-detail-charts';
import { InteractiveChartSection } from './interactive-chart-section';
import { StickyCompanyHeader } from './sticky-company-header';
import { SecurityLifecycle } from './security-lifecycle';
import { RecentSecurityTracker } from './recent-security-tracker';
import { RecentSecuritiesSidebar } from './recent-securities-sidebar';
import { CsvDownloadButton } from './CsvDownloadButton';
import ShareButton from './share-button';

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
  snapshotChange: string | null;
  snapshotDifference: string | null;
  priorValueSign: number | null;
  snapshotComparisonReason: string | null;
  annualRows: DetailAnnualRow[];
  hasHistory: boolean;
  historyEnd?: string;
  previousValuation?: ValuationObservation | null;
  priceAnnual?: DetailAnnualRow[];
  hasPrices?: boolean;
}

type DetailSnapshotAnalysis = Pick<DetailAnalysis, 'priorObservation' | 'snapshotChange' | 'snapshotDifference' | 'priorValueSign'
  | 'snapshotComparisonReason' | 'hasHistory' | 'historyEnd' | 'previousValuation' | 'hasPrices'>;

function priceObservations(rows: Record<string, unknown>[]) {
  return rows.flatMap(row => typeof row.date === 'string' && isBusinessDay(row.date) && sourceValue(row.close) != null
    ? [{ date: row.date, value: sourceValue(row.close) }] : []).sort((left, right) => left.date.localeCompare(right.date));
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
  const priceRows = basic && !companyPage ? priceObservations(prices) : [];
  const priceAnnual = basic && !companyPage ? detailAnnualRows(invalid ? [] : selectDetailRange(priceRows, start, end)) : undefined;
  return {
    analysisEnd, summary: summarizeBusinessWindow(selected), means: periodMeans(selected, analysisEnd),
    priorObservation: priorObservation ? { date: priorObservation.date, value: priorObservation.value } : null,
    snapshotChange: priorObservation && sameCoverage ? businessChangePercent(priorObservation.value, snapshot.value) : null,
    snapshotDifference: priorObservation && sameCoverage ? subtractBusinessValues(snapshot.value, priorObservation.value) : null,
    priorValueSign: priorObservation ? compareBusinessValues(priorObservation.value, 0) : null,
    snapshotComparisonReason: snapshot.value == null ? null : !snapshotObservation ? '현재값과 같은 날짜·값의 이력이 없어 비교할 수 없습니다.'
      : !priorObservation ? '이전 제공 이력이 없어 비교할 수 없습니다.'
      : !sameCoverage ? '관측 종목 구성이 달라 이전 이력과의 비교를 표시하지 않습니다.' : null,
    annualRows: detailAnnualRows(selected, metric), hasHistory: history.some(row => row.value != null), historyEnd: history.at(-1)?.date,
    previousValuation: !companyPage && !basic && (metric === 'per' || metric === 'pbr')
      ? valuationReference({ metric, currentDate: snapshot.date, sourceHistory, prices }) : undefined,
    priceAnnual, hasPrices: priceRows.length > 0,
  };
}

function validRange(start?: string, end?: string) {
  return !(start && !isBusinessDay(start) || end && !isBusinessDay(end) || start && end && start > end);
}

const stateLabels: Record<string, string> = {
  source_missing: '원천 미제공', unsupported: '미지원', row_missing: '원천 행 미제공', unexplained_missing: '자료 확인 필요', no_observation: '관측 없음',
};

type DetailRecord = { id: string; label: string; body: ReactNode };

export function DetailSurface(props: DetailSurfaceProps) {
  const { security, company, companySecs, ranking, neighbors, history, sourceHistory, prices, metric, basic, companyPage = false, search,
    initialAnalysis, initialSnapshotAnalysis, historyPending = false, historyError, onRetry } = props;
  const info = DETAIL_METRICS[metric];
  const label = detailMetricLabel(metric);
  const dividend = !basic && !companyPage && (metric === 'dps' || metric === 'div');
  const pricePage = basic && !companyPage;
  const pageLabel = companyPage ? basic ? '기업 정보' : '기업 합산 시총' : basic ? '종목 기본 정보' : metric === 'marketcap' ? '종목 시가총액' : label;
  const name = companyPage ? company?.companyKorName || company?.companyName || '기업' : security ? securityName(security) : '종목';
  const route = companyPage && company ? companyPath(company, basic ? undefined : 'marketcap') : security ? securityPath(security, basic ? undefined : metric) : '/marketcaps';
  const rankingRoute = companyPage ? '/marketcaps' : '/' + metric;
  const secCode = security ? securityRouteCode(security) : company?.companyId || '';
  const stem = (companyPage ? company?.routeCode || company?.companyId || 'company' : secCode).replace(/[.]/g, '-');
  const start = single(search.start), end = single(search.end);
  const periodId = companyPage ? undefined : security?.selectedPeriod?.periodId;
  const scope = { start, end, periodId };
  const invalid = !validRange(start, end);
  const publication = companyPage ? company?.publication : security?.publication;
  const snapshot = securityValue(security, metric);
  const price = securityValue(security, 'price');
  const quote = price.date ? prices.find(row => row.date === price.date && compareBusinessValues(sourceValue(row.close), price.value) === 0)
    : security?.historicalPeriod ? prices.findLast(row => sourceValue(row.close) != null) : undefined;
  const lastClose = price.value == null && security?.historicalPeriod ? sourceValue(quote?.close) : null;
  const quoteDate = typeof quote?.date === 'string' && isBusinessDay(quote.date) ? quote.date : price.date;
  const rate = quote?.rate != null && Number.isFinite(Number(quote.rate)) ? Number(quote.rate) : null;
  const rateText = rate == null ? '—' : (rate > 0 ? '+' : '') + detailValue(rate, '%');
  const analytics = initialAnalysis ?? prepareDetailAnalysis(props);
  const { analysisEnd, annualRows } = analytics;
  const snapshotAnalysis = initialSnapshotAnalysis ?? analytics;
  const { hasHistory, historyEnd } = snapshotAnalysis;
  const rangePending = historyPending && !initialAnalysis;
  const selected = invalid ? [] : selectDetailRange(history, start, end);
  const navSecurity = security && !Array.isArray(security.availableMetrics) && !basic && hasHistory && !metricAvailable(security, metric)
    ? { ...security, availableMetrics: (Object.keys(DETAIL_METRICS) as DetailMetric[]).filter(key => key === metric || metricAvailable(security, key)) }
    : security;
  const members = detailEntityMembers(company, companySecs, security);
  const selectedMembers = security && !members.some(member => member.securityId === security.securityId) && !companyPage ? [security, ...members] : members;
  const canShowMetric = companyPage || basic || Boolean(security && metricAvailable(security, metric)) || hasHistory;
  const siblingMetricLinks = security && !canShowMetric ? selectedMembers.filter(row => row.securityId !== security.securityId && metricAvailable(row, metric)) : [];
  const metricState = security?.[`${metric}State`] ?? 'no_observation';
  const lastValue = sourceValue(security?.[`${metric}LastProvided`]);
  const lastDate = security?.[`${metric}LastProvidedDate`];
  const missing = !basic && !companyPage && snapshot.value == null && <p role="status" className="investor-muted">
    {security?.historicalPeriod ? '선택한 상장기의 공개 현재값이 없습니다.' : security?.state === 'unpublished' ? '아직 공개된 종목 지표가 없습니다.'
      : label + ' 현재값 미제공 · ' + (stateLabels[metricState] || '자료 확인 필요')}
    {security?.state === 'published' && !security.historicalPeriod && lastValue != null && typeof lastDate === 'string'
      && <> · 마지막 제공값 {detailValue(lastValue, info.unit)} ({lastDate})</>}
  </p>;
  const exclusion = ranking?.exclusionReason;
  const exclusionLabel = exclusion && !(snapshot.value == null && exclusion === metricState)
    ? stateLabels[exclusion] || (/^[a-z][a-z0-9_]*$/.test(exclusion) ? '순위 산정 기준을 충족하지 않습니다.' : exclusion) : null;

  const state = invalid ? <p role="alert" className="investor-muted">시작일과 종료일을 확인해 주세요. 시작일은 종료일 이전이어야 합니다.</p> : historyPending
    ? <p role="status" className="investor-pending">이력 자료를 불러오는 중…</p> : historyError
      ? <p className="investor-muted">이력 자료를 표시할 수 없습니다.</p> : null;
  const showHistoryCsv = pricePage ? Boolean(snapshotAnalysis.hasPrices) : !basic && hasHistory;
  const fileMetric = pricePage ? 'price' : companyPage ? 'company-marketcap' : metric;
  const fileLabel = name + ' ' + (pricePage ? '주가' : pageLabel) + ' 전체 이력 CSV';
  const fileName = [stem, fileMetric, periodId ? security?.selectedPeriod?.listingDate : null, !pricePage && historyEnd].filter(Boolean).join('-') + '.csv';
  const download = showHistoryCsv && <div id="history-download" className="investor-history-action">
    <CsvDownloadButton key={fileName} data={historyPending || historyError ? undefined : historyCsvRows(props)} filename={fileName} label={fileLabel} />
  </div>;
  const section = (id: string, title: string, content: ReactNode, accessory?: ReactNode): DetailRecord => ({
    id, label: title, body: <section id={id} tabIndex={-1} className="investor-record"><DetailRecordHeading title={title}>{accessory}</DetailRecordHeading>{content}</section>,
  });
  const order: DetailRecord[] = [];

  const priceHistory = () => section('price-history', pricePage ? '주가와 거래량' : companyPage ? '대표 보통주 주가' : name + ' 주가',
    state || <DetailPriceHistory rows={prices} start={start} end={end} />,
    <span className="investor-muted">{companyPage && security ? securityName(security) + ' · ' : ''}{start || end ? '선택 기간' : '최근 3개월'}</span>);
  const annual = () => section('annual-data', metric === 'bps' ? '연말 기록' : '연도별 기록',
    invalid || historyError || rangePending || historyPending && !annualRows.length ? state
      : <DetailAnnualHistory rows={annualRows} label={companyPage ? '등록 종목 합계' : label} unit={info.unit} yearEndOnly={metric === 'bps'} />);
  const average = () => section('indicators', '기간별 평균', rangePending || historyError ? state
    : <PeriodStats analysis={analytics} info={info} companyPage={companyPage} />,
    Boolean(start || end) && <span className="investor-muted">지정한 기간</span>);
  const extra = (kind: 'distribution' | 'monthly') => section(kind === 'distribution' ? 'metric-analysis' : 'monthly-records',
    kind === 'distribution' ? '과거 분포' : '월별 기록', state || <DetailFinancialAnalysis rows={selected} metric={metric} name={name} kind={kind} currentValue={snapshot.value} />);
  const compare = (showCsv = false) => section('securities-summary', metric === 'marketcap' && !basic && !companyPage ? '구성 종목 비교' : '구성 종목별 시가총액',
    <ConstituentsTable members={members} current={!companyPage ? security?.securityId : undefined} scope={scope} csvStem={stem}
      company={company} showCsv={showCsv} basis={publication?.asOf} />);
  const related = (key: DetailMetric) => {
    if (!security || !metricAvailable(security, key)) return null;
    const value = securityValue(security, key);
    return <Link prefetch={false} href={detailHref(securityPath(security, key), scope)}>{detailValue(value.value, DETAIL_METRICS[key].unit)}</Link>;
  };
  const relatedMetric = metric === 'eps' ? 'per' : metric === 'bps' ? 'pbr' : null;
  const relatedLink = relatedMetric ? related(relatedMetric) : null;
  const dividendComparison = dividend && members.filter(member => member.dividendHistory?.some(row => row[metric] != null)
    || metricAvailable(member, metric)).length >= 2
    ? section('dividend-comparison', '구성 종목 ' + label + ' 비교 추이',
      state || <DividendComparisonChart members={members} metric={metric} start={start} end={end} />,
      <span className="investor-muted">{start || end ? '선택 기간' : '최근 5년'}</span>) : null;

  const trend = () => {
    const companyHistory = companyPage && company;
    const chartForStockCap = metric === 'marketcap' && !companyPage;
    const stockCapStart = !start && !end && chartForStockCap ? earlierDate(history.at(-1)?.date || '', 3) : start;
    return section('chart-analysis', companyPage ? '합산 시가총액 추이' : metric === 'bps' ? '연말 BPS'
      : metric === 'dps' ? '주당배당금과 변화율' : label + ' 추이', state || (companyHistory
        ? <InteractiveChartSection companyMarketcapData={company} companySecs={companySecs} type="summary" start={start} end={end} />
        : <DetailHistoryChart key={route} rows={selected} metric={metric} label={label} unit={info.unit} selectedStart={stockCapStart}
          selectedEnd={end || (chartForStockCap ? undefined : analysisEnd)} annual={metric === 'bps'} customRange={Boolean(start || end)} withStatistics />),
    dividend && <span className="investor-muted">{name}</span>);
  };

  if (companyPage && basic) {
    const links = companyMetricLinks(members, scope);
    order.push(compare(true));
    if (links.length) order.push(section('investment-metrics', '투자 지표', <div className="investor-investment-links">
      {links.map(({ metric: key, member, value, href }) => <Link key={key} href={href} prefetch={false}>
        <span>{detailMetricLabel(key)} <small>{securityName(member)}</small></span><strong>{detailValue(value.value, DETAIL_METRICS[key].unit)}</strong>
        {value.date && <small>{value.date}</small>}
      </Link>)}
    </div>));
    const dividendTarget = members.find(member => metricAvailable(member, 'div'));
    if (members.length) order.push(section('dividend-summary', '배당 비교', <DividendTable members={members} scope={scope} basis={publication?.asOf} />,
      dividendTarget && <Link prefetch={false} href={detailHref(securityPath(dividendTarget, 'div'), { start, end })}>
        {securityName(dividendTarget)} 배당수익률 보기
      </Link>));
    order.push({ id: 'company-information', label: '기업 개요', body: <CompanyProfile company={company} members={members} title="기업 개요" /> });
  } else if (pricePage) {
    order.push(priceHistory(), section('price-information', '거래 정보', <TradeInfo security={security} quote={quote} date={quoteDate} />,
      quoteDate && quoteDate !== publication?.asOf && <span className="investor-muted">거래 기준 {quoteDate}</span>));
    order.push(section('annual-data', '연도별 종가', invalid || historyError || rangePending || historyPending && !analytics.priceAnnual?.length ? state
      : <DetailAnnualHistory rows={analytics.priceAnnual ?? []} label="종가" unit="원" />));
    const corporation = security?.company ?? company?.company;
    if (corporation) order.push(section('company-information', '기업 정보', <SecurityCompanyInfo company={corporation} />));
  } else if (canShowMetric) {
    switch (metric) {
      case 'marketcap':
        if (companyPage) order.push(compare(), trend());
        else {
          order.push(trend());
          if (company && members.length) {
            order.push(compare(), section('marketcap-component-history', '종목별 시가총액 이력',
              state || <InteractiveChartSection companyMarketcapData={company} companySecs={companySecs} type="detailed"
                selectedSecurityId={security?.securityId} selectedType={security?.type || '시가총액 구성'} start={start} end={end} />));
          }
        }
        order.push(annual(), average(), priceHistory());
        break;
      case 'per':
        order.push(trend(), extra('distribution'), average(), extra('monthly'), annual(), priceHistory());
        break;
      case 'pbr':
        order.push(trend(), section('book-value', '연말 주당순자산', state || <DetailHistoryChart rows={detailObservations(sourceHistory, 'bps')}
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
        order.push(trend(), annual(), priceHistory(), average());
        break;
    }
    if (ranking?.currentRank != null && neighbors.some(row => Number(row.currentRank ?? row.marketcapRank) !== ranking.currentRank)) {
      order.push(section('nearby-ranks', '가까운 ' + (companyPage ? '기업 시가총액' : label) + ' 순위',
        <NearbyRanks rows={neighbors} ranking={ranking} metric={metric} companyPage={companyPage} scope={scope} />,
        <Link prefetch={false} href={rankingRoute}>전체 순위 보기</Link>));
    }
  }
  const hasLifecycle = !companyPage && security && Boolean(security.listingPeriods?.length || security.lifecycleEvents?.length || security.historicalPeriod);
  if (hasLifecycle) order.push({ id: 'listing-history', label: '상장 기간 · 이름 변경', body:
    <section id="listing-history" className="investor-record detail-listing-history" aria-label="상장 이력">
      <SecurityLifecycle periods={security.listingPeriods ?? []} events={security.lifecycleEvents ?? []} selected={security.selectedPeriod ?? null} route={route} search={search} />
      {security.historicalPeriod && <p className="investor-muted">이전 상장기의 자료입니다. 현재 공개값과 순위는 현재 상장기의 자료입니다.</p>}
    </section>,
  });
  const sections = order.map(({ id, label: sectionLabel }) => ({ id, label: sectionLabel }));
  const compactShare = detailHref(route + '/', scope);

  return <div className="app-container detail-grid investor-detail">
    {security && <RecentSecurityTracker secCode={secCode} securityId={security.securityId} routeCode={security.routeCode}
      lastPath={recentDetailPath(route, scope.periodId ? { period: scope.periodId, start, end } : { start, end })}
      name={security.name} korName={security.korName} ticker={security.ticker} exchange={security.exchange}
      metricType={metric} metricValue={security[metric]} />}
    <DetailInvestorNavigation groups={detailNavGroups({ company, security: navSecurity, companyPage, basic, metric, scope })} />
    <div className="detail-content investor-content">
      <nav aria-label="Breadcrumb" className="detail-breadcrumb investor-breadcrumb">
        <Link prefetch={false} href="/">홈</Link><span aria-hidden="true">·</span><Link prefetch={false} href={rankingRoute}>
          {companyPage ? '기업 시가총액 순위' : label + ' 순위'}
        </Link><span aria-hidden="true">·</span><span>{name}</span>
      </nav>
      <StickyCompanyHeader displayName={name} companyName={company?.companyKorName || security?.company?.korName}
        logoUrl={security?.company?.logo || company?.company?.logo} titleSuffix={pageLabel}
        actions={<ShareButton title={name + ' ' + pageLabel} text={siteConfig.name + '에서 ' + name + '의 ' + pageLabel + ' 기록을 확인하세요.'}
          url={new URL(compactShare, siteConfig.url).href} />} />
      <div className="detail-identity-meta">
        <p>{companyPage ? '기업 전체 · 보통주·우선주 합산' : [security?.type, security?.ticker, security?.exchange].filter(Boolean).join(' · ')}</p>
        <p>공개 기준일 {publication?.asOf || '미공개'}</p>
      </div>
      {historyError && <p role="alert" className="investor-error">{historyError} <button type="button" onClick={onRetry}>다시 시도</button></p>}
      {(start || end) && <div className="investor-legacy-range">
        <span>선택 기간 {start || '처음'} ~ {end || '마지막'}</span>
        <Link prefetch={false} href={detailHref(route, { periodId })}>기간 초기화</Link>
      </div>}

      <div className="investor-overview">
        {!dividend && download}
        {companyPage ? <CompanyMarketcapOverview company={company} members={members} ranking={ranking} basis={publication?.asOf} /> :
          dividend ? <section id="current-overview" className="investor-dividend-overview">
            <DetailRecordHeading title="구성 종목 배당 비교" />
            <DividendTable members={selectedMembers} securityId={security?.securityId} metric={metric} csvStem={stem} scope={scope} basis={publication?.asOf} />
            <div className="investor-stock-scope">
              {security && <StockSelection members={selectedMembers} current={security} label="분석 종목" metric={metric} scope={scope} />}
              {download}
            </div>
            {missing}
          </section> :
          <section id="current-overview" aria-label="현재 공개값">
            {security && (pricePage || metric === 'marketcap') && <StockSelection members={selectedMembers} current={security}
              label="종목 선택" metric={pricePage ? undefined : 'marketcap'} scope={scope} />}
            {security && !basic && (metric === 'per' || metric === 'pbr') && canShowMetric
              ? <ValuationSummary metric={metric} security={security} previous={snapshotAnalysis.previousValuation ?? null} scope={scope} basis={publication?.asOf} />
              : <dl className="investor-amounts">
                <div className="investor-primary">
                  <dt>{pricePage ? lastClose != null ? '마지막 종가' : '종가' : label}</dt>
                  <dd className="investor-primary-value" title={detailValue(pricePage ? price.value ?? lastClose : snapshot.value, pricePage ? '원' : info.unit)}>
                    {detailValue(pricePage ? price.value ?? lastClose : snapshot.value, pricePage ? '원' : info.unit, metric === 'marketcap' && !pricePage)}
                  </dd>
                  {(pricePage ? quoteDate : snapshot.date) !== publication?.asOf
                    && <dd className="investor-muted">{(pricePage ? quoteDate : snapshot.date) || '기준일 미등록'}</dd>}
                </div>
                {pricePage ? <>
                  <div><dt>전일 대비</dt><dd className={rate && rate > 0 ? 'market-up' : rate && rate < 0 ? 'market-down' : ''}>{rateText}</dd></div>
                  <div><dt>거래량</dt><dd>{detailValue(sourceValue(quote?.volume), '주')}</dd></div>
                </> : <>
                  {relatedMetric && relatedLink && <div><dt>{detailMetricLabel(relatedMetric)}</dt><dd>{relatedLink}</dd></div>}
                  {security && <div><dt>종가</dt><dd>{price.value == null ? '—' : <Link prefetch={false}
                    href={detailHref(securityPath(security), scope)}>{detailValue(price.value, '원')}</Link>}</dd>
                    {price.date && price.date !== publication?.asOf && <dd className="investor-muted">{price.date}</dd>}</div>}
                  {ranking?.currentRank != null && <div><dt>전체 순위</dt><dd>{ranking.currentRank.toLocaleString('ko-KR')}위</dd>
                    {ranking.rankDate && ranking.rankDate !== publication?.asOf && <dd className="investor-muted">{ranking.rankDate}</dd>}</div>}
                </>}
              </dl>}
            {missing}
          </section>}
        {!basic && canShowMetric && <SnapshotDifference analysis={snapshotAnalysis} unit={info.unit} />}
        {!basic && !companyPage && exclusionLabel && <p className="investor-muted">순위 제외 사유 · {exclusionLabel}</p>}
        {!canShowMetric && !historyPending && !historyError && <div className="investor-unavailable">
          <p>이 종목의 {label} 제공 이력이 없습니다. 지표 이동에서 제공되는 다른 기록을 볼 수 있습니다.</p>
          {siblingMetricLinks.map(member => <Link key={member.securityId} prefetch={false}
            href={detailHref(securityPath(member, metric), { start, end })}>{securityName(member)} {label} 보기</Link>)}
        </div>}
      </div>

      <DetailInvestorOutline sections={sections} inline />
      {order.map(({ id, body }) => <Fragment key={id}>{body}</Fragment>)}
      {!basic && canShowMetric && <details id="metric-formula" className="investor-disclosure">
        <summary>지표 설명 · 계산식</summary><p>{companyPage ? '기업 시가총액은 회사의 보통주·우선주 등 종목을 합산한 공개 결과입니다.' : info.formula}</p>
      </details>}
      <PublicationBasis publication={publication} companyPage={companyPage} />
    </div>
    <aside className="context-rail investor-context hidden xl:block" data-full-recent-rail>
      <div className="detail-rail-content">
        <RecentSecuritiesSidebar currentSecCode={secCode} />
        <DetailInvestorOutline sections={sections} />
      </div>
    </aside>
  </div>;
}

function SnapshotDifference({ analysis, unit }: { analysis: DetailSnapshotAnalysis; unit: string }) {
  const { priorObservation, snapshotChange, snapshotDifference, priorValueSign, snapshotComparisonReason } = analysis;
  if (snapshotComparisonReason) return <p className="investor-muted">{snapshotComparisonReason}</p>;
  if (!priorObservation) return null;
  const date = priorObservation.date;
  if (snapshotChange != null) return <p className="investor-muted">
    {date} 이력 대비 {compareBusinessValues(snapshotChange, 0) === 1 ? '+' : ''}{detailValue(snapshotChange, '%')}
  </p>;
  return snapshotDifference != null && priorValueSign != null && priorValueSign <= 0 ? <p className="investor-muted">
    {date} 이력 대비 차이 {detailValue(snapshotDifference, unit)} · 이전 값이 {priorValueSign === 0 ? '0' : '음수'}라 증감률 계산 불가
  </p> : null;
}

function PeriodStats({ analysis, info, companyPage }: { analysis: DetailAnalysis; info: typeof DETAIL_METRICS[DetailMetric]; companyPage: boolean }) {
  const { means, summary, analysisEnd } = analysis;
  return <>
    {analysisEnd && <p className="investor-muted">분석 기준 {analysisEnd}</p>}
    <dl className="investor-period-stats">
      {means.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{detailValue(row.mean, info.unit, companyPage)}</dd>
        <dd className="investor-muted">{row.count ? row.start + ' ~ ' + row.end + ' · ' + row.count.toLocaleString('ko-KR') + '개' : '제공 관측 없음'}</dd></div>)}
    </dl>
    <p className="investor-muted">{summary.count ? '분석 범위 ' + summary.start + ' ~ ' + summary.end + ' · 실제 관측 ' + summary.count.toLocaleString('ko-KR') + '개' : '이 범위에 제공된 관측이 없습니다.'}
      {companyPage && ' · 날짜별 등록 종목 부분 합계의 평균입니다. 관측 종목 구성이 다른 날짜도 포함될 수 있습니다.'}</p>
    {summary.count > 0 && <p className="investor-muted">최저 {detailValue(summary.min, info.unit)} · 최고 {detailValue(summary.max, info.unit)}</p>}
  </>;
}

function TradeInfo({ security, quote, date }: { security: DetailSecurityView | null; quote?: Record<string, unknown>; date: string | null }) {
  const quoteFields = [['시가', 'open'], ['고가', 'high'], ['저가', 'low'], ['거래량', 'volume']] as const;
  const values = quoteFields.map(([label, key]) => ({ key, cells: [{ value: label }, { value: detailValue(sourceValue(quote?.[key]), key === 'volume' ? '주' : '원'), date }] }));
  const rows = [
    ...values,
    { key: 'shares', cells: [{ value: '발행주식 수' }, { value: detailValue(security?.shares, '주'), date: security?.sharesDate }] },
    { key: 'code', cells: [{ value: '종목코드' }, { value: security?.ticker ?? null }] },
  ];
  return <InvestorTable columns={['항목', '값']} rows={rows} label="거래 정보" basis={date} />;
}

function SecurityCompanyInfo({ company }: { company: DetailCorporation }) {
  const rows = [['기업명', company.korName || company.name], ['업종', company.industry], ['설립일', company.establishedDate]];
  const homepage = company.homepage?.trim();
  const website = homepage && /^(?:https?:\/\/)[^\s]+$/i.test(homepage) ? homepage : null;
  return <InvestorTable columns={['항목', '기업 정보']} label="기업 정보"
    rows={[
      ...rows.map(([label, value]) => ({ key: label ?? '', cells: [{ value: label }, { value }] })),
      ...(website ? [{ key: 'website', cells: [{ value: '홈페이지' }, { value: website,
        display: <a href={website} target="_blank" rel="noopener noreferrer">{website}</a> }] }] : []),
    ]} />;
}

function NearbyRanks({ rows, ranking, metric, companyPage, scope }: {
  rows: Record<string, unknown>[]; ranking: NonNullable<Ranking>; metric: DetailMetric; companyPage: boolean; scope: { start?: string; end?: string };
}) {
  const info = DETAIL_METRICS[metric];
  const data = rows.flatMap(row => {
    const position = Number(row.currentRank ?? row.marketcapRank);
    const id = companyPage ? row.companyId : row.securityId;
    if (!id || !Number.isInteger(position) || position <= 0) return [];
    const target = typeof row.routeCode === 'string' ? row.routeCode : null;
    const name = String(row.korName || row.name || row.ticker || '—');
    const path = companyPage ? companyPath({ companyId: String(id), routeCode: target }, 'marketcap')
      : securityPath({ securityId: String(id), ticker: String(row.ticker ?? ''), exchange: String(row.exchange ?? ''), routeCode: target }, metric);
    return [{ key: String(id), selected: position === ranking.currentRank, cells: [
      { value: position.toLocaleString('ko-KR') + '위' }, { value: name, display: position === ranking.currentRank ? name
        : <Link prefetch={false} href={detailHref(path, { start: scope.start, end: scope.end })}>{name}</Link> },
      { value: detailValue(sourceValue(row.value ?? row[metric] ?? row.totalMarketcap), info.unit, metric === 'marketcap') },
    ] }];
  });
  return <InvestorTable columns={['순위', '이름', detailMetricLabel(metric)]} rows={data} label="인접 순위" />;
}

function PublicationBasis({ publication, companyPage }: { publication?: DetailPublication | null; companyPage: boolean }) {
  return <details id="publication-basis" className="investor-disclosure">
    <summary>조회 기준 · 자료 공개 정보</summary>
    <dl className="investor-publication">
      <div><dt>자료 갱신번호</dt><dd>{publication?.revision ?? '—'}</dd></div>
      <div><dt>자료 범위</dt><dd>{publication?.scopeKey === 'krx-all' ? '한국거래소 전체 (krx-all)' : publication?.scopeKey || '—'}</dd></div>
    </dl>
    <p>현재값과 순위는 공개 결과를 사용합니다. 이력과 통계의 실제 관측일은 각 기록에서 확인할 수 있습니다.
      {companyPage && ' 과거 등록 종목 합계는 그날 제공된 관측으로 계산합니다.'}</p>
  </details>;
}

function historyCsvRows({ basic, companyPage, company, sourceHistory, prices, metric }: DetailSurfaceProps) {
  if (basic && !companyPage) return prices.filter(row => typeof row.date === 'string' && isBusinessDay(row.date)).map(row => ({
    '거래일': row.date, '시가': sourceValue(row.open), '고가': sourceValue(row.high), '저가': sourceValue(row.low),
    '종가': sourceValue(row.close), '거래량': sourceValue(row.volume),
  }));
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
