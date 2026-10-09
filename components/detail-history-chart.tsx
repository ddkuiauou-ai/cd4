"use client";

import { useMemo, useState, useSyncExternalStore } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { businessChangePercent, businessChartAxisValue, compareBusinessValues, projectBusinessChartRows, formatBusinessValue, formatCompactBusinessValue, subtractBusinessValues, summarizeBusinessWindow } from '@/lib/business-analysis';
import { aggregateDetailRows, detailAnnualRows, earlierDate, selectDetailRange, type DetailMetric, type DetailObservation } from '@/lib/detail-presentation';

const subscribe = () => () => {};

export function DetailHistoryChart({ rows, label, unit, metric, selectedStart, selectedEnd, annual = false, movingAverages }: {
  rows: DetailObservation[]; label: string; unit: string; metric?: DetailMetric; selectedStart?: string; selectedEnd?: string; annual?: boolean; movingAverages?: Array<{date:string;average5: string|null;average10:string|null}>;
}) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [period, setPeriod] = useState(annual && metric === 'bps' ? '1Y' : metric === 'dps' ? '12M' : metric === 'marketcap' ? 'all' : 'month');
  const end = selectedEnd || rows.at(-1)?.date || '';
  const source = useMemo(() => {
    const selected = selectDetailRange(rows, selectedStart, selectedEnd);
    if (metric === 'bps' && annual) {
      const years = detailAnnualRows(selected,'bps').reverse();
      const last = Number(years.at(-1)?.date.slice(0, 4));
      const count = Number.parseInt(period) || 1;
      return selected.filter(row => Number(row.date.slice(0, 4)) >= last - count + 1 && Number(row.date.slice(0,4)) <= last);
    }
    if (metric === 'dps') {
      const months = period === '12M' ? 12 : (Number.parseInt(period) || 1) * 12;
      return selectDetailRange(selected, earlierDate(end, months), end);
    }
    return selected;
  }, [rows, metric, annual, period, end, selectedStart, selectedEnd]);
  const summary = summarizeBusinessWindow(source);
  const chartRows = metric === 'bps' && annual ? detailAnnualRows(source,'bps').reverse() : period === 'month' || period === 'year' ? aggregateDetailRows(source, period) : source;
  const barMetric = metric === 'bps' || metric === 'dps';
  const chartSummary = summarizeBusinessWindow(chartRows);
  const domainRows = [...chartRows, ...(barMetric ? [{date:chartRows[0]?.date || '2000-01-01',value:0}] : []), ...(movingAverages ?? []).flatMap(row => [{date:row.date,value:row.average5},{date:row.date,value:row.average10}])];
  const projection = projectBusinessChartRows(chartRows,domainRows);
  const zeroPlot = projectBusinessChartRows([{date:chartRows[0]?.date || '2000-01-01',value:0}],domainRows).rows[0].plot ?? 0;
  const average5 = projectBusinessChartRows((movingAverages ?? []).map(row => ({date:row.date,value:row.average5})),domainRows);
  const average10 = projectBusinessChartRows((movingAverages ?? []).map(row => ({date:row.date,value:row.average10})),domainRows);
  const changes = new Map<string,{change:string|null;difference:string|null;reason:string|null}>();
  let prior: DetailObservation | undefined;
  for (const row of rows) if (row.value != null) {
    const sameCoverage = !row.observedSecurityIds && !prior?.observedSecurityIds
      || Boolean(prior && JSON.stringify([...(row.observedSecurityIds ?? [])].sort()) === JSON.stringify([...(prior.observedSecurityIds ?? [])].sort()));
    const priorValueSign = prior ? compareBusinessValues(prior.value,'0') : null;
    const change = prior && sameCoverage ? businessChangePercent(prior.value,row.value) : null;
    const difference = prior && sameCoverage && priorValueSign != null && priorValueSign <= 0 ? subtractBusinessValues(row.value,prior.value) : null;
    const reason = !prior ? '직전 제공 기록이 없습니다.' : !sameCoverage ? '관측 종목 구성이 달라 직전 이력과의 비교를 표시하지 않습니다.'
      : priorValueSign != null && priorValueSign <= 0 ? `이전 값이 ${priorValueSign === 0 ? '0' : '음수'}라 증감률 계산 불가` : null;
    changes.set(row.date,{change,difference,reason});prior=row;
  }
  const data = projection.rows.map(row => ({...row,
    barRange: row.plot == null ? null : [zeroPlot,row.plot],
    average5: average5.rows.find(average => average.date === row.date)?.plot ?? null,
    average10: average10.rows.find(average => average.date === row.date)?.plot ?? null,
    average5Source: movingAverages?.find(average => average.date === row.date)?.average5 ?? null,
    average10Source: movingAverages?.find(average => average.date === row.date)?.average10 ?? null,
    changeSource: changes.get(row.date)?.change ?? null,
    differenceSource: changes.get(row.date)?.difference ?? null,
    comparisonReason: changes.get(row.date)?.reason ?? null,
    change: changes.get(row.date)?.change == null ? null : Number(changes.get(row.date)!.change),
  }));
  const periods = metric === 'bps' && annual ? [['1Y', '최근 연말'], ['5Y', '5년'], ['10Y', '10년'], ['20Y', '20년']]
    : metric === 'dps' ? [['12M', '12개월'], ['3Y', '3년'], ['5Y', '5년'], ['10Y', '10년'], ['20Y', '20년']]
    : metric === 'marketcap' ? [] : [['month', '월간'], ['year', '연간']];
  return <div className="space-y-4">
    {movingAverages && <p className="text-xs text-muted-foreground">종가 · 5관측 이동평균 · 10관측 이동평균</p>}
    {metric === 'dps' && <p className="text-xs text-muted-foreground">주당배당금(DPS) · 직전 제공 기록 대비 변화율</p>}
    {periods.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/30 p-4">
      <span className="mr-1 text-sm text-muted-foreground">{metric === 'bps' || metric === 'dps' ? '기간 선택:' : '집계 단위:'}</span>
      {periods.map(([key, title]) => <button type="button" key={key} aria-pressed={period === key} onClick={() => setPeriod(key)}
        className={`min-h-10 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${period === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:bg-accent'}`}>{title}</button>)}
    </div>}
    <p className="text-xs text-muted-foreground tabular-nums">{summary.count ? `선택 원천 관측 ${summary.start} ~ ${summary.end} · ${summary.count}개 기록` : '선택 기간에 제공된 관측값이 없습니다.'}{metric === 'bps' && annual ? ` · 표시 연말 관측 ${chartSummary.count}개 (각 연도의 마지막 12월 값)` : period === 'month' || period === 'year' ? ' · 제공 관측의 산술평균' : ''}</p>
    {chartSummary.count === 1 && <div className="border-y border-border py-4 text-sm"><p>추이를 그릴 이력이 부족합니다. 등록된 날짜의 값을 점으로 표시합니다.</p><p className="mt-2 font-semibold tabular-nums">{data.find(row => row.value != null)?.date} · {formatBusinessValue(data.find(row => row.value != null)?.value ?? null)}{unit}</p></div>}
    {!mounted ? <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">차트 로딩 중…</div>
      : !chartSummary.count ? <p className="border-y border-border py-8 text-sm" role="status">이 기간의 {label} 이력이 없습니다.</p>
      : <div className="h-[280px] min-w-0 w-full sm:h-[320px]" role="img" aria-label={`${label} 차트 ${chartSummary.start}부터 ${chartSummary.end}, 표시 관측 ${chartSummary.count}개. 최소 ${formatBusinessValue(chartSummary.min)}, 최대 ${formatBusinessValue(chartSummary.max)}${unit}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 12 }} accessibilityLayer>
            <CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="date" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={date => String(date).slice(0, 7)} minTickGap={30} />
            <YAxis width={60} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={value => formatCompactBusinessValue(businessChartAxisValue(projection.min, projection.max, Number(value)))} domain={[0, 1]} ticks={[0, .25, .5, .75, 1]} />
            <Tooltip content={({ active, payload }) => {
              const row = payload?.[0]?.payload as (DetailObservation & {average5Source?: string|null;average10Source?:string|null;changeSource?:string|null;differenceSource?:string|null;comparisonReason?:string|null}) | undefined;
              return active && row ? <div className="rounded-lg border border-border bg-popover p-3 text-sm shadow-lg"><p className="mb-2 text-xs text-muted-foreground">{row.date}</p><p>{label} <strong className="tabular-nums">{formatBusinessValue(row.value)}{unit}</strong></p>{movingAverages && <><p>5관측 이동평균 {formatBusinessValue(row.average5Source ?? null)}{unit}</p><p>10관측 이동평균 {formatBusinessValue(row.average10Source ?? null)}{unit}</p></>}{metric === 'dps' && <>{row.changeSource != null ? <p>직전 제공 기록 대비 {formatBusinessValue(row.changeSource)}%</p> : row.differenceSource != null ? <p>직전 제공 기록 대비 차이 {formatBusinessValue(row.differenceSource)}{unit}</p> : null}{row.comparisonReason && <p className="mt-1 text-xs text-muted-foreground">{row.comparisonReason}</p>}</>}{row.providedCount != null && <p className="mt-1 text-xs text-muted-foreground">평균에 포함된 제공 관측 {row.providedCount}개</p>}{row.targetCount != null && <p className="mt-1 text-xs text-muted-foreground">{row.observedCount ?? 0}/{row.targetCount}개 관측{row.partial ? ' · 부분 관측' : ''}</p>}</div> : null;
            }} />
            {metric === 'dps' && <YAxis yAxisId="growth" orientation="right" tick={{fill:'var(--muted-foreground)',fontSize:11}} tickFormatter={value => `${value}%`} />}
            {chartSummary.count === 1 ? <Line type="linear" dataKey="plot" stroke="var(--chart-2)" dot={{r:4}} isAnimationActive={false}/> : metric === 'bps' || metric === 'dps' ? <Bar dataKey="barRange" fill="var(--chart-2)" name={label} isAnimationActive={false} />
              : metric === 'per' ? <Area type="linear" dataKey="plot" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.12} connectNulls={false} isAnimationActive={false} />
                : <Line type="linear" dataKey="plot" stroke="var(--chart-2)" strokeWidth={2} dot={data.length < 25} connectNulls={false} isAnimationActive={false} />}
            {movingAverages && <><Line type="linear" dataKey="average5" name="5관측 이동평균" stroke="var(--brand-ink)" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false}/><Line type="linear" dataKey="average10" name="10관측 이동평균" stroke="var(--muted-foreground)" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false}/></>}
            {metric === 'dps' && <Line yAxisId="growth" type="linear" dataKey="change" stroke="var(--chart-3)" name="직전 제공 기록 대비 (%)" dot={false} connectNulls={false} isAnimationActive={false}/>}
          </ComposedChart>
        </ResponsiveContainer>
      </div>}
  </div>;
}
