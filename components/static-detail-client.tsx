'use client';

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
  useEffect(() => { onChange({start, end}); }, [start, end, onChange]);
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
  const filtered = Boolean(search.start || search.end);
  return <>
    <Suspense fallback={null}><DetailSearchObserver onChange={onSearch} /></Suspense>
    <DetailSurface {...initial} company={company} history={history} prices={loaded?.prices ?? initial.prices}
      sourceHistory={loaded?.sourceHistory ?? initial.sourceHistory} search={search}
      initialAnalysis={!filtered ? initial.initialAnalysis : undefined}
      historyPending={Boolean(assets && !loaded)} historyError={error}
      onRetry={() => {setError(''); setAttempt(value => value + 1);}} />
  </>;
}
