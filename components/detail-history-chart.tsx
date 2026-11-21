'use client';

import { formatInvestorAmount, usesInvestorPrecision } from '@/lib/investor-number';
import { lazy, useMemo, useState } from 'react';
import { businessChangePercent, compareBusinessValues, projectBusinessChartRows, formatBusinessValue, formatMarketcapAmount, subtractBusinessValues, summarizeBusinessWindow } from '@/lib/business-analysis';
import { aggregateDetailRows, detailAnnualRows, earlierDate, selectDetailRange, type DetailMetric, type DetailObservation } from '@/lib/detail-presentation';
import { chartMonths, isMarketcapMonthly, lastMonthlyObservations, marketcapPeriodMonths, marketcapPeriods } from './detail-chart-observations';
import { ChartWhenVisible } from './detail-chart-visibility';
import { DetailChartSkeleton } from './detail-record-skeleton';
import styles from './detail-chart.module.css';

const DetailTrendPlot = lazy(() => import('./detail-trend-plot').then(module => ({ default: module.DetailTrendPlot })));
const annualPeriods = [['1Y', '최근 연말'], ['5Y', '최근 5개 연말'], ['10Y', '10년'], ['20Y', '20년']];
const dividendPeriods = [['12M', '12개월'], ['3Y', '3년'], ['5Y', '5년'], ['10Y', '10년'], ['20Y', '20년']];
const aggregatePeriods = [['month', '월간'], ['year', '연간']];
const trendPeriods = [['5Y', '5년'], ['all', '전체']];

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
  usePlotSkeleton?: boolean;
  movingAverages?: Array<{ date: string; average5: string | null; average10: string | null }>;
};

export function DetailHistoryChart(props: HistoryChartProps) {
  return <HistoryChart key={`${props.metric ?? props.label}/${props.annual}`} {...props} />;
}

function ChartChoices({ items, title, caption, active, select }: {
  items: string[][]; title: string; caption?: string; active: string; select: (choice: string) => void;
}) {
  return <div className={styles.choiceGroup} role="group" aria-label={title}>
    {caption && <span className={styles.choiceCaption} aria-hidden="true">{caption}</span>}
    <div className={styles.choices}>
      {items.map(([key, name]) => <button
        type="button"
        key={key}
        aria-pressed={active === key}
        onClick={() => select(key)}
      >{name}</button>)}
    </div>
  </div>;
}

function fillMissingYears(rows: DetailObservation[]) {
  if (rows.length < 2) return rows;
  const byYear = new Map(rows.map(row => [row.date.slice(0, 4), row]));
  const first = Number(rows[0].date.slice(0, 4));
  const last = Number(rows.at(-1)!.date.slice(0, 4));
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const year = String(first + index).padStart(4, '0');
    return byYear.get(year) ?? { date: `${year}-01-01`, value: null };
  });
}

function HistoryChart({ rows, label, unit, metric, selectedStart, selectedEnd, annual = false, movingAverages, customRange = Boolean(selectedStart), withStatistics = false, usePlotSkeleton = false }: HistoryChartProps) {
  const bpsAnnual = metric === 'bps' && annual;
  const simpleSelection = usesInvestorPrecision(metric);
  const capitalization = metric === 'marketcap' && !movingAverages;
  const labeledControls = capitalization || metric === 'per' || metric === 'pbr' || metric === 'eps' || metric === 'div';
  const aggregate = !bpsAnnual && metric !== 'dps' && metric !== 'marketcap';
  const [period, setPeriod] = useState(metric === 'dps' ? '12M' : '5Y');
  const [aggregateUnit, setAggregateUnit] = useState<'month' | 'year'>('month');
  const periods = bpsAnnual ? annualPeriods : metric === 'dps' ? dividendPeriods : capitalization ? marketcapPeriods : aggregate ? trendPeriods : [];
  const fixedRange = customRange && periods.length > 0;
  const end = selectedEnd || rows.at(-1)?.date || '';
  const selected = useMemo(() => selectDetailRange(rows, selectedStart, selectedEnd), [rows, selectedStart, selectedEnd]);
  const yearEnds = useMemo(() => bpsAnnual ? detailAnnualRows(selected, 'bps') : [], [bpsAnnual, selected]);
  const latestYearEnd = yearEnds[0]?.date;
  const firstYearEnd = !fixedRange && latestYearEnd
    ? `${Number(latestYearEnd.slice(0, 4)) - Number.parseInt(period) + 1}-01-01` : undefined;
  const source = useMemo(() => {
    if (fixedRange) return selected;
    if (capitalization && marketcapPeriodMonths[period]) return selectDetailRange(selected, earlierDate(end, marketcapPeriodMonths[period]), end);
    if (metric === 'dps' || aggregate && period === '5Y') {
      const months = metric !== 'dps' ? 60 : period === '12M' ? 12 : Number.parseInt(period) * 12;
      return selectDetailRange(selected, earlierDate(end, months), end);
    }
    return selected;
  }, [selected, metric, aggregate, capitalization, period, end, fixedRange]);
  const summary = bpsAnnual ? null : summarizeBusinessWindow(source);
  let chartRows = source;
  const marketcapMonthly = capitalization && !fixedRange && isMarketcapMonthly(period);
  if (bpsAnnual) {
    chartRows = fillMissingYears(selectDetailRange(yearEnds, firstYearEnd).reverse());
  } else if (marketcapMonthly || aggregate && aggregateUnit === 'month') {
    const byMonth = lastMonthlyObservations(source);
    const months = [...byMonth.keys()].sort();
    chartRows = marketcapMonthly ? months.map(month => byMonth.get(month)!) :
      chartMonths(months[0], months.at(-1)).map(month => byMonth.get(month) ?? { date: `${month}-01`, value: null });
  } else if (aggregate) {
    chartRows = aggregateDetailRows(source, 'year');
    if (labeledControls) chartRows = fillMissingYears(chartRows);
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
  const byYearEnd = new Map(yearEnds.map(row => [row.date, row]));
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
      yearEndComparison: byYearEnd.get(row.date),
    };
  });
  const lastPlotted = data.findLast(row => row.plot != null);
  const lastYearEnd = bpsAnnual ? data.at(-1) : undefined;
  const statisticsBasis = aggregate ? aggregateUnit === 'month' ? '각 월의 마지막 제공값' : '각 연도 제공 관측의 산술평균'
    : '선택 기간의 실제 제공 관측';
  const axisUnit = bpsAnnual ? 'year' : marketcapMonthly ? 'month' : aggregate ? aggregateUnit : 'day';
  const hasPlot = chartSummary.count > 0;
  const hasDividendGrowth = metric === 'dps' && data.some(row => row.change != null && Number.isFinite(row.change));
  const points = `${chartSummary.count.toLocaleString('ko-KR')}개`;
  const directHistory = !bpsAnnual && !aggregate && !marketcapMonthly && chartSummary.count > 1;
  const caption = bpsAnnual
    ? `각 연도의 12월 마지막 관측 · ${chartRows.length.toLocaleString('ko-KR')}개 연말 중 ${points} 제공`
    : <>
    {directHistory
      ? `선택 원천 관측 ${chartSummary.start} ~ ${chartSummary.end} · ${points} 기록`
      : `${marketcapMonthly ? '월별 마지막 관측' : statisticsBasis} · ${points}`}
    {summary && summary.count > chartSummary.count && ` / 원천 관측 ${summary.count.toLocaleString('ko-KR')}개`}
    {movingAverages && ' · 5·10거래일 이동평균'}
  </>;

  const historyClass = [
    styles.history,
    labeledControls && styles.labeledHistory,
    bpsAnnual && styles.yearEndHistory,
    simpleSelection && styles.simpleSelection,
  ].filter(Boolean).join(' ');

  return <div className={historyClass}>
    {(periods.length > 0 || aggregate) && <div className={styles.controls}>
      {fixedRange
        ? <p className={styles.range}>직접 지정 기간 <span>{selectedStart || '처음'} ~ {end || '마지막'}</span></p>
        : periods.length > 0 && <ChartChoices items={periods} title={`${label} 표시 기간`} caption={labeledControls ? '기간' : undefined} active={period} select={setPeriod} />}
      {aggregate && <ChartChoices
        items={aggregatePeriods}
        title={`${label} 집계 단위`}
        caption={labeledControls ? '집계' : undefined}
        active={aggregateUnit}
        select={value => setAggregateUnit(value === 'year' ? 'year' : 'month')}
      />}
    </div>}
    {lastYearEnd && <p className={styles.yearEndLatest} aria-live="polite">
      {lastYearEnd.date.slice(0, 4)}년 연말{' '}
      <strong title={lastYearEnd.plot == null ? undefined : `${formatBusinessValue(lastYearEnd.value)}${unit}`}>
        {lastYearEnd.plot == null ? '미제공' : formatInvestorAmount(lastYearEnd.value, unit)}
      </strong>
      <time dateTime={lastYearEnd.date}>{lastYearEnd.date}</time>
    </p>}
    {hasPlot ? <figure className={styles.figure}>
      {hasDividendGrowth && <ul className={styles.dividendGrowthLegend} aria-label="금액과 변화율의 축">
        <li><span aria-hidden="true" />주당배당금 (원)</li>
        <li><span aria-hidden="true" />직전 제공 기록 대비 변화율 (%)</li>
      </ul>}
      <div className={styles.chartArea} role="group" aria-label={`${label} 차트. 좌우 방향키로 관측값을 확인할 수 있습니다.`}>
        {!hasDividendGrowth && <p className={styles.axisUnit}>단위 {unit}{marketcapMonthly && ' · 월별 마지막 관측'}</p>}
        <ChartWhenVisible fallback={capitalization || simpleSelection || usePlotSkeleton ? <DetailChartSkeleton variant={capitalization ? 'marketcap' : 'plot'} label={label + ' 차트'} plotOnly />
          : <div className={styles.placeholder}>차트 준비 중…</div>}>
          <DetailTrendPlot data={data} label={label} unit={unit} metric={metric} axisUnit={axisUnit} minimum={projection.min} maximum={projection.max} singlePoint={chartSummary.count === 1} showMovingAverages={Boolean(movingAverages)} showDividendGrowth={hasDividendGrowth} />
        </ChartWhenVisible>
      </div>
      <figcaption className={styles.caption} aria-live="polite">
        {capitalization && chartSummary.count > 1 && lastPlotted && <span className={styles.marketcapReadout}>
          <time dateTime={lastPlotted.date}>{lastPlotted.date}</time> <strong>{formatMarketcapAmount(lastPlotted.value)}</strong>
        </span>}
        {caption}
        {chartSummary.count === 1 && lastPlotted && <span className="block">
          {lastPlotted !== lastYearEnd && <>{lastPlotted.date} · {simpleSelection ? formatInvestorAmount(lastPlotted.value, unit) : formatBusinessValue(lastPlotted.value) + unit} · </>}
          추이를 그릴 이력이 부족해 점으로 표시합니다.
        </span>}
      </figcaption>
    </figure> : <div className={styles.empty} role="status">
      <p>{bpsAnnual ? '이 기간에 표시할 연말 BPS 제공값이 없습니다.' : '선택 기간에 제공된 관측값이 없습니다.'}</p>
      {(bpsAnnual ? chartRows.length > 0 : Boolean(summary?.count)) && <p className={styles.caption}>{caption}</p>}
    </div>}
    {withStatistics && hasPlot && <dl className={capitalization ? `${styles.statistics} ${styles.marketcapStatistics}` : styles.statistics} aria-label="표시 관측 통계" aria-live="polite">
      {([
        ['최저', chartSummary.min],
        ['평균', chartSummary.mean],
        ['최고', chartSummary.max],
      ] as const).map(([term, value]) => {
        const exact = `${formatBusinessValue(value)}${unit}`;
        const display = simpleSelection ? formatInvestorAmount(value, unit) : capitalization ? formatMarketcapAmount(value) : exact;
        return <div key={term}><dt>{term}</dt><dd>
          <span title={simpleSelection && display !== exact ? exact : undefined}>{display}</span>{capitalization && display !== exact && <span className={styles.exactMarketcap}><span className="sr-only">정확한 원값 </span>{exact}</span>}
        </dd></div>;
      })}
    </dl>}
  </div>;
}
