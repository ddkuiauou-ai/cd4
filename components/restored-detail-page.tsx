import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCompanyDetailSnapshot, getSecurityDetailSnapshot } from '@/lib/data/detail-snapshot';
import type { CompanyMarketcapAggregated } from '@/lib/data/company';
import { companyPath, securityPath, securityRouteCode } from '@/lib/entity-paths';
import { businessChangePercent, compareBusinessValues, formatBusinessValue, formatCompactBusinessValue, isBusinessDay, subtractBusinessValues, summarizeBusinessWindow, type BusinessValue } from '@/lib/business-analysis';
import { DETAIL_METRICS, detailAnnualRows, detailObservations, earlierDate, periodMeans, selectDetailRange, sourceValue, type DetailMetric, type DetailObservation } from '@/lib/detail-presentation';
import { StickyCompanyHeader } from './sticky-company-header';
import { CompanyFinancialTabs } from './company-financial-tabs';
import { DetailMobileNavigation } from './detail-mobile-navigation';
import { RecentSecurityTracker } from './recent-security-tracker';
import { RecentSecuritiesSidebar } from './recent-securities-sidebar';
import { PageNavigation } from './page-navigation';
import { DetailMetricFacts } from './detail-metric-facts';
import { InteractiveSecuritiesSection } from './simple-interactive-securities';
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
type Ranking = { currentRank: number | null; priorRank?: number | null; rankDate?: string | null; rankingState?: string | null; exclusionReason?: string | null } | null;
const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const asRows = (rows: readonly object[]) => rows as Record<string, unknown>[];
const text = (value: BusinessValue | undefined, unit = '') => value == null ? '—' : `${formatBusinessValue(value)}${unit}`;

export async function RestoredSecurityDetail({ code, metric = 'marketcap', basic = false, search = {} }: { code: string; metric?: DetailMetric; basic?: boolean; search?: DetailSearch }) {
  const data = await getSecurityDetailSnapshot(code, basic ? 'price' : metric);
  if (!data) notFound();
  return <DetailSurface security={data.security} company={data.company} companySecs={data.companySecs} ranking={data.ranking}
    neighbors={asRows(data.neighbors)} history={basic ? [] : detailObservations(asRows(data.history), metric)}
    sourceHistory={asRows(data.history)} prices={asRows(data.priceHistory)} metric={metric} basic={basic} search={search} />;
}
export async function RestoredCompanyDetail({ code, basic = false, search = {} }: { code: string; basic?: boolean; search?: DetailSearch }) {
  const data = await getCompanyDetailSnapshot(code);
  if (!data) notFound();
  const history = data.history.map(row => ({ ...row, value: row.totalMarketcap }));
  return <DetailSurface security={data.security} company={data.company} companySecs={data.companySecs} ranking={data.ranking}
    neighbors={asRows(data.neighbors)} history={history} sourceHistory={asRows(data.history)} prices={asRows(data.priceHistory)}
    metric="marketcap" basic={basic} companyPage search={search} />;
}

function DetailSurface({ security, company, companySecs, ranking, neighbors, history, sourceHistory, prices, metric, basic, companyPage = false, search }: {
  security: SecuritySnapshot['security'] | null; company: CompanyMarketcapAggregated | null; companySecs: SecuritySnapshot['companySecs'];
  ranking: Ranking; neighbors: Record<string, unknown>[]; history: DetailObservation[]; sourceHistory: Record<string, unknown>[];
  prices: Record<string, unknown>[]; metric: DetailMetric; basic: boolean; companyPage?: boolean; search: DetailSearch;
}) {
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
  const analysisEnd = end || asOf || history.at(-1)?.date || '';
  const summary = summarizeBusinessWindow(selected);
  const metricState = String(securityRecord?.[`${metric}State`] ?? 'no_observation');
  const states: Record<string, string> = { provided: '제공됨', source_missing: '원천 미제공', unsupported: '미지원', row_missing: '원천 행 미제공', unexplained_missing: '자료 확인 필요', no_observation: '관측 없음' };
  const price = security?.state === 'published' && security?.priceState === 'provided' ? security.price : null;
  const priceRecord = prices.find(row => row.date === security?.priceDate && compareBusinessValues(sourceValue(row.close), price ?? null) === 0);
  const quote = { close: price, rate: priceRecord?.rate == null || !Number.isFinite(Number(priceRecord.rate)) ? null : Number(priceRecord.rate), date: security?.priceDate, open: sourceValue(priceRecord?.open), volume: sourceValue(priceRecord?.volume) };
  const sections = basic ? [{ id: 'basic-information', label: '기본 정보' }, { id: 'price-information', label: '주가 정보' }, { id: 'company-information', label: '기업 정보' }]
    : [{ id: 'chart-analysis', label: '차트 분석' }, { id: 'securities-summary', label: '종목 비교' }, { id: 'indicators', label: '핵심 지표' }, { id: 'annual-data', label: '연도별 데이터' }];
  const means = periodMeans(selected, analysisEnd);
  const snapshotObservation = history.find(row => row.date === currentDate && compareBusinessValues(row.value, current) === 0);
  const priorObservation = snapshotObservation ? history.filter(row => row.date < snapshotObservation.date && row.value != null).at(-1) : null;
  const sameCoverage = !companyPage || snapshotObservation && priorObservation && JSON.stringify([...(snapshotObservation.observedSecurityIds ?? [])].sort()) === JSON.stringify([...(priorObservation.observedSecurityIds ?? [])].sort());
  const snapshotChange = priorObservation && sameCoverage ? businessChangePercent(priorObservation.value, current) : null;
  const snapshotDifference = priorObservation && sameCoverage ? subtractBusinessValues(current, priorObservation.value) : null;
  const priorValueSign = priorObservation ? compareBusinessValues(priorObservation.value, '0') : null;
  const snapshotComparisonReason = current == null ? null : !snapshotObservation ? '현재값과 같은 날짜·값의 이력이 없어 비교할 수 없습니다.'
    : !priorObservation ? '이전 제공 이력이 없어 비교할 수 없습니다.'
    : !sameCoverage ? '관측 종목 구성이 달라 이전 이력과의 비교를 표시하지 않습니다.' : null;
  const indicatorCards = [
    { title: `현재 ${info.label}`, value: current, observations: null },
    ...means.map(row => ({ title: row.label, value: row.mean, observations: row })),
    { title: '최저값', value: summary.min, observations: summary },
    { title: '최고값', value: summary.max, observations: summary },
  ];
  const facts: Array<[string, string]> = [[`${info.label} 순위`, ranking?.currentRank == null ? '—' : `${ranking.currentRank}위`], [`현재 ${info.label}`, text(current, info.unit)], ['현재 주가', text(price, '원')], ['전일 대비', quote.rate == null ? '—' : `${quote.rate > 0 ? '+' : ''}${quote.rate.toFixed(2)}%`]];
  const rawCsv = companyPage ? sourceHistory.map(row => {
    const result: Record<string, unknown> = { date: row.date, '등록 종목 합계': row.totalMarketcap, observedCount: row.observedCount, targetCount: row.targetCount };
    const breakdown = row.securitiesBreakdown as Record<string, unknown> | undefined;
    for (const member of company?.securities ?? []) result[`${member.korName || member.name || '종목'} (${member.ticker || '—'} · ${member.securityId})`] = breakdown?.[member.securityId] ?? null;
    return result;
  }) : sourceHistory.map(row => ({ date: row.date, [metric]: row[metric] ?? null, ...(metric === 'per' ? { eps: row.eps ?? null } : metric === 'pbr' ? { bps: row.bps ?? null } : {}), state: row[`${metric}State`] ?? 'provided' }));
  const filename = `${secCode.replace(/\./g, '-')}-${companyPage ? 'annual-marketcap' : metric}${history.at(-1)?.date ? `-${history.at(-1)!.date}` : ''}.csv`;
  const rankLabel = `${companyPage ? '기업' : '종목'} ${info.label} 순위`;
  return <div className="app-container detail-grid">
    {security && <RecentSecurityTracker secCode={secCode} securityId={security.securityId} routeCode={security.routeCode}
      lastPath={route} name={security.name} korName={security.korName} ticker={security.ticker} exchange={security.exchange}
      metricType={metric} metricValue={security[metric]} />}
    <div className="detail-content min-w-0">
      <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap gap-1 text-sm text-muted-foreground"><Link href="/">홈</Link><span aria-hidden="true">·</span><Link href={companyPage ? '/marketcaps' : `/${metric}`}>{companyPage ? '기업 순위' : `${info.label} 순위`}</Link><span aria-hidden="true">·</span><span>{name}</span></nav>
      <StickyCompanyHeader displayName={name} companyName={company?.companyKorName || security?.company?.korName} logoUrl={security?.company?.logo || company?.company?.logo}
        titleSuffix={basic ? '기본 정보' : companyPage ? '시가총액' : info.name} titleBadge={companyPage ? '보통주·우선주 합산' : security?.type}
        detail={basic ? null : { label: companyPage ? '기업 합산 시가총액' : `현재 ${info.label}`, value: text(current, info.unit), badge: currentDate || undefined }}
        actions={<ShareButton title={`${name} ${basic ? '기본 정보' : info.label}`} text={`${name}의 ${basic ? '기업·종목 정보' : `${info.label} 추이와 지표`}를 ${siteConfig.name}에서 확인하세요.`} url={`${siteConfig.url}${route}/`} />} />
      <RankHeader rank={ranking?.currentRank} rankLabel={rankLabel} marketcap={current ?? undefined} marketcapLabel={companyPage ? '기업 전체 시가총액' : `현재 ${info.label}`} marketcapUnit={info.unit}
        marketcapDate={currentDate} price={price ?? undefined} priceDate={security?.priceDate} priceLabel={companyPage ? '대표 보통주 주가' : '현재 주가'} exchange={security?.exchange} isCompanyLevel={companyPage} />
      <p className="mt-2 text-xs text-muted-foreground">{companyPage ? '보통주·우선주 합산' : `${security?.type || '종목'} · ${security?.ticker || ''}`} · 순위 기준 {ranking?.rankDate || '—'}</p>
      {!basic && current == null && <p role="status" className="mt-2 text-sm text-muted-foreground">{companyPage ? company?.state === 'unpublished' ? '아직 공개된 기업 합산값이 없습니다.' : company?.marketcapCompleteness === 'missing_input' ? '합산 자료가 부족합니다.' : '합산 근거를 확인 중입니다.' : security?.state === 'unpublished' ? '아직 공개된 종목 지표가 없습니다.' : states[metricState] || '자료 확인 필요'}{security?.state === 'published' && securityRecord?.[`${metric}LastProvided`] != null && ` · 마지막 제공값 ${text(sourceValue(securityRecord[`${metric}LastProvided`]), info.unit)} (${String(securityRecord[`${metric}LastProvidedDate`] ?? '—')})`}</p>}
      {ranking?.exclusionReason && <p className="mt-2 text-xs text-muted-foreground">순위 제외 사유: {ranking.exclusionReason}</p>}
      <details className="mt-3 border-y border-border text-xs text-muted-foreground">
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
      <CompanyFinancialTabs security={security || undefined} company={company || undefined} className="mt-4" />
      <DetailMobileNavigation sections={sections} />
      {basic ? <><BasicInformation security={security} company={company} companyPage={companyPage} quote={quote} />{companySecs.length > 0 && <section className="detail-section border-t border-border py-8"><h2 className="mb-5 text-xl font-semibold">현재 연결된 종목</h2><InteractiveSecuritiesSection companyMarketcapData={company} companySecs={companySecs} currentTicker={security?.ticker || ''} currentSecurityId={security?.securityId} market={security?.exchange || ''} currentMetric="marketcap" highlightActiveTicker={!companyPage} /></section>}</> : <>
        <details id="security-overview" className="detail-section mt-6 border-t border-border py-6 sm:py-8"><summary className="cursor-pointer text-sm font-semibold">기본 정보</summary>
          <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">{[['종목명', name], ['구분', security?.type || '기업'], ['거래소', security?.exchange || '—'], ['티커', security?.ticker || '—']].map(([title,value]) => <div className="flex justify-between gap-4 border-b border-border py-3" key={title}><span className="text-muted-foreground">{title}</span><span>{value}</span></div>)}</div>
        </details>
        <section id="chart-analysis" className="detail-section space-y-5 border-t border-border py-6 sm:py-8">
          <header className="space-y-1"><h2 className="text-xl font-semibold">차트 분석</h2><p className="text-sm text-muted-foreground">{metric === 'marketcap' ? '시가총액 추이와 종목별 구성 현황' : `${name}의 ${info.label} 변동 패턴과 분포를 다양한 차트로 분석합니다`}</p></header>
          <details className="border-y border-border py-3"><summary className="cursor-pointer text-sm font-medium">기간 직접 지정</summary><form action={route} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs">시작일<input type="date" name="start" defaultValue={start} className="mt-1 block min-h-10 rounded-md border border-input bg-background px-3 text-sm" required /></label>
            <label className="text-xs">종료일<input type="date" name="end" defaultValue={end || asOf} className="mt-1 block min-h-10 rounded-md border border-input bg-background px-3 text-sm" required /></label>
            <button type="submit" className="min-h-10 rounded-md border border-border px-4 text-sm hover:bg-muted">기간 조회</button>{(start || end) && <Link href={route} className="inline-flex min-h-10 items-center px-3 text-sm underline underline-offset-4">전체 기간으로</Link>}
          </form></details>
          {invalid && <p role="alert" className="text-sm text-destructive">시작일과 종료일을 확인해 주세요. 시작일은 종료일 이전이어야 합니다.</p>}
          {!invalid && <div className={`grid gap-4 sm:gap-6 lg:auto-rows-max lg:items-stretch ${metric === 'marketcap' ? 'lg:grid-cols-2' : ''}`}>
            {metric === 'marketcap' ? <div className="min-w-0 border border-border bg-background p-3 sm:p-5 lg:col-span-2"><h3 className="mb-1 text-base font-semibold">{name} 등록된 시가총액 이력</h3><p className="mb-3 text-xs text-muted-foreground">{start || end ? '직접 지정한 기간의 실제 기록을 표시합니다.' : companyHistoryAvailable ? '최근 3개월 또는 전체 기간의 실제 기록을 표시합니다.' : '마지막 이력일부터 3개월 범위의 실제 기록을 표시합니다.'} 요약의 시총 스냅샷과 기준일이 다를 수 있습니다.</p>
              {companyHistoryAvailable ? <InteractiveChartSection companyMarketcapData={company} companySecs={companySecs} type="summary" selectedSecurityId={companyPage ? undefined : security?.securityId} selectedType={companyPage ? '시가총액 구성' : security?.type || '시가총액 구성'} start={start} end={end} /> : <DetailHistoryChart rows={selected.filter(row => start || end || row.date >= earlierDate(selected.at(-1)?.date || '', 3))} metric="marketcap" label="종목 시가총액" unit="원" />}
            </div> : <DetailFinancialAnalysis rows={selected} metric={metric} name={name} />}
            {metric === 'marketcap' && company && <CardCompanyMarketcap data={company} selectedSecurityId={companyPage ? undefined : security?.securityId} />}
            <div className={`min-w-0 border border-border bg-background p-3 sm:p-5 ${metric !== 'marketcap' ? '' : ''}`}><h3 className="text-base font-semibold">{companyPage ? '대표 종목 가격 이력' : start || end ? '기간별 가격 차트' : '최근 3개월 가격 차트'}</h3><p className="mt-1 mb-3 text-xs text-muted-foreground">{name} ({security?.ticker || '—'}) · 시가·고가·저가·종가·거래량</p><DetailPriceHistory rows={prices} start={start} end={end} /></div>
          </div>}
        </section>
        {companySecs.length > 0 && <section id="securities-summary" className="detail-section space-y-5 border-t border-border py-6 sm:py-8"><header className="space-y-1"><h2 className="text-xl font-semibold">종목 비교</h2><p className="text-sm text-muted-foreground">동일 기업 내 각 종목 간 비교 분석</p></header><InteractiveSecuritiesSection companyMarketcapData={company} companySecs={companySecs} currentTicker={security?.ticker || ''} currentSecurityId={security?.securityId} market={security?.exchange || ''} currentMetric={metric} highlightActiveTicker={!companyPage} /></section>}
        <section id="indicators" className="detail-section space-y-5 border-t border-border py-6 sm:py-8"><header className="space-y-1"><h2 className="text-xl font-semibold">핵심 지표</h2><p className="text-sm text-muted-foreground">{companyPage ? '등록 종목 합계' : info.label}의 기간별 분석</p><p className="text-xs leading-relaxed text-muted-foreground">평균은 이름에 표시된 기간을 분석하고, 최저·최고는 아래 분석 범위 전체를 기준으로 합니다. 직접 지정한 범위는 차트와 핵심 지표에 공통 적용됩니다.</p></header>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{indicatorCards.map(({title,value,observations},index) => <div key={title} className="min-w-0 space-y-2 border-b border-border py-4"><p className="text-xs text-muted-foreground">{title}</p><p className="text-lg font-semibold tabular-nums">{value == null ? '—' : `${formatCompactBusinessValue(value)}${info.unit}`}</p><p className="text-xs text-muted-foreground">{index === 0 ? `지표 기준 ${currentDate || '—'}` : `분석 기준 ${analysisEnd}`}</p>{observations && <p className="text-xs leading-relaxed tabular-nums text-muted-foreground">실제 관측 {observations.start || '—'} ~ {observations.end || '—'} · {observations.count}개</p>}{index === 0 && (snapshotComparisonReason ? <p className="text-xs leading-relaxed text-muted-foreground">{snapshotComparisonReason}</p> : snapshotChange != null ? <p className="text-xs text-muted-foreground">{priorObservation!.date} 이력 대비 {Number(snapshotChange) > 0 ? '+' : ''}{formatBusinessValue(snapshotChange)}%</p> : snapshotDifference != null && priorValueSign != null && priorValueSign <= 0 ? <p className="text-xs leading-relaxed text-muted-foreground">{priorObservation!.date} 이력 대비 차이 {text(snapshotDifference, info.unit)} · 이전 값이 {priorValueSign === 0 ? '0' : '음수'}라 증감률 계산 불가</p> : null)}</div>)}<div className="min-w-0 space-y-2 border-b border-border py-4"><DetailCurrentPrice price={{close:quote.close,rate:quote.rate,date:quote.date}} /></div></div>
          <p className="text-xs leading-relaxed text-muted-foreground">분석 범위 {summary.start || '—'} ~ {summary.end || '—'} · 실제 제공 {summary.count}개. 평균은 제공 관측의 산술평균이며 결측은 제외하고 실제 0·음수를 포함합니다.{companyPage && ' 회사 평균은 날짜별 등록 종목 부분 합계의 평균이며, 관측된 종목 구성이 다른 날짜도 포함될 수 있습니다.'}</p>
        </section>
        <section id="annual-data" className="detail-section space-y-5 border-t border-border py-6 sm:py-8"><header className="flex flex-wrap items-center justify-between gap-4"><div className="space-y-1"><h2 className="text-xl font-semibold">연도별 데이터</h2><p className="text-sm text-muted-foreground">{info.label} 차트와 {metric === 'bps' ? '실제 연말' : '연도별 마지막 관측'} 기준 상세 데이터를 확인합니다</p></div>{history.some(row => row.value != null) && <div className="space-y-1"><CsvDownloadButton data={rawCsv} filename={filename} label="전체 이력 CSV" /><p className="text-xs text-muted-foreground">선택 기간과 관계없이 전체 제공 이력</p></div>}</header>
          {!invalid && (metric === 'marketcap' && companyHistoryAvailable ? <InteractiveChartSection companyMarketcapData={company} companySecs={companySecs} type="detailed" selectedSecurityId={companyPage ? undefined : security?.securityId} selectedType={companyPage ? '시가총액 구성' : security?.type || '시가총액 구성'} start={start} end={end} /> : <DetailHistoryChart rows={selected} metric={metric} label={info.label} unit={info.unit} selectedEnd={analysisEnd} annual />)}
          <DetailAnnualHistory rows={detailAnnualRows(selected,metric)} label={companyPage ? '등록 종목 합계' : info.label} unit={info.unit} yearEndOnly={metric === 'bps'} />
        </section>
        <DetailPager rows={neighbors} rank={ranking?.currentRank ?? null} metric={metric} companyPage={companyPage} />
        <details className="mt-6 border-y border-border py-3 text-sm"><summary className="cursor-pointer font-medium">지표 설명 · 계산식</summary><div className="space-y-3 px-4 py-4 text-sm leading-relaxed text-muted-foreground"><p>{companyPage ? '기업 시가총액은 회사의 보통주·우선주 등 종목을 합산한 공개 결과입니다.' : info.formula}</p><p>현재 값·순위는 공개 결과를 표시합니다. 이력은 원천의 제공값을 분석하며 현재값과 기준일이 다를 수 있습니다.</p></div></details>
      </>}
    </div>
    <aside className="context-rail hidden xl:block"><div className="detail-rail-content space-y-6"><RecentSecuritiesSidebar currentSecCode={secCode} /><DetailMetricFacts rows={facts} note={`지표 기준 ${currentDate || '—'} · 순위 기준 ${ranking?.rankDate || '—'}`} /><section className="border-t border-border pt-5"><h3 className="mb-3 text-base font-semibold">이 페이지에서</h3><PageNavigation sections={sections} collapsible={false} /></section>{companySecs.length > 0 && <InteractiveSecuritiesSection companyMarketcapData={company} companySecs={companySecs} currentTicker={security?.ticker || ''} currentSecurityId={security?.securityId} market={security?.exchange || ''} currentMetric={metric} layout="sidebar" maxItems={4} />}</div></aside>
  </div>;
}

function BasicInformation({ security, company, companyPage, quote }: { security: SecuritySnapshot['security'] | null; company: CompanyMarketcapAggregated | null; companyPage: boolean; quote: { close: BusinessValue; rate: number | null; date?: string | null; open: BusinessValue; volume: BusinessValue } }) {
  const corporation = security?.company || company?.company;
  const facts = companyPage ? [['기업명', company?.companyKorName || company?.companyName || '—'], ['영문명', company?.companyName || '—'], ['업종', corporation?.industry || '—'], ['설립일', corporation?.establishedDate || '—']]
    : [['종목코드', security?.ticker || '—'], ['구분', security?.type || '—'], ['거래소', security?.exchange || '—'], ['영문명', security?.name || '—'], ['발행주식 수', text(security?.shares, '주')], ['발행주식 기준일', security?.sharesDate || '—']];
  return <><section id="basic-information" className="detail-section border-t border-border py-8"><h2 className="mb-5 text-xl font-semibold">{companyPage ? '기업' : '종목'} 기본 정보</h2><dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">{facts.map(([title,value]) => <div key={title} className="flex justify-between gap-4 border-b border-border py-3"><dt className="text-muted-foreground">{title}</dt><dd className="text-right font-medium tabular-nums">{value}</dd></div>)}</dl>{companyPage && <details className="mt-4 text-xs text-muted-foreground"><summary className="cursor-pointer">조회 기준</summary><p className="mt-2 break-all">기업 ID {company?.companyId || '—'}</p></details>}</section>
    <section id="price-information" className="detail-section border-t border-border py-8"><div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-xl font-semibold">주가 정보</h2><p className="text-xs text-muted-foreground">거래 기준 {quote.date || '—'}</p></div><dl className="grid grid-cols-2 gap-x-8 gap-y-5 text-sm sm:grid-cols-4">{[['현재가',text(quote.close,'원')],['가격 등락률',quote.rate == null ? '—' : `${quote.rate > 0 ? '+' : ''}${quote.rate.toFixed(2)}%`],['시가',text(quote.open,'원')],['거래량',text(quote.volume,'주')]].map(([title,value]) => <div key={title}><dt className="mb-2 text-muted-foreground">{title}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}</dl></section>
    {corporation && <section id="company-information" className="detail-section border-t border-border py-8"><h2 className="mb-5 text-xl font-semibold">기업 정보</h2><dl className="space-y-4 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted-foreground">기업명</dt><dd>{corporation.korName || corporation.name}</dd></div>{corporation.industry && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">업종</dt><dd>{corporation.industry}</dd></div>}{corporation.establishedDate && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">설립일</dt><dd>{corporation.establishedDate}</dd></div>}{corporation.homepage && <div className="flex flex-wrap justify-between gap-4"><dt className="text-muted-foreground">홈페이지</dt><dd className="min-w-0 break-all"><a href={corporation.homepage} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{corporation.homepage}</a></dd></div>}</dl></section>}</>;
}
function DetailPager({ rows, rank, metric, companyPage }: { rows: Record<string, unknown>[]; rank: number | null; metric: DetailMetric; companyPage: boolean }) {
  if (rank == null) return null;
  return <nav aria-label="순위 이전 다음" className="mt-8 flex flex-wrap justify-between gap-3">{rows.filter(row => Number(row.currentRank ?? row.marketcapRank) !== rank).map(row => {
    const previous = Number(row.currentRank ?? row.marketcapRank) < rank;
    const href = companyPage ? companyPath({ companyId: String(row.companyId), routeCode: typeof row.routeCode === 'string' ? row.routeCode : null }, 'marketcap') : securityPath({ securityId: String(row.securityId), exchange: String(row.exchange || ''), ticker: String(row.ticker || ''), routeCode: typeof row.routeCode === 'string' ? row.routeCode : null }, metric);
    return <Link key={href} href={href} className={`inline-flex min-h-14 flex-col justify-center rounded-md border border-border px-4 py-3 hover:bg-muted ${previous ? '' : 'ml-auto text-right'}`}><span className="text-xs text-muted-foreground">{previous ? '이전' : '다음'} {companyPage ? '기업' : '종목'}</span><span className="text-sm font-medium">{String(row.korName || row.name || '')}</span></Link>;
  })}</nav>;
}
