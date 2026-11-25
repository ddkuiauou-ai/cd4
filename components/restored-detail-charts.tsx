'use client';

import { formatInvestorAmount, formatInvestorNumber, usesInvestorPrecision } from '@/lib/investor-number';
import dynamic from 'next/dynamic';
import { lazy } from 'react';
import { DetailAnnualTable, type AnnualDividendComparison } from './detail-annual-table';
import { DetailHistoryChart } from './detail-history-chart';
import { ChartWhenVisible } from './detail-chart-visibility';
import { StaticTrendLine } from './static-detail-trend';
import { DetailChartSkeleton } from './detail-record-skeleton';
import { chartMonths, lastMonthlyObservations, marketcapPeriodMonths } from './detail-chart-observations';
import { MarketcapRangeControls, useMarketcapChartRange } from './marketcap-chart-range';
import type { DividendComparisonDifference, DividendComparisonSeries } from './detail-trend-plot';
import type { DetailSecurityRow } from './detail-types';
import styles from './detail-chart.module.css';
import { DETAIL_METRICS, actualCandlesticks, priceMovingAverages, earlierDate, monthlyHeatmap, selectDetailRange, type DetailAnnualRow, type DetailMetric, type DetailObservation } from '@/lib/detail-presentation';
import { businessChartAxisValue, compareBusinessValues, dividendYieldDistribution, projectBusinessChartRows, formatBusinessValue, formatCompactBusinessValue, formatMarketcapAmount, isBusinessDay, medianBusinessValues, subtractBusinessValues, summarizeBusinessWindow, type BusinessValue } from '@/lib/business-analysis';

export { ChartWhenVisible } from './detail-chart-visibility';

function PriceChartPlaceholder() {
  return <div className="flex h-[320px] items-center justify-center border-y border-border text-sm text-muted-foreground sm:h-[340px] md:h-[380px] lg:h-[420px]">차트 준비 중…</div>;
}
const Candles = dynamic(() => import('./chart-candlestick').then(module => module.CandlestickChart), { ssr: false, loading: PriceChartPlaceholder });
const CandlesWithSkeleton = dynamic(() => import('./chart-candlestick').then(module => module.CandlestickChart), {
  ssr: false, loading: () => <DetailChartSkeleton variant="price" label="주가 차트" plotOnly />,
});
const PERHeatmap = lazy(() => import('./chart-per-heatmap'));
const BPSHeatmap = dynamic(() => import('./chart-bps-heatmap'));
const DPSHeatmap = lazy(() => import('./chart-dps-heatmap'));
const PERDistribution = lazy(() => import('./chart-per-distribution'));
const BPSDistribution = dynamic(() => import('./chart-bps-distribution'));
const DPSDistribution = lazy(() => import('./chart-dps-distribution'));
const DividendComparisonPlot = lazy(() => import('./detail-trend-plot').then(module => ({ default: module.DividendComparisonPlot })));

type AnalysisKind = 'monthly' | 'distribution';
type AnalysisMetric = 'per' | 'bps' | 'dps';

export function DetailFinancialAnalysis({ rows, metric, name, kind, currentValue = null }: {
  rows: DetailObservation[]; metric: DetailMetric; name: string; kind?: AnalysisKind; currentValue?: BusinessValue;
}) {
  if (metric === 'div') return kind === 'monthly' ? null : <DividendYieldDistribution rows={rows} />;
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

function DividendYieldDistribution({ rows }: { rows: DetailObservation[] }) {
  const { bins, days, start, end } = dividendYieldDistribution(rows);
  if (!days) return <p className="border-y border-border py-8 text-sm text-muted-foreground" role="status">선택 기간에 제공된 배당수익률 관측값이 없습니다.</p>;

  const highest = bins.reduce((max, bin) => Math.max(max, bin.days), 0);
  return <figure className={styles.figure}>
    <p className={styles.range}>0.5%p 간격 · 시작값 이상, 끝값 미만</p>
    <table className={styles.yieldDistribution}>
      <caption className="sr-only">배당수익률 구간별 관측일 수</caption>
      <thead><tr><th scope="col">배당수익률 구간</th><th scope="col">관측일 수</th></tr></thead>
      <tbody>{bins.map(({ lower, upper, days: binDays }) => <tr key={lower}>
        <th scope="row">{formatInvestorAmount(lower, '%')} ~ {formatInvestorAmount(upper, '%')}</th>
        <td><div className={styles.yieldDistributionCount}>
          <span className={styles.yieldDistributionTrack} aria-hidden="true">
            <span style={{ inlineSize: `${binDays / highest * 100}%` }} />
          </span>
          <span>{binDays.toLocaleString('ko-KR')}일</span>
        </div></td>
      </tr>)}</tbody>
    </table>
    <figcaption className={styles.caption}>{start} ~ {end} · 실제 관측 {days.toLocaleString('ko-KR')}일</figcaption>
  </figure>;
}

function MonthlyRecord({ rows, metric, name }: { rows: DetailObservation[]; metric: AnalysisMetric; name: string }) {
  const info = DETAIL_METRICS[metric];
  const monthly = [...lastMonthlyObservations(rows).values()].filter(row => row.value != null).sort((a, b) => a.date.localeCompare(b.date));
  if (!monthly.length) return <p className="border-y border-border py-8 text-sm text-muted-foreground" role="status">표시할 {name}의 월별 {info.label} 기록이 없습니다.</p>;

  const projection = projectBusinessChartRows(monthly);
  const heatmap = monthlyHeatmap(projection.rows.map(row => ({ date: row.date, value: row.plot })));
  const sourceValues = Object.fromEntries(monthly.map(row => [`${Number(row.date.slice(5, 7))}월/${row.date.slice(0, 4)}`, row.value]));
  const valueFormatter = (value: number) => metric === 'bps'
    ? formatCompactBusinessValue(businessChartAxisValue(projection.min, projection.max, value))
    : formatInvestorNumber(businessChartAxisValue(projection.min, projection.max, value), info.unit);
  const Heatmap = metric === 'bps' ? BPSHeatmap : metric === 'dps' ? DPSHeatmap : PERHeatmap;

  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground tabular-nums">
      {monthly[0].date} ~ {monthly.at(-1)!.date} · {monthly.length.toLocaleString('ko-KR')}개월 · 각 월의 마지막 제공값 · 빈 칸 미제공
    </p>
    <ChartWhenVisible fallback={<DetailChartSkeleton variant="monthly" height={Math.max(240, heatmap.length * 28 + 104)} label="월별 기록 차트" plotOnly />}>
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
  const coordinate = (value: number) => businessChartAxisValue(projection.min, projection.max, value);
  const formatTooltip = (value: number) => metric === 'bps' ? formatBusinessValue(coordinate(value)) : formatInvestorNumber(coordinate(value), info.unit);
  const formatAxis = (value: number) => metric === 'bps' ? formatCompactBusinessValue(coordinate(value)) : formatTooltip(value);
  const formatStatistic = (value: BusinessValue) => metric === 'bps' ? `${formatBusinessValue(value)}${info.unit}` : formatInvestorAmount(value, info.unit);
  const median = medianBusinessValues(valid.map(row => row.value));
  const sourceSummary = `평균 ${formatStatistic(summary.mean)} · 중앙값 ${formatStatistic(median)}`;
  const Distribution = metric === 'bps' ? BPSDistribution : metric === 'dps' ? DPSDistribution : PERDistribution;
  const currentAvailable = compareBusinessValues(currentValue, 0) != null;
  const belowCurrent = metric === 'per' && currentAvailable
    ? valid.filter(row => (compareBusinessValues(row.value, currentValue) ?? 1) <= 0).length : null;

  return <figure className={styles.figure}>
    {metric === 'per' && <p className="text-sm tabular-nums">
      {belowCurrent == null ? '현재 PER 미제공으로 관측일 비율을 계산할 수 없습니다.' : <>
        현재 PER <span title={`${formatBusinessValue(currentValue)}배`}>{formatInvestorAmount(currentValue, '배')}</span> 이하{' '}
        <strong>{formatInvestorAmount(belowCurrent / summary.count * 100, '%')}</strong>
        <span className="text-muted-foreground"> ({belowCurrent.toLocaleString('ko-KR')}/{summary.count.toLocaleString('ko-KR')} 관측일)</span>
      </>}
    </p>}
    <ChartWhenVisible fallback={<DetailChartSkeleton variant="distribution" label="과거 분포 차트" plotOnly />}>
      <Distribution data={distribution} formatCoordinate={formatAxis} formatDetailCoordinate={formatTooltip} sourceSummary={sourceSummary} />
    </ChartWhenVisible>
    <figcaption className={styles.caption}>{summary.start} ~ {summary.end} · 실제 제공 {summary.count.toLocaleString('ko-KR')}개</figcaption>
  </figure>;
}

export function DetailPriceHistory({ rows, start, end, usePlotSkeleton = false, marketcapRange, staticPreview = false }: {
  rows: Record<string, unknown>[]; start?: string; end?: string; usePlotSkeleton?: boolean; marketcapRange?: { initial?: string }; staticPreview?: boolean;
}) {
  const range = useMarketcapChartRange('priceRange', marketcapRange?.initial);
  const latest = end || String(rows.at(-1)?.date || '');
  const months = marketcapRange ? marketcapPeriodMonths[range.period] : 3;
  const visibleStart = start || (end || !months ? '' : earlierDate(latest, months));
  const controls = marketcapRange && rows.length > 0 && !start && !end && <MarketcapRangeControls label="주가·거래량 차트 범위" {...range} />;
  const candles = actualCandlesticks(rows, visibleStart, latest);
  const visible = candles.filter(row => !row.warmupOnly);
  const closeRows = priceMovingAverages(rows, visibleStart, latest);
  if (visible.length < 2 || closeRows.filter(row => row.value != null).length > visible.length) {
    return <div className="space-y-3">
      {controls}
      {closeRows.some(row => row.value != null) && <p className="text-xs text-muted-foreground">시가·고가·저가·종가가 충분하지 않아 제공된 종가를 표시합니다.</p>}
      <DetailHistoryChart rows={closeRows} movingAverages={closeRows} label="종가" unit="원" metric="marketcap" usePlotSkeleton={usePlotSkeleton} />
    </div>;
  }
  const PriceChart = usePlotSkeleton ? CandlesWithSkeleton : Candles;
  return <figure className={styles.figure}>
    {controls}
    <ChartWhenVisible fallback={staticPreview ? <StaticTrendLine label="종가" points={projectBusinessChartRows(closeRows).rows} />
      : usePlotSkeleton ? <DetailChartSkeleton variant="price" label="주가 차트" plotOnly /> : <PriceChartPlaceholder />}>
      <PriceChart data={candles} movingAverageValues={closeRows.map(row => ({ time: row.date, average5: row.average5, average10: row.average10 }))} />
    </ChartWhenVisible>
    <figcaption className={styles.caption}>실제 거래 범위 {visible[0].time} ~ {visible.at(-1)!.time} · {visible.length.toLocaleString('ko-KR')}개 기록 · 5·10거래일 이동평균</figcaption>
  </figure>;
}

export function DetailAnnualHistory({ rows, label, unit, metric, yearEndOnly = false, dividendComparison }: {
  rows: DetailAnnualRow[]; label: string; unit: string; metric?: DetailMetric | 'price'; yearEndOnly?: boolean;
  dividendComparison?: AnnualDividendComparison;
}) {
  const marketcap = metric === 'marketcap';
  const closingPrice = metric === 'price';
  const layout = marketcap ? 'marketcap' : closingPrice ? 'closing-price' : unit === '배' ? 'ratio' : undefined;
  const isPerShare = metric === 'eps' || metric === 'bps';
  const hasDividendComparison = (metric === 'div' || metric === 'dps') && Boolean(dividendComparison?.pairs.length);
  const exact = (value: BusinessValue) => value == null ? '—' : `${formatBusinessValue(value)}${unit}`;
  const exactWon = (value: BusinessValue) => exact(value).replace(/^-/, '−');
  const compact = (value: BusinessValue) => value == null ? '—' : `${formatCompactBusinessValue(value)}${unit}`;
  return <DetailAnnualTable
    rows={rows}
    label={marketcap && label === DETAIL_METRICS.marketcap.label ? '종목 시총' : label}
    yearEndOnly={yearEndOnly}
    layout={layout}
    dividendComparison={hasDividendComparison && dividendComparison ? { ...dividendComparison, unit: metric === 'div' ? '%p' : '원' } : undefined}
    financialMetric={marketcap || closingPrice ? undefined : metric}
    formatValue={marketcap ? formatMarketcapAmount : isPerShare ? exactWon
      : usesInvestorPrecision(metric) ? value => formatInvestorAmount(value, unit) : layout === 'ratio' ? exact : compact}
    formatDetailValue={exact}
  />;
}

const comparisonColors = ['var(--chart-2)', 'var(--chart-1)', 'var(--brand-ink)', 'var(--chart-3)', 'var(--chart-5)'];
const comparisonDashes = ['', '5 3', '2 3', '8 3 2 3', '9 4'];
const shareOrder = (member: DetailSecurityRow) => member.type === '보통주' ? 0 : member.type?.includes('우선주') ? 1 : 2;

export function DividendComparisonChart({ members, metric, start, end, selectedSecurityId }: {
  members: DetailSecurityRow[]; metric: 'div' | 'dps'; start?: string; end?: string; selectedSecurityId?: string;
}) {
  const info = DETAIL_METRICS[metric];
  const distinctMembers = [...new Map(members.map(member => [member.securityId, member])).values()]
    .sort((left, right) => shareOrder(left) - shareOrder(right) || (left.ticker ?? left.securityId).localeCompare(right.ticker ?? right.securityId));
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
      selected: member.securityId === selectedSecurityId,
      values: Object.fromEntries(rows.map(row => [row.date.slice(0, 7), row])),
    });
    offset += months.size;
  }
  const commonShares = distinctMembers.filter(member => member.type === '보통주');
  const common = commonShares.length === 1 ? series.find(item => item.id === commonShares[0].securityId) : undefined;
  const preferredIds = new Set(distinctMembers.filter(member => member.type?.includes('우선주')).map(member => member.securityId));
  const preferred = common ? series.filter(item => preferredIds.has(item.id)) : [];
  const months = chartMonths(minMonth, maxMonth);
  const latestDate = series[0].values[maxMonth]?.date;
  const sharedDate = latestDate && series.every(item => item.values[maxMonth]?.date === latestDate) ? latestDate : null;
  const monthCount = Object.keys(series[0].values).length;
  const countShared = series.every(item => Object.keys(item.values).length === monthCount);
  const differenceUnit = metric === 'div' ? '%p' : '원';
  const differences: Record<string, DividendComparisonDifference[]> = Object.fromEntries(months.map(month => [month, preferred.map(item => {
    const base = common?.values[month];
    const own = item.values[month];
    const difference = base && own && base.date === own.date ? subtractBusinessValues(own.value, base.value) : null;
    const value = difference != null
      ? formatInvestorAmount(difference, differenceUnit, true)
      : base && own ? '관측일이 달라 미산출' : '비교 관측 미제공';
    return { id: item.id, label: preferred.length === 1 ? '우선주 − 보통주' : `${item.label} − 보통주`, value };
  })]));

  return <figure className={styles.figure}>
    <p className={styles.caption}>{sharedDate ? <>마지막 관측 <time dateTime={sharedDate}>{sharedDate}</time></> : `마지막 표시 월 ${maxMonth.replace('-', '.')}`}</p>
    <ul className={styles.comparisonLegend} aria-label="비교 종목별 마지막 표시 월의 관측값">
      {series.map(({ id, label, color, dash, selected, values }) => {
        const latest = values[maxMonth];
        return <li key={id} aria-current={selected ? true : undefined}>
          <svg aria-hidden="true" width="20" height="8" viewBox="0 0 20 8">
            <path d="M0 4h20" fill="none" stroke={color} strokeDasharray={dash || undefined} strokeWidth={dash ? 2 : 3} />
          </svg>
          <span>{label} {selected && <small className={styles.selectedSeries}>선택</small>}</span>
          <strong>{latest ? formatInvestorAmount(latest.value, info.unit) : '미제공'}</strong>
          {(!sharedDate && latest || !countShared) && <span className={styles.comparisonMeta}>
            {!sharedDate && latest && <time dateTime={latest.date}>{latest.date}</time>}
            {!sharedDate && latest && !countShared && ' · '}
            {!countShared && `${Object.keys(values).length}개월 제공`}
          </span>}
        </li>;
      })}
    </ul>
    {differences[maxMonth].length > 0 && <dl className={styles.comparisonDifferences}>
      {differences[maxMonth].map(({ id, label, value }) => <div key={id}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>}
    <div className={styles.chartArea} role="group" aria-label={`${info.name} 비교 차트. 좌우 방향키로 관측값을 확인할 수 있습니다.`}>
      <p className={styles.axisUnit}>단위 {info.unit}</p>
      <ChartWhenVisible fallback={<DetailChartSkeleton label={info.name + ' 비교 차트'} />}>
        <DividendComparisonPlot months={months} series={series} differences={differences} minimum={min} maximum={max} unit={info.unit} />
      </ChartWhenVisible>
    </div>
    <figcaption className={styles.caption}>{minMonth.replace('-', '.')} ~ {maxMonth.replace('-', '.')} · 각 종목의 월별 마지막 제공값{countShared && ` · 종목당 ${monthCount}개월 제공`}</figcaption>
  </figure>;
}
