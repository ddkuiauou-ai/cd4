'use client';

import dynamic from 'next/dynamic';
import { lazy } from 'react';
import { DetailAnnualTable } from './detail-annual-table';
import { DetailHistoryChart } from './detail-history-chart';
import { ChartWhenVisible } from './detail-chart-visibility';
import { chartMonths, lastMonthlyObservations } from './detail-chart-observations';
import type { DividendComparisonSeries } from './detail-trend-plot';
import type { DetailSecurityRow } from './detail-types';
import { DETAIL_METRICS, actualCandlesticks, priceMovingAverages, earlierDate, monthlyHeatmap, selectDetailRange, type DetailAnnualRow, type DetailMetric, type DetailObservation } from '@/lib/detail-presentation';
import { businessChartAxisValue, compareBusinessValues, projectBusinessChartRows, formatBusinessValue, formatCompactBusinessValue, isBusinessDay, summarizeBusinessWindow, type BusinessValue } from '@/lib/business-analysis';

export { ChartWhenVisible } from './detail-chart-visibility';

function PriceChartPlaceholder() {
  return <div className="flex h-[320px] items-center justify-center border-y border-border text-sm text-muted-foreground sm:h-[340px] md:h-[380px] lg:h-[420px]">차트 준비 중…</div>;
}
const Candles = dynamic(() => import('./chart-candlestick').then(module => module.CandlestickChart), { ssr: false, loading: PriceChartPlaceholder });
const PERHeatmap = lazy(() => import('./chart-per-heatmap'));
const BPSHeatmap = lazy(() => import('./chart-bps-heatmap'));
const DPSHeatmap = lazy(() => import('./chart-dps-heatmap'));
const PERDistribution = lazy(() => import('./chart-per-distribution'));
const BPSDistribution = lazy(() => import('./chart-bps-distribution'));
const DPSDistribution = lazy(() => import('./chart-dps-distribution'));
const DividendComparisonPlot = lazy(() => import('./detail-trend-plot').then(module => ({ default: module.DividendComparisonPlot })));

type AnalysisKind = 'monthly' | 'distribution';
type AnalysisMetric = 'per' | 'bps' | 'dps';

export function DetailFinancialAnalysis({ rows, metric, name, kind, currentValue = null }: {
  rows: DetailObservation[]; metric: DetailMetric; name: string; kind?: AnalysisKind; currentValue?: BusinessValue;
}) {
  if (metric !== 'per' && metric !== 'bps' && metric !== 'dps') return null;
  if (kind === 'monthly') return <MonthlyRecord rows={rows} metric={metric} name={name} />;
  if (kind === 'distribution') return <DistributionRecord rows={rows} metric={metric} currentValue={currentValue} />;

  const label = DETAIL_METRICS[metric].label;
  return <div className="space-y-6">
    <div className="space-y-3">
      <h3>월별 {label} 기록</h3>
      <MonthlyRecord rows={rows} metric={metric} name={name} />
    </div>
    <div className="space-y-3">
      <h3>{label} 관측값 분포</h3>
      <DistributionRecord rows={rows} metric={metric} currentValue={currentValue} />
    </div>
  </div>;
}

function MonthlyRecord({ rows, metric, name }: { rows: DetailObservation[]; metric: AnalysisMetric; name: string }) {
  const info = DETAIL_METRICS[metric];
  const monthly = [...lastMonthlyObservations(rows).values()].filter(row => row.value != null).sort((a, b) => a.date.localeCompare(b.date));
  if (!monthly.length) return <p className="border-y border-border py-8 text-sm text-muted-foreground" role="status">표시할 {name}의 월별 {info.label} 기록이 없습니다.</p>;

  const projection = projectBusinessChartRows(monthly);
  const heatmap = monthlyHeatmap(projection.rows.map(row => ({ date: row.date, value: row.plot })));
  const sourceValues = Object.fromEntries(monthly.map(row => [`${Number(row.date.slice(5, 7))}월/${row.date.slice(0, 4)}`, row.value]));
  const valueFormatter = (value: number) => formatCompactBusinessValue(businessChartAxisValue(projection.min, projection.max, value));
  const Heatmap = metric === 'bps' ? BPSHeatmap : metric === 'dps' ? DPSHeatmap : PERHeatmap;

  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground tabular-nums">
      {monthly[0].date} ~ {monthly.at(-1)!.date} · {monthly.length.toLocaleString('ko-KR')}개월 · 각 월의 마지막 제공값 · 빈 칸 미제공
    </p>
    <ChartWhenVisible fallback={<div className="flex items-center justify-center border-y border-border text-sm text-muted-foreground" style={{ height: Math.max(240, heatmap.length * 28 + 104) }}>차트 준비 중…</div>}>
      <Heatmap data={heatmap} minValue={0} maxValue={1} sourceValues={sourceValues} valueFormatter={valueFormatter} />
    </ChartWhenVisible>
  </div>;
}

function DistributionRecord({ rows, metric, currentValue }: { rows: DetailObservation[]; metric: AnalysisMetric; currentValue: BusinessValue }) {
  const info = DETAIL_METRICS[metric];
  const valid = rows.filter(row => isBusinessDay(row.date) && (!row.state || row.state === 'provided') && compareBusinessValues(row.value, 0) != null);
  const summary = summarizeBusinessWindow(valid);
  if (!summary.count) return <p className="border-y border-border py-8 text-sm text-muted-foreground" role="status">선택 기간에 제공된 {info.label} 관측값이 없습니다.</p>;

  const projection = projectBusinessChartRows(valid);
  const distribution = projection.rows.flatMap(row => row.plot == null ? [] : [{ date: row.date, value: row.plot }]);
  const formatAxis = (value: number) => formatCompactBusinessValue(businessChartAxisValue(projection.min, projection.max, value));
  const formatTooltip = (value: number) => formatBusinessValue(businessChartAxisValue(projection.min, projection.max, value));
  const Distribution = metric === 'bps' ? BPSDistribution : metric === 'dps' ? DPSDistribution : PERDistribution;
  const currentAvailable = compareBusinessValues(currentValue, 0) != null;
  const belowCurrent = metric === 'per' && currentAvailable
    ? valid.filter(row => (compareBusinessValues(row.value, currentValue) ?? 1) <= 0).length : null;

  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground tabular-nums">{summary.start} ~ {summary.end} · 실제 제공 {summary.count.toLocaleString('ko-KR')}개</p>
    {metric === 'per' && <p className="text-sm tabular-nums">
      {belowCurrent == null ? '현재 PER 미제공으로 관측일 비율을 계산할 수 없습니다.' : <>
        현재 PER {formatBusinessValue(currentValue)}배 이하 <strong>{(belowCurrent / summary.count * 100).toFixed(1)}%</strong>
        <span className="text-muted-foreground"> ({belowCurrent.toLocaleString('ko-KR')}/{summary.count.toLocaleString('ko-KR')} 관측일)</span>
      </>}
    </p>}
    <ChartWhenVisible>
      <Distribution data={distribution} formatCoordinate={formatAxis} formatDetailCoordinate={formatTooltip} sourceSummary={`평균 ${formatBusinessValue(summary.mean)}${info.unit}`} />
    </ChartWhenVisible>
  </div>;
}

export function DetailPriceHistory({ rows, start, end }: { rows: Record<string, unknown>[]; start?: string; end?: string }) {
  const latest = end || String(rows.at(-1)?.date || '');
  const visibleStart = start || (end ? '' : earlierDate(latest, 3));
  const candles = actualCandlesticks(rows, visibleStart, latest);
  const visible = candles.filter(row => !row.warmupOnly);
  const closeRows = priceMovingAverages(rows, visibleStart, latest);
  if (visible.length < 2 || closeRows.filter(row => row.value != null).length > visible.length) {
    return <div className="space-y-3">
      {closeRows.some(row => row.value != null) && <p className="text-xs text-muted-foreground">시가·고가·저가·종가가 충분하지 않아 제공된 종가를 표시합니다.</p>}
      <DetailHistoryChart rows={closeRows} movingAverages={closeRows} label="종가" unit="원" metric="marketcap" />
    </div>;
  }
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground tabular-nums">실제 거래 범위 {visible[0].time} ~ {visible.at(-1)!.time} · {visible.length.toLocaleString('ko-KR')}개 기록 · 5·10거래일 이동평균</p>
    <ChartWhenVisible fallback={<PriceChartPlaceholder />}>
      <Candles data={candles} movingAverageValues={closeRows.map(row => ({ time: row.date, average5: row.average5, average10: row.average10 }))} />
    </ChartWhenVisible>
  </div>;
}

export function DetailAnnualHistory({ rows, label, unit, yearEndOnly = false }: { rows: DetailAnnualRow[]; label: string; unit: string; yearEndOnly?: boolean }) {
  return <DetailAnnualTable
    rows={rows}
    label={label}
    yearEndOnly={yearEndOnly}
    formatValue={value => value == null ? '—' : `${formatCompactBusinessValue(value)}${unit}`}
    formatDetailValue={value => value == null ? '—' : `${formatBusinessValue(value)}${unit}`}
  />;
}

const comparisonColors = ['var(--chart-2)', 'var(--chart-1)', 'var(--brand-ink)', 'var(--chart-3)', 'var(--chart-5)'];
const comparisonDashes = ['', '5 3', '2 3', '8 3 2 3', '9 4'];

export function DividendComparisonChart({ members, metric, start, end }: {
  members: DetailSecurityRow[]; metric: 'div' | 'dps'; start?: string; end?: string;
}) {
  const info = DETAIL_METRICS[metric];
  const distinctMembers = [...new Map(members.map(member => [member.securityId, member])).values()];
  const histories = distinctMembers.map(member => ({
    member,
    rows: (member.dividendHistory ?? []).flatMap(row => !isBusinessDay(row.date) || compareBusinessValues(row[metric], 0) == null
      ? [] : [{ date: row.date, value: row[metric] }]),
  }));
  const latest = end || histories.flatMap(history => history.rows.map(row => row.date)).reduce((last, date) => date > last ? date : last, '');
  const earliest = start || (end ? undefined : earlierDate(latest, 60));
  const monthly = histories.map(({ member, rows }) => ({
    member,
    months: lastMonthlyObservations(selectDetailRange(rows, earliest, latest)),
  }));
  const comparable = monthly.filter(({ months }) => months.size > 0);
  if (comparable.length < 2) return <p className="border-y border-border py-8 text-sm text-muted-foreground" role="status">비교할 수 있는 {info.name} 이력이 있는 구성 종목이 2개 미만입니다.</p>;

  const domain = monthly.flatMap(({ months }) => [...months.values()]);
  const dates = domain.map(row => row.date).sort();
  const minMonth = dates[0].slice(0, 7);
  const maxMonth = dates.at(-1)!.slice(0, 7);
  const { min, max, rows: plotRows } = projectBusinessChartRows(domain);
  const series: DividendComparisonSeries[] = [];
  let offset = 0;
  for (const { member, months } of monthly) {
    const name = member.korName || member.name || member.type || '종목';
    const index = series.length;
    const rows = plotRows.slice(offset, offset + months.size);
    series.push({
      id: member.securityId,
      label: `${name} (${member.ticker || member.routeCode || member.securityId})`,
      color: comparisonColors[index % comparisonColors.length],
      dash: comparisonDashes[Math.floor(index / comparisonColors.length + index) % comparisonDashes.length],
      values: Object.fromEntries(rows.map(row => [row.date.slice(0, 7), row])),
    });
    offset += months.size;
  }

  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground tabular-nums">{dates[0]} ~ {dates.at(-1)} · 각 종목의 월별 마지막 제공값 · 단위 {info.unit}</p>
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs tabular-nums" aria-label="비교 종목별 관측 수">
      {series.map(({ id, label, color, dash, values }) => <li className="flex min-w-0 items-center gap-2" key={id}>
        <svg aria-hidden="true" className="shrink-0" width="20" height="8" viewBox="0 0 20 8">
          <path d="M0 4h20" fill="none" stroke={color} strokeDasharray={dash || undefined} strokeWidth={2} />
        </svg>
        <span className="min-w-0 break-words">{label} <span className="text-muted-foreground">{Object.keys(values).length}개월</span></span>
      </li>)}
    </ul>
    <ChartWhenVisible>
      <DividendComparisonPlot months={chartMonths(minMonth, maxMonth)} series={series} minimum={min} maximum={max} unit={info.unit} />
    </ChartWhenVisible>
  </div>;
}
