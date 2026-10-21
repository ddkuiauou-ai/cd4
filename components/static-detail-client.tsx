'use client';

import {filterListingRows,isolateListingValues,nameForListingPeriod,selectListingPeriod} from '@/lib/security-lifecycle';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { detailObservations, sourceValue } from '@/lib/detail-presentation';
import { loadStaticDetailData, type StaticDataRow } from '@/lib/static-data';
import type { StaticDetailAssets } from '@/lib/static-detail-contract';
import { DetailSurface, type DetailSearch, type DetailSurfaceProps } from './detail-surface';

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

export function StaticDetailClient({initial, assets}: {initial: DetailSurfaceProps; assets?: StaticDetailAssets}) {
  const [search, setSearch] = useState(initial.search);
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadStaticDetailData>> | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const onSearch = useCallback((value: DetailSearch) => setSearch(value), []);
  useEffect(() => {
    if (!assets) return;
    let active = true;
    loadStaticDetailData(assets, initial.metric, initial.companyPage).then(data => {
      if (active) { setLoaded(data); setError(''); }
    }).catch(() => { if (active) setError('이력 자료를 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [assets, initial.metric, initial.companyPage, attempt]);

  const company = useMemo(() => loaded && initial.metric === 'marketcap'
    ? restoreStaticCompanyHistory(initial.company, loaded.companyHistory) : initial.company,
  [loaded, initial.metric, initial.company]);
  const history = useMemo(() => loaded ? initial.companyPage
    ? loaded.sourceHistory.map(row => ({...row, date: String(row.date), value: sourceValue(row.totalMarketcap)}))
    : detailObservations(loaded.sourceHistory, initial.metric) : initial.history,
  [loaded, initial.companyPage, initial.metric, initial.history]);
  const periodId=Array.isArray(search.period)?search.period[0]:search.period;
  const selectedPeriod=selectListingPeriod(initial.security?.listingPeriods ?? [],periodId);
  const invalidPeriod=Boolean(periodId&&!selectedPeriod);
  const latestPeriod=selectListingPeriod(initial.security?.listingPeriods ?? []);
  const historicalPeriod=Boolean(selectedPeriod&&latestPeriod&&selectedPeriod.periodId!==latestPeriod.periodId);
  const security=initial.security?{...isolateListingValues(initial.security,selectedPeriod,historicalPeriod),selectedPeriod,historicalPeriod,
    korName:historicalPeriod?nameForListingPeriod(initial.security.korName,initial.security.lifecycleEvents ?? [],selectedPeriod):initial.security.korName,
    exchange:historicalPeriod?selectedPeriod?.displayExchange ?? initial.security.exchange:initial.security.exchange}:null;
  const withinSelected=<Row extends {date?:unknown}>(rows:readonly Row[])=>filterListingRows(rows,selectedPeriod)
    .filter(row=>!security?.publication?.asOf || typeof row.date==='string'&&row.date<=security.publication.asOf);
  const filtered = Boolean(search.start || search.end || periodId);
  if(invalidPeriod) return <p role="alert" className="app-container py-8">선택한 상장 기간을 찾을 수 없습니다.</p>;
  return <>
    <Suspense fallback={null}><DetailSearchObserver onChange={onSearch} /></Suspense>
    <DetailSurface {...initial} security={security} company={historicalPeriod?null:company}
      companySecs={historicalPeriod?[]:initial.companySecs} ranking={historicalPeriod?null:initial.ranking} neighbors={historicalPeriod?[]:initial.neighbors}
      history={initial.companyPage?history:withinSelected(history)}
      prices={initial.companyPage?loaded?.prices ?? initial.prices:withinSelected(loaded?.prices ?? initial.prices)}
      sourceHistory={initial.companyPage?loaded?.sourceHistory ?? initial.sourceHistory:withinSelected(loaded?.sourceHistory ?? initial.sourceHistory)} search={search}
      initialAnalysis={!filtered ? initial.initialAnalysis : undefined}
      historyPending={Boolean(assets && !loaded)} historyError={error}
      onRetry={() => {setError(''); setAttempt(value => value + 1);}} />
  </>;
}
