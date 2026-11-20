'use client';

import { lazy, useMemo, useState } from 'react';
import { businessChangePercent, compareBusinessValues, projectBusinessChartRows, formatBusinessValue, subtractBusinessValues, summarizeBusinessWindow } from '@/lib/business-analysis';
import { aggregateDetailRows, detailAnnualRows, earlierDate, selectDetailRange, type DetailMetric, type DetailObservation } from '@/lib/detail-presentation';
import { chartMonths, lastMonthlyObservations } from './detail-chart-observations';
import { ChartWhenVisible } from './detail-chart-visibility';

const DetailTrendPlot = lazy(() => import('./detail-trend-plot').then(module => ({ default: module.DetailTrendPlot })));
const annualPeriods = [['1Y', '최근 연말'], ['5Y', '최근 5개 연말'], ['10Y', '10년'], ['20Y', '20년']];
const dividendPeriods = [['12M', '12개월'], ['3Y', '3년'], ['5Y', '5년'], ['10Y', '10년'], ['20Y', '20년']];
const aggregatePeriods = [['month', '월간'], ['year', '연간']];
const trendPeriods = [['5Y', '최근 5년'], ['all', '전체']];

type HistoryChartProps = {
  rows: DetailObservation[];
  label: string;
  unit: string;
  metric?: DetailMetric;
  selectedStart?: string;
  selectedEnd?: string;
  annual?: boolean;
  customRange?: boolean;
  withStatistics?: boolean;
  movingAverages?: Array<{ date: string; average5: string | null; average10: string | null }>;
};

export function DetailHistoryChart(props: HistoryChartProps) {
  return <HistoryChart key={`${props.metric ?? props.label}/${props.annual}`} {...props} />;
}

function ChartChoices({ items, title, active, select }: {
  items: string[][]; title: string; active: string; select: (choice: string) => void;
}) {
  return <div className="detail-trend-controls flex flex-wrap items-center gap-2" role="group" aria-label={title}>
    {items.map(([key, name]) => <button
      type="button"
      key={key}
      aria-pressed={active === key}
      onClick={() => select(key)}
      className={`min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${active === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:bg-accent'}`}
    >{name}</button>)}
  </div>;
}

function HistoryChart({ rows, label, unit, metric, selectedStart, selectedEnd, annual = false, movingAverages, customRange = Boolean(selectedStart), withStatistics = false }: HistoryChartProps) {
  const bpsAnnual = metric === 'bps' && annual;
  const aggregate = !bpsAnnual && metric !== 'dps' && metric !== 'marketcap';
  const [period, setPeriod] = useState(metric === 'dps' ? '12M' : '5Y');
  const [aggregateUnit, setAggregateUnit] = useState<'month' | 'year'>('month');
  const periods = bpsAnnual ? annualPeriods : metric === 'dps' ? dividendPeriods : aggregate ? trendPeriods : [];
  const fixedRange = customRange && periods.length > 0;
  const end = selectedEnd || rows.at(-1)?.date || '';
  const source = useMemo(() => {
    const selected = selectDetailRange(rows, selectedStart, selectedEnd);
    if (fixedRange) return selected;
    if (bpsAnnual) {
      const latestYearEnd = detailAnnualRows(selected, 'bps')[0];
      if (!latestYearEnd) return selected;
      const firstYear = Number(latestYearEnd.date.slice(0, 4)) - Number.parseInt(period) + 1;
      return selected.filter(row => row.date >= `${firstYear}-01-01`);
    }
    if (metric === 'dps' || aggregate && period === '5Y') {
      const months = metric !== 'dps' ? 60 : period === '12M' ? 12 : Number.parseInt(period) * 12;
      return selectDetailRange(selected, earlierDate(end, months), end);
    }
    return selected;
  }, [rows, metric, aggregate, bpsAnnual, period, end, selectedStart, selectedEnd, fixedRange]);
  const summary = summarizeBusinessWindow(source);
  let chartRows = source;
  if (bpsAnnual) {
    chartRows = detailAnnualRows(source, 'bps').reverse();
  } else if (aggregate && aggregateUnit === 'month') {
    const byMonth = lastMonthlyObservations(source);
    const months = [...byMonth.keys()].sort();
    chartRows = chartMonths(months[0], months.at(-1)).map(month => byMonth.get(month) ?? { date: `${month}-01`, value: null });
  } else if (aggregate) {
    chartRows = aggregateDetailRows(source, 'year');
  }

  const chartSummary = summarizeBusinessWindow(chartRows);
  const barMetric = metric === 'bps' || metric === 'dps';
  const zero = { date: chartRows[0]?.date || '2000-01-01', value: 0 };
  const domainRows = [
    ...chartRows,
    ...(barMetric ? [zero] : []),
    ...(movingAverages ?? []).flatMap(row => [{ date: row.date, value: row.average5 }, { date: row.date, value: row.average10 }]),
  ];
  const projection = projectBusinessChartRows(chartRows, domainRows);
  const zeroPlot = barMetric ? projectBusinessChartRows([zero], domainRows).rows[0].plot ?? 0 : 0;
  const averages = new Map((movingAverages ?? []).map(row => [row.date, row]));
  const projectAverage = (key: 'average5' | 'average10') => new Map(projectBusinessChartRows(
    (movingAverages ?? []).map(row => ({ date: row.date, value: row[key] })), domainRows,
  ).rows.map(row => [row.date, row.plot]));
  const average5 = movingAverages && projectAverage('average5');
  const average10 = movingAverages && projectAverage('average10');

  const changes = new Map<string, { change: string | null; difference: string | null; reason: string | null }>();
  let prior: DetailObservation | undefined;
  for (const row of metric === 'dps' ? rows : []) {
    if (row.state && row.state !== 'provided' || compareBusinessValues(row.value, 0) == null) continue;
    const sameCoverage = !row.observedSecurityIds && !prior?.observedSecurityIds
      || Boolean(prior && JSON.stringify([...(row.observedSecurityIds ?? [])].sort()) === JSON.stringify([...(prior.observedSecurityIds ?? [])].sort()));
    const priorValueSign = prior ? compareBusinessValues(prior.value, 0) : null;
    const change = prior && sameCoverage ? businessChangePercent(prior.value, row.value) : null;
    const difference = prior && sameCoverage && priorValueSign != null && priorValueSign <= 0 ? subtractBusinessValues(row.value, prior.value) : null;
    const reason = !prior ? '직전 제공 기록이 없습니다.' : !sameCoverage ? '관측 종목 구성이 달라 직전 이력과의 비교를 표시하지 않습니다.'
      : priorValueSign != null && priorValueSign <= 0 ? `이전 값이 ${priorValueSign === 0 ? '0' : '음수'}라 증감률 계산 불가` : null;
    changes.set(row.date, { change, difference, reason });
    prior = row;
  }
  const data = projection.rows.map(row => {
    const delta = changes.get(row.date);
    return {
      ...row,
      barRange: row.plot == null ? null : [zeroPlot, row.plot],
      average5: average5?.get(row.date) ?? null,
      average10: average10?.get(row.date) ?? null,
      average5Source: averages.get(row.date)?.average5 ?? null,
      average10Source: averages.get(row.date)?.average10 ?? null,
      changeSource: delta?.change ?? null,
      differenceSource: delta?.difference ?? null,
      comparisonReason: delta?.reason ?? null,
      change: delta?.change == null ? null : Number(delta.change),
    };
  });
  const lastPlotted = data.findLast(row => row.plot != null);
  const statisticsBasis = bpsAnnual ? '각 연도의 마지막 12월 관측값'
    : aggregate ? aggregateUnit === 'month' ? '각 월의 마지막 제공값' : '각 연도 제공 관측의 산술평균'
    : '선택 기간의 실제 제공 관측';
  const units = <span className="text-xs text-muted-foreground">단위 {unit}{metric === 'dps' && ' · 직전 제공 기록 대비 변화율(%)'}</span>;

  const main = <>
    {movingAverages && <p className="text-xs text-muted-foreground">종가 · 5거래일 이동평균 · 10거래일 이동평균</p>}
    <div className="space-y-2">
      {fixedRange
        ? <p className="detail-trend-range text-sm text-muted-foreground tabular-nums">직접 지정 기간 {selectedStart || '처음'} ~ {selectedEnd || rows.at(-1)?.date || '마지막'}</p>
        : periods.length > 0 && <ChartChoices items={periods} title={`${label} 표시 기간`} active={period} select={setPeriod} />}
      {aggregate && <ChartChoices
        items={aggregatePeriods}
        title={`${label} 집계 단위`}
        active={aggregateUnit}
        select={value => setAggregateUnit(value === 'year' ? 'year' : 'month')}
      />}
      {units}
    </div>
    {summary.count > 0 && <p className="text-xs text-muted-foreground tabular-nums">
      선택 원천 관측 {summary.start} ~ {summary.end} · {summary.count.toLocaleString('ko-KR')}개 기록{!withStatistics && (bpsAnnual || aggregate) && ` · ${statisticsBasis}`}
    </p>}
    {chartSummary.count === 1 && lastPlotted && <div className="border-y border-border py-4 text-sm">
      <p>추이를 그릴 이력이 부족합니다. 등록된 날짜의 값을 점으로 표시합니다.</p>
      <p className="mt-2 font-semibold tabular-nums">{lastPlotted.date} · {formatBusinessValue(lastPlotted.value)}{unit}</p>
    </div>}
    {chartSummary.count === 0
      ? <p className="border-y border-border py-8 text-sm" role="status">{bpsAnnual ? '이 기간에 표시할 연말 BPS 제공값이 없습니다.' : '선택 기간에 제공된 관측값이 없습니다.'}</p>
      : <div role="img" aria-label={`${label} 차트 ${chartSummary.start}부터 ${chartSummary.end}, 표시 관측 ${chartSummary.count}개. 최소 ${formatBusinessValue(chartSummary.min)}${unit}, 최대 ${formatBusinessValue(chartSummary.max)}${unit}`}>
        <ChartWhenVisible>
          <DetailTrendPlot data={data} label={label} unit={unit} metric={metric} minimum={projection.min} maximum={projection.max} singlePoint={chartSummary.count === 1} showMovingAverages={Boolean(movingAverages)} />
        </ChartWhenVisible>
      </div>}
  </>;
  return withStatistics ? <div className="detail-trend-grid">
    <div className="detail-trend-main space-y-4">{main}</div>
    <aside id="trend-statistics" className="detail-trend-statistics" aria-label="표시 관측 통계">
      <h3>표시 관측 통계</h3>
      <p className="detail-trend-statistics-range tabular-nums">{chartSummary.start || '—'} ~ {chartSummary.end || '—'}</p>
      <dl>{[
        ['마지막 표시값', lastPlotted ? `${formatBusinessValue(lastPlotted.value)}${unit}` : '—'],
        ['평균', chartSummary.mean == null ? '—' : `${formatBusinessValue(chartSummary.mean)}${unit}`],
        ['최저', chartSummary.min == null ? '—' : `${formatBusinessValue(chartSummary.min)}${unit}`],
        ['최고', chartSummary.max == null ? '—' : `${formatBusinessValue(chartSummary.max)}${unit}`],
        ['관측 수', `${chartSummary.count.toLocaleString('ko-KR')}개`],
      ].map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}</dl>
      <p className="detail-trend-statistics-basis">{statisticsBasis}</p>
    </aside>
  </div> : <div className="space-y-4">{main}</div>;
}
