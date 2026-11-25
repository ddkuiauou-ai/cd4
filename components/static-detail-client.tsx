'use client';

import {filterListingRows,isolateListingValues,nameForListingPeriod,selectListingPeriod} from '@/lib/security-lifecycle';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { isBusinessDay } from '@/lib/business-analysis';
import { detailObservations, earlierDate, sourceValue } from '@/lib/detail-presentation';
import { loadStaticDetailData, loadStaticHistory, loadYearlyHistory, type StaticDataRow } from '@/lib/static-data';
import type { StaticDetailAssets } from '@/lib/static-detail-contract';
import { DetailSurface, type DetailSearch, type DetailSurfaceProps } from './detail-surface';
import { CompanyDetailClient } from './company-detail-client';
import { marketcapPeriodMonths, type DetailTrendPreview } from './detail-chart-observations';
import { useMarketcapChartRange } from './marketcap-chart-range';

const first = (value: DetailSearch[string]) => Array.isArray(value) ? value[0] : value;

function DetailSearchObserver({ onChange }: {onChange: (search: DetailSearch) => void}) {
  const search = useSearchParams();
  const start = search.get('start') ?? undefined;
  const end = search.get('end') ?? undefined;
  const period = search.get('period') ?? undefined;
  useEffect(() => { onChange({start, end,period}); }, [start, end,period, onChange]);
  return null;
}

/** Aggregate breakdowns also supply the sparse, one-observation comparison view. */
export function restoreStaticCompanyHistory(company: DetailSurfaceProps['company'], rows: StaticDataRow[]): DetailSurfaceProps['company'] {
  if (!company) return null;
  const history = rows as unknown as NonNullable<DetailSurfaceProps['company']>['aggregatedHistory'];
  return {...company, aggregatedHistory: history, registeredHistory: history,
    securities: company.securities.map(member => ({...member, marketcapHistory: history.flatMap(row => {
      const value = row.securitiesBreakdown[member.securityId];
      return value == null ? [] : [{date: row.date, marketcap: value, securityId: member.securityId}];
    })})),
  };
}

function useHistoryWindow(deferred: boolean, listingStart?: string, listingEnd?: string, start?: string, end?: string) {
  const earliest = listingStart && (!start || listingStart > start) ? listingStart : start;
  const latest = listingEnd && (!end || listingEnd < end) ? listingEnd : end;
  const from = deferred ? earliest : undefined;
  const through = deferred ? latest : undefined;
  return useMemo(() => deferred ? { start: from, end: through } : undefined, [deferred, from, through]);
}

export function StaticDetailClient({initial, assets, trendPreview}: {initial: DetailSurfaceProps; assets?: StaticDetailAssets; trendPreview?: DetailTrendPreview}) {
  const [search, setSearch] = useState(initial.search);
  const [loadedResult, setLoaded] = useState<{
    window: ReturnType<typeof useHistoryWindow>;
    data: Awaited<ReturnType<typeof loadStaticDetailData>>;
  } | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [requested, setRequested] = useState(false);
  const request = useCallback(() => setRequested(true), []);
  const yearPacked = Boolean(assets?.yearly);
  const deferred = yearPacked || Boolean(trendPreview && assets?.perHistory);
  const cap = !initial.basic && initial.metric === 'marketcap';
  const capRange = useMarketcapChartRange('capRange', first(initial.search.capRange)).period;
  const priceRange = useMarketcapChartRange('priceRange', first(initial.search.priceRange)).period;
  const periodId = initial.companyPage ? undefined : first(search.period);
  const periods = initial.security?.listingPeriods ?? [];
  const selectedPeriod = selectListingPeriod(periods, periodId);
  const invalidPeriod = Boolean(periodId && !selectedPeriod);
  const latestPeriod = selectListingPeriod(periods);
  const initialPeriod = initial.security?.selectedPeriod ?? latestPeriod;
  const samePeriod = initial.companyPage || selectedPeriod?.periodId === initialPeriod?.periodId;
  const start = first(search.start), end = first(search.end);
  const hasRange = Boolean((start || end) && (!start || isBusinessDay(start))
    && (!end || isBusinessDay(end)) && (!start || !end || start <= end));
  const historicalPeriod = Boolean(selectedPeriod && latestPeriod && selectedPeriod.periodId !== latestPeriod.periodId);
  const sameRange = first(search.start) === first(initial.search.start) && first(search.end) === first(initial.search.end);
  const needsHistory = !invalidPeriod && (!deferred || requested || hasRange || !samePeriod || cap && capRange === 'all');
  const listingStart = selectedPeriod?.listingDate ?? undefined;
  const listingEnd = selectedPeriod?.delistingDate ?? undefined;
  const rangeStart = hasRange ? start : undefined;
  const rangeEnd = hasRange ? end : undefined;
  const historyWindow = useHistoryWindow(deferred, initial.companyPage ? undefined : listingStart,
    initial.companyPage ? undefined : listingEnd, rangeStart, rangeEnd);
  const loaded = loadedResult?.window === historyWindow ? loadedResult?.data ?? null : null;
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  const requestQuotes = useCallback(() => setQuoteAttempt(current => Math.max(current, 1)), [setQuoteAttempt]);
  const quoteFiles = assets?.perHistory?.prices ?? assets?.yearly?.prices;
  const quoteMonths = cap ? marketcapPeriodMonths[priceRange] : 3;
  const newest = initial.prices.at(-1)?.date;
  const quoteEnd = rangeEnd ?? (!historicalPeriod ? assets?.historyCutoff : undefined);
  const fallbackEnd = !historicalPeriod && typeof newest === 'string' ? newest : undefined;
  const latestPriceDay = fallbackEnd ?? quoteFiles?.latestDate;
  const visibleStart = rangeStart ?? (!hasRange && latestPriceDay && quoteMonths ? earlierDate(latestPriceDay, quoteMonths) : undefined);
  const safeStart = (!historicalPeriod || rangeStart) && visibleStart && quoteFiles?.warmupThrough && visibleStart > quoteFiles.warmupThrough ? visibleStart : undefined;
  const quoteWindow = useHistoryWindow(deferred, listingStart, listingEnd, safeStart, quoteEnd);
  const readyPrices = yearPacked && cap && samePeriod && sameRange && priceRange === '3M';
  const needsQuotes = !invalidPeriod && !readyPrices && quoteAttempt > 0;
  const [quoteResult, setQuoteResult] = useState<{ window: typeof quoteWindow; rows?: StaticDataRow[]; failed?: boolean } | null>(null);
  const resolvedQuote = quoteResult?.window === quoteWindow ? quoteResult : null;
  useEffect(() => {
    if (!assets || !needsQuotes || !quoteFiles && !assets.prices) return;
    let active = true;
    const fetchQuotes = quoteFiles ? loadYearlyHistory(quoteFiles, quoteWindow) : loadStaticHistory(assets.prices, undefined, quoteWindow);
    fetchQuotes.then(rows => {
      if (active) setQuoteResult({ window: quoteWindow, rows });
    }).catch(() => { if (active) setQuoteResult({ window: quoteWindow, failed: true }); });
    return () => { active = false; };
  }, [assets, quoteFiles, needsQuotes, quoteAttempt, quoteWindow]);
  const onSearch = useCallback((value: DetailSearch) => setSearch(value), []);
  useEffect(() => {
    if (!assets || !needsHistory) return;
    let active = true;
    loadStaticDetailData(assets, initial.metric, initial.companyPage, !deferred, historyWindow, {
      includeDependency: !yearPacked || initial.metric === 'pbr',
      includeCompany: !historicalPeriod,
    }).then(data => {
      if (active) { setLoaded({ window: historyWindow, data }); setError(''); }
    }).catch(() => { if (active) setError('이력 자료를 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [assets, initial.metric, initial.companyPage, attempt, needsHistory, deferred, historyWindow, historicalPeriod, yearPacked]);

  const company = useMemo(() => loaded && initial.metric === 'marketcap'
    ? restoreStaticCompanyHistory(initial.company, loaded.companyHistory) : initial.company,
  [loaded, initial.metric, initial.company]);
  const history = useMemo(() => loaded ? initial.companyPage
    ? loaded.sourceHistory.map(row => ({...row, date: String(row.date), value: sourceValue(row.totalMarketcap)}))
    : detailObservations(loaded.sourceHistory, initial.metric) : initial.history,
  [loaded, initial.companyPage, initial.metric, initial.history]);
  const periodMetrics = assets?.listingMetricAvailability?.find(entry => entry.periodId === selectedPeriod?.periodId)?.metrics;
  const security=initial.security?{...isolateListingValues(initial.security,selectedPeriod,historicalPeriod),selectedPeriod,historicalPeriod,
    availableMetrics: periodMetrics ?? (historicalPeriod && selectedPeriod?.periodId !== initial.security.selectedPeriod?.periodId ? [] : initial.security.availableMetrics),
    korName:historicalPeriod?nameForListingPeriod(initial.security.korName,initial.security.lifecycleEvents ?? [],selectedPeriod):initial.security.korName,
    exchange:historicalPeriod?selectedPeriod?.displayExchange ?? initial.security.exchange:initial.security.exchange}:null;
  const cutoff = historicalPeriod ? undefined : assets?.historyCutoff ?? security?.publication?.asOf;
  const withinSelected=<Row extends {date?:unknown}>(rows:readonly Row[])=>filterListingRows(rows,selectedPeriod)
    .filter(row=>!cutoff || typeof row.date==='string'&&row.date<=cutoff);
  const priceRows = (deferred ? resolvedQuote?.rows : loaded?.prices) ?? initial.prices;
  const officialQuote = samePeriod && initial.prices.find(row => row.date === initial.security?.priceDate);
  const prices = officialQuote && !priceRows.some(row => row.date === officialQuote.date)
    ? [...priceRows, officialQuote].sort((left, right) => String(left.date).localeCompare(String(right.date))) : priceRows;
  const Surface = initial.companyPage ? CompanyDetailClient : DetailSurface;
  if(invalidPeriod) return <p role="alert" className="app-container py-8">선택한 상장 기간을 찾을 수 없습니다.</p>;
  return <>
    <Suspense fallback={null}><DetailSearchObserver onChange={onSearch} /></Suspense>
    <Surface {...initial} security={security} company={historicalPeriod?null:company}
      companySecs={historicalPeriod?[]:initial.companySecs} ranking={historicalPeriod?null:initial.ranking} neighbors={historicalPeriod?[]:initial.neighbors}
      history={initial.companyPage?history:withinSelected(history)}
      prices={withinSelected(prices)}
      sourceHistory={initial.companyPage?loaded?.sourceHistory ?? initial.sourceHistory:withinSelected(loaded?.sourceHistory ?? initial.sourceHistory)} search={search}
      initialAnalysis={samePeriod && sameRange ? initial.initialAnalysis : undefined}
      initialSnapshotAnalysis={samePeriod ? initial.initialAnalysis : undefined}
      deferredHistory={deferred && assets ? {
        preview: samePeriod && sameRange ? trendPreview : undefined, request,
        staticMarketcapReady: yearPacked && cap && samePeriod && sameRange && capRange !== 'all',
        pricesPending: !readyPrices && Boolean(quoteFiles || assets.prices) && !resolvedQuote?.rows,
        pricesFailed: Boolean(resolvedQuote?.failed), requestPrices: requestQuotes,
        retryPrices: () => { setQuoteResult(null); setQuoteAttempt(value => value + 1); },
        loadCsvRows: async () => {
          const { sourceHistory } = await loadStaticDetailData(assets, initial.metric, initial.companyPage, false,
            { start: initial.companyPage ? undefined : listingStart, end: initial.companyPage ? undefined : listingEnd },
            { includeCompany: false });
          return initial.companyPage ? sourceHistory : withinSelected(sourceHistory);
        },
        loadPriceCsvRows: async () => {
          const window = { start: listingStart, end: listingEnd };
          return withinSelected(assets.perHistory
            ? await loadYearlyHistory(assets.perHistory.prices, window) : await loadStaticHistory(assets.prices, assets.yearly?.prices, window));
        },
      } : undefined}
      historyPending={Boolean(assets && !loaded && (!yearPacked || needsHistory || initial.initialAnalysis?.hasHistory))} historyError={error}
      onRetry={() => {setError(''); setAttempt(value => value + 1);}} />
  </>;
}
