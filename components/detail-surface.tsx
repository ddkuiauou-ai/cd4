import Link from 'next/link';
import {SecurityLifecycle} from './security-lifecycle';
import type {SecurityListingPeriod,SecurityLifecycleEvent} from '@/lib/security-lifecycle';
import type { getSecurityDetailSnapshot } from '@/lib/data/detail-snapshot';
import type { DetailSecurityRow, DetailCompanyView, DetailCorporation, DetailPublication } from './detail-types';
import { companyPath, securityPath, securityRouteCode } from '@/lib/entity-paths';
import { businessChangePercent, compareBusinessValues, formatBusinessValue, formatCompactBusinessValue, isBusinessDay, subtractBusinessValues, summarizeBusinessWindow, type BusinessValue } from '@/lib/business-analysis';
import { DETAIL_METRICS, detailAnnualRows, earlierDate, periodMeans, selectDetailRange, sourceValue, type DetailMetric, type DetailObservation, type DetailAnnualRow } from '@/lib/detail-presentation';
import { StickyCompanyHeader } from './sticky-company-header';
import { CompanyFinancialTabs } from './company-financial-tabs';
import { DetailMobileNavigation } from './detail-mobile-navigation';
import { RecentSecurityTracker } from './recent-security-tracker';
import { recentDetailPath } from '@/lib/recent-securities';
import { RecentSecuritiesSidebar } from './recent-securities-sidebar';
import { PageNavigation } from './page-navigation';
import { DetailMetricFacts } from './detail-metric-facts';
import { DetailEntitySelector, detailEntityMembers } from './detail-entity-selector';
import { DetailComparisonSummary } from './detail-comparison-summary';
import { InteractiveChartSection } from './interactive-chart-section';
import { DetailHistoryChart } from './detail-history-chart';
import { DetailCurrentPrice } from './detail-current-price';
import { DetailFinancialAnalysis, DetailPriceHistory, DetailAnnualHistory } from './restored-detail-charts';
import CardCompanyMarketcap from './card-company-marketcap';
import { CsvDownloadButton } from './CsvDownloadButton';
import ShareButton from './share-button';
import RankHeader from './header-rank';
import { siteConfig } from '@/config/site';

export type DetailSearch = Record<string, string | string[] | undefined>;
type SecuritySnapshot = NonNullable<Awaited<ReturnType<typeof getSecurityDetailSnapshot>>>;
type MetricField = DetailMetric | `${DetailMetric}Date` | `${DetailMetric}State` | `${DetailMetric}LastProvided` | `${DetailMetric}LastProvidedDate`;
export type DetailSecurityView = Pick<SecuritySnapshot['security'],
  'securityId' | 'routeCode' | 'name' | 'korName' | 'ticker' | 'exchange' | 'type' | 'state'
  | 'price' | 'priceDate' | 'priceState' | 'shares' | 'sharesDate'> & Partial<Pick<SecuritySnapshot['security'], MetricField>> & {
  company: DetailCorporation | null; publication: DetailPublication | null;
  listingPeriods?:SecurityListingPeriod[]; lifecycleEvents?:SecurityLifecycleEvent[];
  selectedPeriod?:SecurityListingPeriod|null; historicalPeriod?:boolean;
};
type Ranking = { currentRank: number | null; priorRank?: number | null; rankDate?: string | null; rankingState?: string | null; exclusionReason?: string | null } | null;
const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const text = (value: BusinessValue | undefined, unit = '') => value == null ? '—' : `${formatBusinessValue(value)}${unit}`;

export interface DetailSurfaceProps {
  security: DetailSecurityView | null; company: DetailCompanyView | null; companySecs: DetailSecurityRow[];
  ranking: Ranking; neighbors: Record<string, unknown>[]; history: DetailObservation[]; sourceHistory: Record<string, unknown>[];
  prices: Record<string, unknown>[]; metric: DetailMetric; basic: boolean; companyPage?: boolean; search: DetailSearch;
  initialAnalysis?: DetailAnalysis; historyPending?: boolean; historyError?: string; onRetry?: () => void;
}

export interface DetailAnalysis {
  analysisEnd: string;
  summary: ReturnType<typeof summarizeBusinessWindow>;
  means: ReturnType<typeof periodMeans>;
  priorObservation: {date: string; value: BusinessValue} | null;
  snapshotChange: string | null;
  snapshotDifference: string | null;
  priorValueSign: number | null;
  snapshotComparisonReason: string | null;
  annualRows: DetailAnnualRow[];
  hasHistory: boolean;
  historyEnd?: string;
}

export function prepareDetailAnalysis({ security, company, history, metric, companyPage = false, search }: Pick<DetailSurfaceProps, 'security' | 'company' | 'history' | 'metric' | 'companyPage' | 'search'>): DetailAnalysis {
  const securityRecord = security as unknown as Record<string, unknown> | null;
  const current = companyPage ? company?.state === 'published' ? company.totalMarketcap : null : security?.state === 'published' ? sourceValue(securityRecord?.[metric]) : null;
  const currentDate = companyPage ? company?.totalMarketcapDate ?? null : String(securityRecord?.[`${metric}Date`] ?? '') || null;
  const publication = companyPage ? company?.publication : security?.publication;
  const start = single(search.start), end = single(search.end);
  const invalid = Boolean(start && !isBusinessDay(start) || end && !isBusinessDay(end) || start && end && start > end);
  const selected = invalid ? [] : selectDetailRange(history, start, end);
  const analysisEnd = end || publication?.asOf || history.at(-1)?.date || '';
  const snapshotObservation = history.find(row => row.date === currentDate && compareBusinessValues(row.value, current) === 0);
  const priorObservation = snapshotObservation ? history.filter(row => row.date < snapshotObservation.date && row.value != null).at(-1) : null;
  const sameCoverage = !companyPage || snapshotObservation && priorObservation && JSON.stringify([...(snapshotObservation.observedSecurityIds ?? [])].sort()) === JSON.stringify([...(priorObservation.observedSecurityIds ?? [])].sort());
  return {
    analysisEnd, summary: summarizeBusinessWindow(selected), means: periodMeans(selected, analysisEnd),
    priorObservation: priorObservation ? {date: priorObservation.date, value: priorObservation.value} : null,
    snapshotChange: priorObservation && sameCoverage ? businessChangePercent(priorObservation.value, current) : null,
    snapshotDifference: priorObservation && sameCoverage ? subtractBusinessValues(current, priorObservation.value) : null,
    priorValueSign: priorObservation ? compareBusinessValues(priorObservation.value, '0') : null,
    snapshotComparisonReason: current == null ? null : !snapshotObservation ? '현재값과 같은 날짜·값의 이력이 없어 비교할 수 없습니다.'
      : !priorObservation ? '이전 제공 이력이 없어 비교할 수 없습니다.'
      : !sameCoverage ? '관측 종목 구성이 달라 이전 이력과의 비교를 표시하지 않습니다.' : null,
    annualRows: detailAnnualRows(selected, metric), hasHistory: history.some(row => row.value != null), historyEnd: history.at(-1)?.date,
  };
}

const historyPlaceholder = () => <div role="status" className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">차트를 불러오는 중…</div>;

export function DetailSurface({ security, company, companySecs, ranking, neighbors, history, sourceHistory, prices, metric, basic, companyPage = false, search, initialAnalysis, historyPending = false, historyError, onRetry }: DetailSurfaceProps) {
  const info = DETAIL_METRICS[metric];
  const name = companyPage ? company?.companyKorName || company?.companyName || '기업' : security?.korName || security?.name || '종목';
  const route = companyPage && company ? companyPath(company, basic ? undefined : 'marketcap') : security ? securityPath(security, basic ? undefined : metric) : '/marketcaps';
  const secCode = security ? securityRouteCode(security) : company?.companyId || '';
  const securityRecord = security as unknown as Record<string, unknown> | null;
  const companyHistoryAvailable = company && (companyPage || company.securities.some(row=>row.securityId === security?.securityId));
  const current = companyPage ? company?.state === 'published' ? company.totalMarketcap : null : security?.state === 'published' ? sourceValue(securityRecord?.[metric]) : null;
  const currentDate = companyPage ? company?.totalMarketcapDate ?? null : String(securityRecord?.[`${metric}Date`] ?? '') || null;
  const publication = companyPage ? company?.publication : security?.publication;
  const asOf = publication?.asOf;
  const start = single(search.start), end = single(search.end);
  const invalid = Boolean(start && !isBusinessDay(start) || end && !isBusinessDay(end) || start && end && start > end);
  const selected = invalid ? [] : selectDetailRange(history, start, end);
  const { analysisEnd, summary, means, priorObservation, snapshotChange, snapshotDifference, priorValueSign, snapshotComparisonReason, annualRows, hasHistory, historyEnd } = initialAnalysis ?? prepareDetailAnalysis({security, company, history, metric, companyPage, search});
  const metricState = String(securityRecord?.[`${metric}State`] ?? 'no_observation');
  const states: Record<string, string> = { provided: '제공됨', source_missing: '원천 미제공', unsupported: '미지원', row_missing: '원천 행 미제공', unexplained_missing: '자료 확인 필요', no_observation: '관측 없음' };
  const exclusionReason = ranking?.exclusionReason;
  const exclusionLabel = exclusionReason && !(current == null && exclusionReason === metricState)
    ? states[exclusionReason] || (/^[a-z][a-z0-9_]*$/.test(exclusionReason) ? '순위 산정 기준을 충족하지 않습니다.' : exclusionReason) : null;
  const price = security?.state === 'published' && security?.priceState === 'provided' ? security.price : null;
  const priceRecord = prices.find(row => row.date === security?.priceDate && compareBusinessValues(sourceValue(row.close), price ?? null) === 0);
  const quote = { close: price, rate: priceRecord?.rate == null || !Number.isFinite(Number(priceRecord.rate)) ? null : Number(priceRecord.rate), date: security?.priceDate, open: sourceValue(priceRecord?.open), volume: sourceValue(priceRecord?.volume) };
  const hasComparison = companySecs.length > 0 || Boolean(company?.securities.length);
  const stockBasic = basic && !companyPage;
  const financialPage = !basic && metric !== 'marketcap';
  const hasFinancialAnalysis = financialPage && ['per', 'bps', 'dps'].includes(metric);
  const StatisticsSection = financialPage ? 'details' : 'section';
  const AnnualSection = financialPage ? 'details' : 'section';
  const hasLifecycle = !companyPage && Boolean(security && ((security.listingPeriods?.length ?? 0) || (security.lifecycleEvents?.length ?? 0) || security.historicalPeriod));
  const sections = [
    { id: 'entity-selection', label: '기업 전체와 구성 종목' },
    { id: 'current-overview', label: basic ? '현재 공개값' : companyPage ? '기업 합산 시가총액' : `현재 ${info.label}` },
    ...(stockBasic ? [
      { id: 'price-information', label: '거래 정보' },
      ...(hasComparison ? [{ id: 'securities-summary', label: '같은 기업의 종목 비교' }] : []),
      { id: 'price-history', label: '주가 이력' },
      ...((security?.company || company?.company) ? [{ id: 'company-information', label: '기업 정보' }] : []),
      { id: 'basic-information', label: '종목 기본 정보' },
    ] : basic ? [{ id: 'basic-information', label: '기업 기본 정보' }, { id: 'price-information', label: '주가 정보' },
      ...((security?.company || company?.company) ? [{ id: 'company-information', label: '기업 정보' }] : []),
      ...(hasComparison ? [{ id: 'securities-summary', label: '같은 기업의 종목 비교' }] : [])]
      : [...(metric === 'marketcap' && hasComparison ? [{ id: 'securities-summary', label: '같은 기업의 종목 비교' }] : []),
        { id: 'chart-analysis', label: `${info.label} 추이와 분석` },
        ...(financialPage ? [
          { id: 'trend-statistics', label: '표시 관측 통계' },
          ...(hasFinancialAnalysis ? [{ id: 'metric-analysis', label: '월별 기록 · 관측값 분포' }] : []),
          { id: 'price-history', label: '주가 이력' },
        ] : []),
        { id: 'indicators', label: financialPage ? '조회 기간 상세 통계' : '기간 통계' },
        ...(financialPage && hasComparison ? [{ id: 'securities-summary', label: `같은 기업의 종목 비교 (${info.label})` }] : []),
        { id: 'annual-data', label: '연도별 기록' },
        ...(hasHistory ? [{ id: 'history-download', label: '전체 이력 CSV' }] : []), { id: 'metric-formula', label: '계산식' }]),
    ...(hasLifecycle ? [{ id: 'listing-history', label: '상장 기간 · 이름 변경' }] : []),
    { id: 'publication-basis', label: '조회 기준 · 자료 공개 정보' },
    ...(!basic && ranking?.currentRank != null && neighbors.length ? [{ id: 'nearby-ranks', label: `가까운 ${info.label} 순위` }] : []),
  ];
  const indicatorCards = [
    { title: `현재 ${info.label}`, value: current, observations: null },
    ...means.map(row => ({ title: row.label, value: row.mean, observations: row })),
    { title: '최저값', value: summary.min, observations: summary },
    { title: '최고값', value: summary.max, observations: summary },
  ];
  const facts: Array<[string, string]> = [[`${info.label} 순위`, ranking?.currentRank == null ? '—' : `${ranking.currentRank}위`], [`현재 ${info.label}`, current == null ? '—' : `${formatCompactBusinessValue(current)}${info.unit}`], ['현재 주가', text(price, '원')], ['전일 대비', quote.rate == null ? '—' : `${quote.rate > 0 ? '+' : ''}${quote.rate.toFixed(2)}%`]];
  const rawCsv = companyPage ? sourceHistory.map(row => {
    const result: Record<string, unknown> = { date: row.date, '등록 종목 합계': row.totalMarketcap, observedCount: row.observedCount, targetCount: row.targetCount };
    const breakdown = row.securitiesBreakdown as Record<string, unknown> | undefined;
    for (const member of company?.securities ?? []) result[`${member.korName || member.name || '종목'} (${member.ticker || '—'} · ${member.securityId})`] = breakdown?.[member.securityId] ?? null;
    return result;
  }) : sourceHistory.map(row => ({ date: row.date, [metric]: row[metric] ?? null, ...(metric === 'per' ? { eps: row.eps ?? null } : metric === 'pbr' ? { bps: row.bps ?? null } : {}), state: row[`${metric}State`] ?? 'provided' }));
  const filename = `${secCode.replace(/\./g, '-')}-${companyPage ? 'annual-marketcap' : metric}${historyEnd ? `-${historyEnd}` : ''}.csv`;
  const rankLabel = `${companyPage ? '기업' : '종목'} ${info.label} 순위`;
  const currentOverview = <section id="current-overview" className="detail-current-overview" aria-label="현재 공개값">
      <RankHeader rank={ranking?.currentRank} rankLabel={rankLabel} marketcap={current ?? undefined} marketcapLabel={companyPage ? '기업 전체 시가총액' : `현재 ${info.label}`} marketcapUnit={info.unit}
        marketcapDate={currentDate} price={price ?? undefined} priceDate={security?.priceDate} priceRate={quote.rate} basic={basic} priceLabel={companyPage ? '대표 보통주 주가' : '현재 주가'} exchange={security?.exchange} isCompanyLevel={companyPage} />
      <p className="detail-current-basis">순위 기준 {ranking?.rankDate || '—'}</p>
      {!basic && current == null && <p role="status" className="mt-2 text-sm text-muted-foreground">{companyPage ? company?.state === 'unpublished' ? '아직 공개된 기업 합산값이 없습니다.' : company?.marketcapCompleteness === 'missing_input' ? '합산 자료가 부족합니다.' : '합산 근거를 확인 중입니다.' : security?.state === 'unpublished' ? '아직 공개된 종목 지표가 없습니다.' : states[metricState] || '자료 확인 필요'}{security?.state === 'published' && securityRecord?.[`${metric}LastProvided`] != null && ` · 마지막 제공값 ${text(sourceValue(securityRecord[`${metric}LastProvided`]), info.unit)} (${String(securityRecord[`${metric}LastProvidedDate`] ?? '—')})`}</p>}
      {exclusionLabel && <p className="mt-2 text-xs text-muted-foreground">순위 제외 사유: {exclusionLabel}</p>}
      {stockBasic && <details id="price-information" className="detail-quote-facts"><summary>거래 정보 <span>시가 · 거래량 · 발행주식</span></summary><dl>
        {[["시가", text(quote.open, '원')], ["거래량", text(quote.volume, '주')], ["발행주식 수", text(security?.shares, '주')]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl><p>거래 기준 {quote.date || '—'} · 발행주식 기준 {security?.sharesDate || '—'}</p></details>}
      </section>;
  return <div className={`app-container detail-grid${financialPage ? ' detail-financial-page' : ''}`}>
    {security && <RecentSecurityTracker secCode={secCode} securityId={security.securityId} routeCode={security.routeCode}
      lastPath={recentDetailPath(route, {period: companyPage ? undefined : security.selectedPeriod?.periodId, start, end})} name={security.name} korName={security.korName} ticker={security.ticker} exchange={security.exchange}
      metricType={metric} metricValue={security[metric]} />}
    <div className="detail-content min-w-0">
      {historyError && <p role="alert" className="mb-4 text-sm text-destructive">{historyError} <button type="button" className="min-h-10 px-3 underline underline-offset-4" onClick={onRetry}>다시 시도</button></p>}
      <nav aria-label="Breadcrumb" className="detail-breadcrumb flex flex-wrap gap-1 text-muted-foreground"><Link prefetch={false} href="/">홈</Link><span aria-hidden="true">·</span><Link prefetch={false} href={companyPage ? '/marketcaps' : `/${metric}`}>{companyPage ? '기업 시가총액 순위' : `종목 ${info.label} 순위`}</Link><span aria-hidden="true">·</span><span>{name}</span></nav>
      <StickyCompanyHeader displayName={name} companyName={company?.companyKorName || security?.company?.korName} logoUrl={security?.company?.logo || company?.company?.logo}
        titleSuffix={basic ? '기본 정보' : companyPage ? '시가총액' : ['per', 'pbr', 'eps', 'bps'].includes(metric) ? info.label : info.name}
        detail={null}
        actions={<ShareButton title={`${name} ${basic ? '기본 정보' : info.label}`} text={`${name}의 ${basic ? '기업·종목 정보' : `${info.label} 추이와 지표`}를 ${siteConfig.name}에서 확인하세요.`} url={`${siteConfig.url}${route}/`} />} />
      <div className="detail-identity-meta"><p>{companyPage ? '기업 전체 · 보통주·우선주 합산' : [security?.type, security?.ticker, security?.exchange].filter(Boolean).join(' · ')}</p><p>공개 기준일 {asOf || '미공개'}</p></div>
      <DetailEntitySelector company={company} companySecs={companySecs} security={security} companyPage={companyPage} basic={basic} metric={metric} start={start} end={end} periodId={security?.selectedPeriod?.periodId} />
      <CompanyFinancialTabs start={start} end={end} periodId={security?.selectedPeriod?.periodId} security={security ? {securityId:security.securityId,routeCode:security.routeCode,exchange:security.exchange,ticker:security.ticker} : undefined} company={company ? {companyId:company.companyId,routeCode:company.routeCode} : undefined} />
      {stockBasic ? <div className={`detail-basic-record-grid ${hasComparison ? 'detail-basic-has-comparison' : ''}`}>
        {currentOverview}
        {hasComparison && <DetailSecuritiesComparison company={company} companySecs={companySecs} security={security} metric="marketcap" companyPage={false} />}
        <DetailMobileNavigation sections={sections} />
        <section id="price-history" className="detail-section detail-basic-price-history"><header className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-semibold">주가 이력</h2><p className="text-xs text-muted-foreground">{security?.ticker || '—'} · 제공된 실제 거래 기록</p></header>
          {invalid ? <p role="alert" className="text-sm text-destructive">시작일과 종료일을 확인해 주세요. 시작일은 종료일 이전이어야 합니다.</p> : historyPending ? historyPlaceholder() : <DetailPriceHistory rows={prices} start={start} end={end} />}
        </section>
        <BasicInformation security={security} company={company} companyPage={false} quote={quote} part="company" />
        <BasicInformation security={security} company={company} companyPage={false} quote={quote} part="basic" />
      </div> : !basic && metric === 'marketcap' && hasComparison ? <div className="detail-cap-record-grid">
        {currentOverview}<DetailSecuritiesComparison company={company} companySecs={companySecs} security={security} metric={metric} companyPage={companyPage} />
      </div> : currentOverview}
      {!stockBasic && <DetailMobileNavigation sections={sections} />}
      {basic ? <>{!stockBasic && <><BasicInformation security={security} company={company} companyPage={companyPage} quote={quote} />{hasComparison && <DetailSecuritiesComparison company={company} companySecs={companySecs} security={security} metric="marketcap" companyPage={companyPage} />}</>}</> : <>
        <section id="chart-analysis" className="detail-section space-y-5 border-t border-border py-6 sm:py-8">
          <header className="space-y-1"><h2 className="text-xl font-semibold">{metric === 'marketcap' ? '시가총액 추이 · 차트 분석' : `${['div', 'dps'].includes(metric) ? info.name : info.label} ${metric === 'bps' ? '연말 기록' : '추이'}`}</h2>{metric === 'marketcap' && <p className="text-sm text-muted-foreground">시가총액 추이와 종목별 구성 현황</p>}{financialPage && <p className="text-sm text-muted-foreground">{metric === 'bps' ? '실제 12월 관측만 표시합니다. 현재 공개값과 기준일이 다를 수 있습니다.' : metric === 'dps' ? '제공된 주당배당금과 직전 제공 기록 대비 변화율입니다.' : '월간·연간은 제공 관측의 평균입니다.'}</p>}</header>
          <details className="detail-date-range border-y border-border"><summary className="cursor-pointer text-sm font-medium">기간 직접 지정{financialPage && (start || end) ? ` · ${start || '처음'} ~ ${end || asOf || '마지막'}` : ''}</summary><form key={`${start || ''}:${end || ''}:${security?.selectedPeriod?.periodId || ''}`} action={route} className="my-3 flex flex-wrap items-end gap-3">
            {!companyPage && security?.selectedPeriod && <input type="hidden" name="period" value={security.selectedPeriod.periodId} />}
            <label className="text-sm">시작일<input type="date" name="start" defaultValue={start} className="mt-1 block min-h-11 rounded-md border border-input bg-background px-3 text-sm" required /></label>
            <label className="text-sm">종료일<input type="date" name="end" defaultValue={end || asOf} className="mt-1 block min-h-11 rounded-md border border-input bg-background px-3 text-sm" required /></label>
            <button type="submit" className="min-h-11 rounded-md border border-border px-4 text-sm hover:bg-muted">기간 조회</button>{(start || end) && <Link prefetch={false} href={!companyPage && security?.selectedPeriod ? `${route}?period=${encodeURIComponent(security.selectedPeriod.periodId)}` : route} className="inline-flex min-h-11 items-center px-3 text-sm underline underline-offset-4">전체 기간으로</Link>}
          </form></details>
          {invalid && <p id={financialPage ? 'trend-statistics' : undefined} role="alert" className="text-sm text-destructive">시작일과 종료일을 확인해 주세요. 시작일은 종료일 이전이어야 합니다.</p>}
          {!invalid && <div className="detail-chart-grid">
            {metric === 'marketcap' ? <div className="min-w-0 border border-border bg-background p-3 sm:p-5 lg:col-span-2">
              {historyPending ? historyPlaceholder() : companyHistoryAvailable ? <InteractiveChartSection companyMarketcapData={company} companySecs={companySecs} type="summary" selectedSecurityId={companyPage ? undefined : security?.securityId} selectedType={companyPage ? '시가총액 구성' : security?.type || '시가총액 구성'} start={start} end={end} /> : <DetailHistoryChart rows={selected.filter(row => start || end || row.date >= earlierDate(selected.at(-1)?.date || '', 3))} metric="marketcap" label="종목 시가총액" unit="원" />}
            </div> : historyPending ? <div id="trend-statistics" className="detail-chart-record min-w-0">{historyPlaceholder()}</div> :
              <div className="detail-chart-record min-w-0"><DetailHistoryChart rows={selected} metric={metric} label={info.label} unit={info.unit} selectedStart={start} selectedEnd={end || analysisEnd} annual={metric === 'bps'} customRange={Boolean(start || end)} withStatistics /></div>}
            {metric === 'marketcap' && company && <CardCompanyMarketcap data={company} selectedSecurityId={companyPage ? undefined : security?.securityId} />}
            {!financialPage && <div className="detail-price-record min-w-0"><h3 className="text-base font-semibold">{companyPage ? '대표 종목 가격 이력' : start || end ? '기간별 가격 차트' : '최근 3개월 가격 차트'}</h3><p className="mt-1 mb-3 text-xs text-muted-foreground">{name} ({security?.ticker || '—'}) · 시가·고가·저가·종가·거래량</p>{historyPending ? historyPlaceholder() : <DetailPriceHistory rows={prices} start={start} end={end} />}</div>}
          </div>}
        </section>
        {hasFinancialAnalysis && <section id="metric-analysis" className="detail-financial-secondary">{invalid ? <p className="py-4 text-sm text-destructive">조회 기간을 확인해 주세요.</p> : historyPending ? historyPlaceholder() : <DetailFinancialAnalysis rows={selected} metric={metric} name={name} />}</section>}
        {financialPage && <details id="price-history" className="detail-section detail-record-disclosure"><summary><h2>주가 이력</h2></summary><div className="detail-disclosure-content"><p className="mb-3 text-sm text-muted-foreground">{name} ({security?.ticker || '—'}) · 시가·고가·저가·종가·거래량</p>{invalid ? <p className="text-sm text-destructive">조회 기간을 확인해 주세요.</p> : historyPending ? historyPlaceholder() : <DetailPriceHistory rows={prices} start={start} end={end} />}</div></details>}
        <StatisticsSection id="indicators" className={`detail-section space-y-5 border-t border-border py-6 sm:py-8${financialPage ? ' detail-record-disclosure' : ''}`}>
          {financialPage && <summary><h2>조회 기간 상세 통계</h2></summary>}
          <header className="space-y-1">{!financialPage && <h2 className="text-xl font-semibold">핵심 지표 · 기간 통계</h2>}<p className="text-sm text-muted-foreground">{companyPage ? '등록 종목 합계' : info.label}의 기간별 분석</p><p className="text-sm leading-relaxed text-muted-foreground">평균은 이름에 표시된 기간을 분석하고, 최저·최고는 아래 분석 범위 전체를 기준으로 합니다. 직접 지정한 범위는 차트와 핵심 지표에 공통 적용됩니다.</p></header>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{indicatorCards.map(({title,value,observations},index) => <div key={title} className="min-w-0 space-y-2 border-b border-border py-4"><p className="text-xs text-muted-foreground">{title}</p><p className="text-lg font-semibold tabular-nums">{value == null ? '—' : `${formatCompactBusinessValue(value)}${info.unit}`}</p><p className="text-xs text-muted-foreground">{index === 0 ? `지표 기준 ${currentDate || '—'}` : `분석 기준 ${analysisEnd}`}</p>{observations && <p className="text-xs leading-relaxed tabular-nums text-muted-foreground">실제 관측 {observations.start || '—'} ~ {observations.end || '—'} · {observations.count}개</p>}{index === 0 && (snapshotComparisonReason ? <p className="text-xs leading-relaxed text-muted-foreground">{snapshotComparisonReason}</p> : snapshotChange != null ? <p className="text-xs text-muted-foreground">{priorObservation!.date} 이력 대비 {Number(snapshotChange) > 0 ? '+' : ''}{formatBusinessValue(snapshotChange)}%</p> : snapshotDifference != null && priorValueSign != null && priorValueSign <= 0 ? <p className="text-xs leading-relaxed text-muted-foreground">{priorObservation!.date} 이력 대비 차이 {text(snapshotDifference, info.unit)} · 이전 값이 {priorValueSign === 0 ? '0' : '음수'}라 증감률 계산 불가</p> : null)}</div>)}<div className="min-w-0 space-y-2 border-b border-border py-4"><DetailCurrentPrice price={{close:quote.close,rate:quote.rate,date:quote.date}} /></div></div>
          <p className="text-xs leading-relaxed text-muted-foreground">분석 범위 {summary.start || '—'} ~ {summary.end || '—'} · 실제 제공 {summary.count}개. 평균은 제공 관측의 산술평균이며 결측은 제외하고 실제 0·음수를 포함합니다.{companyPage && ' 회사 평균은 날짜별 등록 종목 부분 합계의 평균이며, 관측된 종목 구성이 다른 날짜도 포함될 수 있습니다.'}</p>
        </StatisticsSection>
        {financialPage && hasComparison && <DetailSecuritiesComparison company={company} companySecs={companySecs} security={security} metric={metric} companyPage={companyPage} />}
        <AnnualSection id="annual-data" className={`detail-section space-y-5 border-t border-border py-6 sm:py-8${financialPage ? ' detail-record-disclosure' : ''}`}>
          {financialPage && <summary><h2>연도별 데이터 · 기록</h2></summary>}
          <header className="space-y-1">{!financialPage && <h2 className="text-xl font-semibold">연도별 데이터 · 기록</h2>}<p className="text-sm text-muted-foreground">{info.label}의 {metric === 'bps' ? '실제 연말' : '연도별 마지막 관측'} 기준 상세 데이터를 확인합니다</p></header>
          {!invalid && metric === 'marketcap' && companyHistoryAvailable && (historyPending ? historyPlaceholder() : <InteractiveChartSection companyMarketcapData={company} companySecs={companySecs} type="detailed" selectedSecurityId={companyPage ? undefined : security?.securityId} selectedType={companyPage ? '시가총액 구성' : security?.type || '시가총액 구성'} start={start} end={end} />)}
          <DetailAnnualHistory rows={annualRows} label={companyPage ? '등록 종목 합계' : info.label} unit={info.unit} yearEndOnly={metric === 'bps'} />
        </AnnualSection>
        {hasHistory && <section id="history-download" className="detail-section detail-history-download"><h2 className="mb-3 text-xl font-semibold">전체 이력 CSV</h2><CsvDownloadButton data={rawCsv} filename={filename} label="전체 이력 CSV" /><p className="text-xs text-muted-foreground">{!companyPage && security?.selectedPeriod ? '선택한 상장 기간의 전체 제공 이력' : '선택 기간과 관계없이 전체 제공 이력'}</p></section>}
        <details id="metric-formula" className="detail-formula mt-6 border-y border-border py-3 text-sm"><summary className="cursor-pointer font-medium">지표 설명 · 계산식</summary><div className="space-y-3 px-4 py-4 text-sm leading-relaxed text-muted-foreground"><p>{companyPage ? '기업 시가총액은 회사의 보통주·우선주 등 종목을 합산한 공개 결과입니다.' : info.formula}</p><p>현재 값·순위는 공개 결과를 표시합니다. 이력은 원천의 제공값을 분석하며 현재값과 기준일이 다를 수 있습니다.</p></div></details>
      </>}
      {hasLifecycle && <section id="listing-history" className="detail-section detail-listing-history" aria-label="상장 이력">
        <SecurityLifecycle periods={security?.listingPeriods ?? []} events={security?.lifecycleEvents ?? []}
          selected={security?.selectedPeriod ?? null} route={route} search={search} />
        {security?.historicalPeriod && <p className="mt-3 text-sm text-muted-foreground">이전 상장기의 자료입니다. 현재 공개값과 순위는 이 기간의 값으로 대체하지 않습니다.</p>}
      </section>}
      <details id="publication-basis" className="detail-publication mt-3 border-y border-border text-xs text-muted-foreground">
        <summary className="min-h-10 cursor-pointer py-3 font-medium">조회 기준 · 자료 공개 정보</summary>
        <div className="space-y-3 pb-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div><dt className="mb-1">공개 기준일</dt><dd className="tabular-nums text-foreground">{publication?.asOf || '—'}</dd></div>
            <div><dt className="mb-1">자료 갱신번호</dt><dd className="break-all tabular-nums text-foreground">{publication?.revision ?? '—'}</dd></div>
            <div><dt className="mb-1">자료 범위</dt><dd className="break-all text-foreground">{publication?.scopeKey === 'krx-all' ? '한국거래소 전체 (krx-all)' : publication?.scopeKey || '—'}</dd></div>
          </dl>
          <p className="leading-relaxed">현재 값과 순위는 이 공개 결과를 표시합니다. 과거 차트와 통계는 원천의 실제 관측 이력을 분석하며 값 가까이에 각 기준일을 표시합니다.{companyPage && ' 등록 종목 합계는 해당 날짜에 관측된 종목 값의 분석용 합계이며, 공개된 기업 전체 시가총액과 구분합니다.'}</p>
        </div>
      </details>
      {!basic && <DetailPager rows={neighbors} rank={ranking?.currentRank ?? null} metric={metric} companyPage={companyPage} start={start} end={end} />}
    </div>
    <aside className="context-rail hidden xl:block"><div className="detail-rail-content space-y-6"><RecentSecuritiesSidebar currentSecCode={secCode} /><DetailMetricFacts rows={facts} note={`지표 기준 ${currentDate || '—'} · 순위 기준 ${ranking?.rankDate || '—'}`} /><section className="border-t border-border pt-5"><h3 className="mb-3 text-base font-semibold">이 페이지에서</h3><PageNavigation sections={sections} collapsible={false} /></section></div></aside>
  </div>;
}

function DetailSecuritiesComparison({ company, companySecs, security, metric, companyPage }: Pick<DetailSurfaceProps, 'company' | 'companySecs' | 'security' | 'metric' | 'companyPage'>) {
  const members = detailEntityMembers(company, companySecs, security);
  const info = DETAIL_METRICS[metric];
  return <section id="securities-summary" className="detail-section detail-comparison">
    <header className="detail-comparison-heading"><h2 className="text-xl font-semibold">같은 기업의 종목 비교{metric !== 'marketcap' ? ` (${info.label})` : ''}</h2></header>
    {metric === 'marketcap' && <DetailComparisonSummary company={company} members={members} selectedSecurityId={companyPage ? undefined : security?.securityId} />}
    <details className="detail-comparison-records" open={metric !== 'marketcap'}><summary>종목별 공개값 · 상세 표</summary><div className="detail-table-scroll"><table className="detail-comparison-table">
      <caption className="sr-only">같은 기업의 실제 구성 종목별 {info.label}와 주가. 대상 변경은 상단 기업 전체와 구성 종목 선택에서 할 수 있습니다.</caption>
      <thead><tr><th scope="col">종목</th><th scope="col">종목코드</th><th scope="col">{info.label}</th><th scope="col">주가</th><th scope="col">등락률</th></tr></thead>
      <tbody>{members.map(member => {
        const storedQuote = member.prices?.[0];
        const quoteClose = sourceValue(storedQuote?.close);
        const rate = quoteClose != null && storedQuote?.rate != null && Number.isFinite(storedQuote.rate) ? storedQuote.rate : null;
        const value = sourceValue(member[metric]);
        return <tr key={member.securityId} data-selected={!companyPage && security?.securityId === member.securityId ? 'true' : undefined}>
          <th scope="row">{member.korName || member.name || '이름 미등록'}<span className="block text-xs font-normal text-muted-foreground">{member.type || '종목'}</span></th>
          <td>{member.ticker || '—'}</td><td title={text(value, info.unit)}>{value == null ? '—' : `${formatCompactBusinessValue(value)}${info.unit}`}</td>
          <td>{text(quoteClose, '원')}</td><td className={rate == null || rate === 0 ? '' : rate > 0 ? 'market-up' : 'market-down'}>{rate == null ? '—' : `${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`}</td>
        </tr>;
      })}{metric === 'marketcap' && company && <tr className="detail-comparison-total"><th scope="row">기업 전체(합산)</th><td>—</td><td title={text(company.state === 'published' ? company.totalMarketcap : null, '원')}>{company.state === 'published' && company.totalMarketcap != null ? `${formatCompactBusinessValue(company.totalMarketcap)}원` : '—'}</td><td>—</td><td>—</td></tr>}</tbody>
    </table></div>
    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">각 종목의 공개값이며 미제공 자료는 —로 표시합니다.{metric === 'marketcap' && company && ` 기업 합산 기준 ${company.totalMarketcapDate || '—'}.`} 주가는 해당 종목에 제공된 거래 기록입니다.</p></details>
  </section>;
}

function BasicInformation({ security, company, companyPage, quote, part = 'all' }: { part?: 'all' | 'basic' | 'company'; security: DetailSecurityView | null; company: DetailCompanyView | null; companyPage: boolean; quote: { close: BusinessValue; rate: number | null; date?: string | null; open: BusinessValue; volume: BusinessValue } }) {
  const corporation = security?.company || company?.company;
  const facts = companyPage ? [['기업명', company?.companyKorName || company?.companyName || '—'], ['영문명', company?.companyName || '—'], ['업종', corporation?.industry || '—'], ['설립일', corporation?.establishedDate || '—']]
    : [['종목코드', security?.ticker || '—'], ['구분', security?.type || '—'], ['거래소', security?.exchange || '—'], ['영문명', security?.name || '—'], ['발행주식 수', text(security?.shares, '주')], ['발행주식 기준일', security?.sharesDate || '—']];
  return <>{part !== 'company' && <section id="basic-information" className="detail-section border-t border-border py-8"><h2 className="mb-5 text-xl font-semibold">{companyPage ? '기업' : '종목'} 기본 정보</h2><dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">{facts.map(([title,value]) => <div key={title} className="flex justify-between gap-4 border-b border-border py-3"><dt className="text-muted-foreground">{title}</dt><dd className="text-right font-medium tabular-nums">{value}</dd></div>)}</dl>{companyPage && <details className="mt-4 text-xs text-muted-foreground"><summary className="cursor-pointer">조회 기준</summary><p className="mt-2 break-all">기업 ID {company?.companyId || '—'}</p></details>}</section>}
    {part === 'all' && <section id="price-information" className="detail-section border-t border-border py-8"><div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-semibold">주가 정보</h2><p className="text-xs text-muted-foreground">거래 기준 {quote.date || '—'}</p></div><dl className="grid grid-cols-2 gap-x-8 gap-y-5 text-sm sm:grid-cols-4">{[['현재가',text(quote.close,'원')],['가격 등락률',quote.rate == null ? '—' : `${quote.rate > 0 ? '+' : ''}${quote.rate.toFixed(2)}%`],['시가',text(quote.open,'원')],['거래량',text(quote.volume,'주')]].map(([title,value]) => <div key={title}><dt className="mb-2 text-muted-foreground">{title}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}</dl></section>}
    {part !== 'basic' && corporation && <section id="company-information" className="detail-section border-t border-border py-8"><h2 className="mb-5 text-xl font-semibold">기업 정보</h2><dl className="space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">기업명</dt><dd>{corporation.korName || corporation.name}</dd></div>{corporation.industry && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">업종</dt><dd>{corporation.industry}</dd></div>}{corporation.establishedDate && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">설립일</dt><dd>{corporation.establishedDate}</dd></div>}{corporation.homepage && <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">홈페이지</dt><dd className="min-w-0 break-all"><a href={corporation.homepage} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{corporation.homepage}</a></dd></div>}</dl></section>}</>;
}
const infoLabel = (metric: DetailMetric) => DETAIL_METRICS[metric].label;

function DetailPager({ rows, rank, metric, companyPage, start, end }: { rows: Record<string, unknown>[]; rank: number | null; metric: DetailMetric; companyPage: boolean; start?: string; end?: string }) {
  if (rank == null) return null;
  return <nav id="nearby-ranks" aria-label="순위 이전 다음" className="mt-8 flex flex-wrap justify-between gap-3">{rows.filter(row => Number(row.currentRank ?? row.marketcapRank) !== rank).map(row => {
    const previous = Number(row.currentRank ?? row.marketcapRank) < rank;
    const path = companyPage ? companyPath({ companyId: String(row.companyId), routeCode: typeof row.routeCode === 'string' ? row.routeCode : null }, 'marketcap') : securityPath({ securityId: String(row.securityId), exchange: String(row.exchange || ''), ticker: String(row.ticker || ''), routeCode: typeof row.routeCode === 'string' ? row.routeCode : null }, metric);
    const query = new URLSearchParams();
    if (start) query.set('start', start);
    if (end) query.set('end', end);
    const href = query.size ? `${path}?${query}` : path;
    return <Link prefetch={false} key={href} href={href} className={`inline-flex min-h-14 flex-col justify-center rounded-md border border-border px-4 py-3 hover:bg-muted ${previous ? '' : 'ml-auto text-right'}`}><span className="text-xs text-muted-foreground">{previous ? '이전' : '다음'} {companyPage ? '기업 시가총액' : infoLabel(metric)} 순위</span><span className="text-sm font-medium">{String(row.korName || row.name || '')}</span></Link>;
  })}</nav>;
}
