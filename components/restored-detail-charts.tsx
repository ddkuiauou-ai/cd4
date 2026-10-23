'use client';

import dynamic from 'next/dynamic';
import { useState, useSyncExternalStore } from 'react';
import { DetailAnnualTable } from './detail-annual-table';
import { DetailHistoryChart } from './detail-history-chart';
import { DETAIL_METRICS, actualCandlesticks, priceMovingAverages, earlierDate, monthlyHeatmap, type DetailMetric, type DetailObservation } from '@/lib/detail-presentation';
import { businessChartAxisValue, projectBusinessChartRows, formatBusinessValue, formatCompactBusinessValue, summarizeBusinessWindow } from '@/lib/business-analysis';

const placeholder = () => <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">차트 로딩 중…</div>;
const Candles = dynamic(() => import('./chart-candlestick').then(module => module.CandlestickChart), { ssr: false, loading: placeholder });
const PERHeatmap = dynamic(() => import('./chart-per-heatmap'), { ssr: false, loading: placeholder });
const BPSHeatmap = dynamic(() => import('./chart-bps-heatmap'), { ssr: false, loading: placeholder });
const DPSHeatmap = dynamic(() => import('./chart-dps-heatmap'), { ssr: false, loading: placeholder });
const PERDistribution = dynamic(() => import('./chart-per-distribution'), { ssr: false, loading: placeholder });
const BPSDistribution = dynamic(() => import('./chart-bps-distribution'), { ssr: false, loading: placeholder });
const DPSDistribution = dynamic(() => import('./chart-dps-distribution'), { ssr: false, loading: placeholder });
const subscribe = () => () => {};

export function DetailFinancialAnalysis({ rows, metric, name }: { rows: DetailObservation[]; metric: DetailMetric; name: string }) {
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [distributionOpen, setDistributionOpen] = useState(false);
  const info = DETAIL_METRICS[metric];
  const summary = summarizeBusinessWindow(rows);
  const distributionProjection = projectBusinessChartRows(rows.filter(row => row.value != null));
  const distribution = distributionProjection.rows.filter(row => row.plot != null).map(row => ({date:row.date,value:row.plot!}));
  const distributionFormat = (value:number) => formatCompactBusinessValue(businessChartAxisValue(distributionProjection.min,distributionProjection.max,value));
  const distributionDetailFormat = (value:number) => formatBusinessValue(businessChartAxisValue(distributionProjection.min,distributionProjection.max,value));
  const monthlySources = new Map<string,DetailObservation>();
  for (const row of rows) if (row.value != null) monthlySources.set(row.date.slice(0,7),row);
  const monthly = [...monthlySources.values()];
  const heatmapProjection = projectBusinessChartRows(monthly);
  const heatmap = monthlyHeatmap(heatmapProjection.rows.map(row => ({date:row.date,value:row.plot})));
  const heatmapSourceValues = Object.fromEntries(monthly.map(row => [`${Number(row.date.slice(5,7))}월/${row.date.slice(0,4)}`,row.value]));
  const heatmapFormat = (value:number) => formatCompactBusinessValue(businessChartAxisValue(heatmapProjection.min,heatmapProjection.max,value));
  const hasAnalysis = ['per', 'bps', 'dps'].includes(metric);
  const Heatmap = metric === 'bps' ? BPSHeatmap : metric === 'dps' ? DPSHeatmap : PERHeatmap;
  const Distribution = metric === 'bps' ? BPSDistribution : metric === 'dps' ? DPSDistribution : PERDistribution;
  return hasAnalysis ? <div className="detail-financial-analysis-grid">
    <details className="detail-record-disclosure" onToggle={event => setMonthlyOpen(event.currentTarget.open)}>
      <summary><h3>월별 {info.label} 기록</h3></summary>
      {monthlyOpen && <div className="detail-disclosure-content space-y-3">
      <p className="text-sm text-muted-foreground">{name}의 연도·월별 마지막 제공값입니다.</p>
      {heatmap.length ? <Heatmap data={heatmap} minValue={0} maxValue={1} sourceValues={heatmapSourceValues} valueFormatter={heatmapFormat} /> : <p className="py-8 text-sm text-muted-foreground">등록된 {info.label} 데이터가 없습니다.</p>}
      <p className="text-sm text-muted-foreground">빈 칸은 원천 미제공이며 실제 0·음수도 표시합니다.</p>
      </div>}
    </details>
    <details className="detail-record-disclosure" onToggle={event => setDistributionOpen(event.currentTarget.open)}>
      <summary><h3>{info.label} 관측값 분포</h3></summary>
      {distributionOpen && <div className="detail-disclosure-content space-y-3">
      <p className="text-sm text-muted-foreground">조회 기간의 제공 관측을 히스토그램과 밀도 곡선으로 표시합니다.</p>
      <Distribution data={distribution} formatCoordinate={distributionFormat} formatDetailCoordinate={distributionDetailFormat} sourceSummary={`평균 ${formatBusinessValue(summary.mean)}${info.unit} · 실제 제공 ${summary.count}개`} />
      </div>}
    </details>
  </div> : null;
}

export function DetailPriceHistory({ rows, start, end }: { rows: Record<string, unknown>[]; start?: string; end?: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const latest = end || String(rows.at(-1)?.date || '');
  const visibleStart = start || (end ? '' : earlierDate(latest, 3));
  const candles = actualCandlesticks(rows, visibleStart, latest);
  const visible = candles.filter(row => !row.warmupOnly);
  const closeRows = priceMovingAverages(rows,visibleStart,latest);
  if (visible.length < 2 || closeRows.filter(row => row.value != null).length > visible.length) return <div className="space-y-3"><p className="text-xs text-muted-foreground">실제 시가·고가·저가·종가가 충분하지 않아 제공된 종가를 표시합니다.</p><DetailHistoryChart rows={closeRows} movingAverages={closeRows} label="종가" unit="원" metric="marketcap" /></div>;
  return <div className="space-y-3"><p className="text-xs text-muted-foreground tabular-nums">실제 거래 범위 {visible[0].time} ~ {visible.at(-1)!.time} · {visible.length}개 기록 · 5관측·10관측 이동평균</p>{mounted ? <Candles data={candles} movingAverageValues={closeRows.map(row=>({time:row.date,average5:row.average5,average10:row.average10}))} /> : placeholder()}<p className="text-xs text-muted-foreground">실제 OHLC만 사용합니다. 이동평균은 해당 기간의 제공 관측이 모두 있을 때 표시합니다.</p></div>;
}

export function DetailAnnualHistory({ rows, label, unit, yearEndOnly = false }: { rows: Array<DetailObservation & { changeRate?: number }>; label: string; unit: string; yearEndOnly?: boolean }) {
  return <DetailAnnualTable rows={rows} label={label} yearEndOnly={yearEndOnly} formatValue={value => value == null ? '—' : `${formatCompactBusinessValue(value)}${unit}`} formatDetailValue={value => value == null ? '—' : `${formatBusinessValue(value)}${unit}`} />;
}
