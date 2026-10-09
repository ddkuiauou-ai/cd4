"use client";
import { useMemo, useState } from 'react';
import type { DetailCompanyData, DetailSecurityRow } from './detail-types';
import ChartCompanyMarketcap from './chart-company-marketcap';
import ChartMarketcap from './chart-marketcap';
import { DetailCompanyHistoryObservation } from './detail-company-history-observation';
import { createMarketcapSeries } from '@/lib/chart-selection';
import { earlierDate } from '@/lib/detail-presentation';
import { projectBusinessChartRows, businessChartAxisValue, formatCompactBusinessValue, type BusinessValue } from '@/lib/business-analysis';

export function InteractiveChartSection({ companyMarketcapData, type, selectedSecurityId, selectedType = '시가총액 구성', start, end }: {
  companyMarketcapData: DetailCompanyData; companySecs: DetailSecurityRow[]; type: 'summary' | 'detailed';
  selectedSecurityId?: string; selectedType?: string; selectedTicker?: string; onTickerChange?: (value: string) => void; start?: string; end?: string;
}) {
  const [period, setPeriod] = useState<'recent' | 'all'>('recent');
  const customRange = Boolean(start || end);
  const recent = type === 'summary' && !customRange && period === 'recent';
  const series = useMemo(() => createMarketcapSeries(companyMarketcapData?.securities ?? []), [companyMarketcapData]);
  const all = [...(companyMarketcapData?.aggregatedHistory ?? [])].sort((a,b) => String(a.date).localeCompare(String(b.date)));
  const last = end || String(all.at(-1)?.date ?? '').slice(0,10);
  const cutoff = start || (recent ? earlierDate(last,3) : '');
  const history = all.filter(row => (!cutoff || String(row.date) >= cutoff) && (!end || String(row.date) <= end));
  const sourceValues: Record<string, Record<string, BusinessValue>> = {};
  const coverage: Record<string, { observedCount: number; targetCount: number }> = {};
  const domainRows = history.flatMap(row => [row.totalMarketcap, ...series.map(item => row.securitiesBreakdown[item.securityId] ?? null)].map(value => ({date: String(row.date),value})));
  const domain = projectBusinessChartRows(domainRows);
  const projected = new Map(['value',...series.map(item => item.key)].map(key => [key, projectBusinessChartRows(history.map(row => ({date: String(row.date), value: key === 'value' ? row.totalMarketcap : row.securitiesBreakdown[series.find(item => item.key === key)!.securityId] ?? null})),domainRows).rows]));
  const points = history.map((row,index) => {
    const date = String(row.date).slice(0,10);
    const raw: Record<string, BusinessValue> = { value: row.totalMarketcap, 총합계: row.totalMarketcap };
    const point: Record<string, string | number | null> & { date: string } = { date, value: projected.get('value')![index].plot, 총합계: projected.get('value')![index].plot };
    for (const item of series) { raw[item.key] = row.securitiesBreakdown[item.securityId] ?? null; point[item.key] = projected.get(item.key)![index].plot; }
    sourceValues[date] = raw;
    if ('observedCount' in row) coverage[date] = { observedCount: row.observedCount, targetCount: row.targetCount };
    return point;
  });
  if (!history.length) return <p className="border-y border-border py-8 text-sm text-muted-foreground">등록된 시가총액 데이터가 없습니다.</p>;
  const range = `${String(history[0].date).slice(0,10)} ~ ${String(history.at(-1)!.date).slice(0,10)}`;
  const Chart = type === 'summary' ? ChartCompanyMarketcap : ChartMarketcap;
  return <div className="min-w-0 space-y-3">
    {type === 'summary' && !customRange && <div className="flex flex-wrap items-center gap-2" role="group" aria-label="시가총액 차트 범위">
      <span className="text-xs text-muted-foreground">차트 표시 범위</span>
      {([['recent','최근 3개월'],['all','전체']] as const).map(([key,label]) => <button key={key} type="button" aria-pressed={period === key} onClick={()=>setPeriod(key)}
        className={`min-h-10 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${period === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:bg-accent'}`}>{label}</button>)}
    </div>}
    {type === 'summary' && <p className="text-xs leading-relaxed text-muted-foreground">최근 3개월/전체는 이 차트의 표시 범위입니다. 핵심 지표는 이름에 표시된 기간을 분석하며, 직접 지정한 범위는 차트와 핵심 지표에 공통 적용됩니다.</p>}
    {customRange && <p className="text-xs text-muted-foreground">직접 지정한 기간을 표시합니다.</p>}
    {history.length === 1 && companyMarketcapData && <DetailCompanyHistoryObservation data={companyMarketcapData} observation={history[0]} count={1} selectedSecurityId={selectedSecurityId} />}
    <p className="text-xs text-muted-foreground tabular-nums">{recent || customRange ? '이력 범위' : '전체 이력 범위'} {range} · 기록 {history.length}개{recent ? ' · 마지막 이력일 기준 3개월 범위' : ''}</p>
    <p className="text-xs text-muted-foreground">현재 분석 대상 {series.length}개 종목의 날짜별 제공값 합계입니다. 미등록 종목 값은 포함되지 않습니다.</p>
    <p className="sr-only">날짜별로 등록된 종목 값의 합계이며, 미등록 종목 값은 포함되지 않습니다.</p>
    {domain.min != null && <Chart data={points} format="formatNumber" formatTooltip="formatNumberTooltip" series={series} selectedSecurityId={selectedSecurityId} selectedType={selectedType} sourceValues={sourceValues} coverage={coverage} totalLabel="등록 종목 합계" axisFormat={value => formatCompactBusinessValue(businessChartAxisValue(domain.min, domain.max, value))} />}
  </div>;
}
