'use client';

import { formatInvestorAmount, formatInvestorNumber, usesInvestorPrecision } from '@/lib/investor-number';
import { Area, Bar, CartesianGrid, ComposedChart, getNiceTickValues, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type DotItemDotProps } from 'recharts';
import { businessChartAxisValue, compareBusinessValues, formatBusinessValue, formatCompactBusinessValue, projectBusinessChartRows, type BusinessValue } from '@/lib/business-analysis';
import { marketcapDateAxis } from '@/lib/chart-selection';
import type { DetailAnnualRow, DetailMetric, DetailObservation } from '@/lib/detail-presentation';
import styles from './detail-chart.module.css';

export type DetailPlotRow = DetailObservation & {
  plot: number | null;
  barRange: number[] | null;
  average5: number | null;
  average10: number | null;
  average5Source: string | null;
  average10Source: string | null;
  changeSource: string | null;
  differenceSource: string | null;
  comparisonReason: string | null;
  change: number | null;
  yearEndComparison?: Pick<DetailAnnualRow, 'changeRate' | 'difference'>;
};

const normalizedTicks = [0, .25, .5, .75, 1];
const normalizedDomain: [number, number] = [0, 1];

export function readableAxis(minimum: BusinessValue, maximum: BusinessValue, formatTick: (value: BusinessValue) => string) {
  if (minimum == null || maximum == null) return;
  if (compareBusinessValues(minimum, maximum) === 0) {
    return { domain: normalizedDomain, marks: new Map([[0.5, formatTick(minimum)]]), zero: null };
  }
  const min = Number(minimum);
  const max = Number(maximum);
  const span = max - min;
  if (!Number.isFinite(span) || span <= Number.EPSILON * Math.max(Math.abs(min), Math.abs(max))) return;

  // Round the tick marks only. Project them with the same exact decimal
  // endpoints as the observations so neither the data nor tooltips are rounded.
  const ticks = getNiceTickValues([min, max], 7, true, 'snap125').filter(Number.isFinite);
  const first = ticks.findLastIndex(value => (compareBusinessValues(value, minimum) ?? 1) <= 0);
  const last = ticks.findIndex(value => (compareBusinessValues(value, maximum) ?? -1) >= 0);
  if (first < 0 || last <= first) return;

  const date = '2000-01-01';
  const projections = projectBusinessChartRows(ticks.slice(first, last + 1).map(value => ({ date, value })), [{ date, value: minimum }, { date, value: maximum }]).rows;
  const marks = new Map(projections.flatMap(({ value, plot }) => plot == null ? [] : [[plot, formatTick(value)] as const]));
  const low = projections[0].plot;
  const high = projections.at(-1)!.plot;
  if (low == null || high == null || low > 0 || high < 1 || marks.size !== projections.length || new Set(marks.values()).size !== marks.size) return;
  const domain: [number, number] = [low, high];
  return { domain, marks, zero: projections.find(row => row.value === 0)?.plot ?? null };
}

export function formatMarketcapAxisTick(value: BusinessValue) {
  const compact = formatCompactBusinessValue(value);
  return compact.replace(/^(-?\d+)(?=\.?\d*(?:조|억|만|천|백만)$)/, digits => formatBusinessValue(digits));
}

function calendarDateTicks(dates: readonly string[], axisUnit: 'month' | 'year') {
  const count = dates.length;
  const interval = axisUnit === 'year' ? count > 20 ? 5 : count > 10 ? 2 : 1
    : count > 180 ? 60 : count > 96 ? 24 : count > 36 ? 12 : count > 18 ? 6 : count > 10 ? 3 : 1;
  return dates.filter((date, index) => {
    const year = Number(date.slice(0, 4));
    const period = axisUnit === 'year' ? year : year * 12 + Number(date.slice(5, 7)) - 1;
    return index === 0 || index === count - 1 || period % interval === 0;
  });
}

export function DetailTrendPlot({ data, label, unit, metric, axisUnit, minimum, maximum, singlePoint, showMovingAverages, showDividendGrowth }: {
  data: DetailPlotRow[];
  label: string;
  unit: string;
  metric?: DetailMetric;
  axisUnit: 'day' | 'month' | 'year';
  minimum: BusinessValue;
  maximum: BusinessValue;
  singlePoint: boolean;
  showMovingAverages: boolean;
  showDividendGrowth: boolean;
}) {
  const yearEnd = metric === 'bps' && axisUnit === 'year';
  const capitalization = metric === 'marketcap' && !showMovingAverages;
  const currency = metric === 'eps' || metric === 'dps' || yearEnd;
  const financial = currency || capitalization || metric === 'per' || metric === 'pbr' || metric === 'div';
  const tick = { fill: 'var(--muted-foreground)', fontSize: financial ? 12 : 11 };
  const precision = usesInvestorPrecision(metric);
  const valueText = (value: BusinessValue) => precision ? formatInvestorAmount(value, unit) : value == null ? '—' : `${formatBusinessValue(value)}${unit}`;
  const capitalizationAxis = capitalization ? marketcapDateAxis(data.map(row => row.date)) : undefined;
  const dateLabel = (date: string) => axisUnit === 'day' ? capitalizationAxis?.formatDate(date) ?? date : axisUnit === 'year' ? date.slice(0, 4)
    : financial ? date.slice(0, 7).replace('-', '.') : date.slice(0, 7);
  const timeTicks = financial && axisUnit !== 'day' ? calendarDateTicks(data.map(row => row.date), axisUnit) : capitalizationAxis?.dateTicks;
  const formatTick = (value: BusinessValue) => capitalization ? formatMarketcapAxisTick(value)
    : precision ? formatInvestorNumber(value, unit) : currency && Math.abs(Number(value)) < 1_000_000 ? formatBusinessValue(value) : formatCompactBusinessValue(value);
  const valueAxis = financial ? readableAxis(minimum, maximum, formatTick) : undefined;
  const useTrendDots = financial && !yearEnd && metric !== 'dps';
  const lastObservedIndex = useTrendDots ? data.findLastIndex(row => row.plot != null) : -1;
  const sparse = useTrendDots && data.filter(row => row.plot != null).length <= 12;
  const trendDot = ({ index, cx, cy }: DotItemDotProps) => {
    if (data[index]?.plot == null || cx == null || cy == null) return null;
    const last = index === lastObservedIndex;
    const isolated = data[index - 1]?.plot == null && data[index + 1]?.plot == null;
    if (!sparse && !last && !isolated) return null;
    return <circle className="detail-ratio-dot" cx={cx} cy={cy} r={last ? 3 : 2} fill={last ? 'var(--background)' : 'var(--chart-2)'} stroke="var(--chart-2)" strokeWidth={1.5} />;
  };
  return <div className={capitalization ? `${styles.plot} ${styles.capitalizationPlot}` : styles.plot}>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 12, right: 10, left: 0, bottom: 4 }} accessibilityLayer>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={tick} tickFormatter={dateLabel} minTickGap={18} ticks={timeTicks} interval={financial ? 'preserveStartEnd' : undefined} />
        <YAxis
          width={currency || capitalization ? 60 : 54}
          tick={tick}
          tickFormatter={value => valueAxis?.marks.get(Number(value)) ?? formatTick(businessChartAxisValue(minimum, maximum, Number(value)))}
          domain={valueAxis?.domain ?? normalizedDomain}
          ticks={valueAxis ? [...valueAxis.marks.keys()] : normalizedTicks}
        />
        {valueAxis?.zero != null && <ReferenceLine y={valueAxis.zero} stroke="var(--input)" />}
        <Tooltip filterNull={!financial} content={({ active, payload }) => {
          const row = payload?.[0]?.payload as DetailPlotRow | undefined;
          if (!active || !row) return null;
          const heading = financial && axisUnit === 'year' && (!yearEnd || !row.yearEndComparison) ? `${dateLabel(row.date)}년`
            : financial && axisUnit === 'month' && row.plot == null ? dateLabel(row.date) : row.date;
          const annualRate = row.yearEndComparison?.changeRate;
          const annualDifference = row.yearEndComparison?.difference;
          return <div role={financial ? 'status' : undefined} className="max-w-[min(18rem,calc(100vw-3rem))] rounded-md border border-border bg-popover p-3 text-sm shadow-md">
            <p className="mb-2 text-xs text-muted-foreground">{heading}</p>
            <p>{label} <strong className="tabular-nums" title={precision && row.value != null ? `${formatBusinessValue(row.value)}${unit}` : undefined}>{row.plot == null && financial ? '미제공' : valueText(row.value)}</strong></p>
            {yearEnd && row.plot != null && (annualRate != null && Number.isFinite(annualRate)
              ? <p>전년 대비 {annualRate > 0 ? '+' : ''}{formatInvestorAmount(annualRate, '%')}</p>
              : annualDifference != null && <p>전년 대비 차이 {compareBusinessValues(annualDifference, 0) === 1 ? '+' : ''}{valueText(annualDifference)}</p>)}
            {showMovingAverages && <>
              <p>5거래일 이동평균 {valueText(row.average5Source)}</p>
              <p>10거래일 이동평균 {valueText(row.average10Source)}</p>
            </>}
            {metric === 'dps' && <>
              {row.changeSource != null ? <p>직전 제공 기록 대비 {formatInvestorAmount(row.changeSource, '%')}</p>
                : row.differenceSource != null ? <p>직전 제공 기록 대비 차이 {valueText(row.differenceSource)}</p> : null}
              {row.comparisonReason && <p className="mt-1 text-xs text-muted-foreground">{row.comparisonReason}</p>}
            </>}
            {row.providedCount != null && <p className="mt-1 text-xs text-muted-foreground">평균에 포함된 제공 관측 {row.providedCount}개</p>}
            {row.targetCount != null && <p className="mt-1 text-xs text-muted-foreground">{row.observedCount ?? 0}/{row.targetCount}개 관측{row.partial ? ' · 부분 관측' : ''}</p>}
          </div>;
        }} />
        {showDividendGrowth && <YAxis yAxisId="growth" width={45} orientation="right" tick={tick} tickFormatter={value => formatInvestorAmount(value, '%')} />}
        {singlePoint ? <Line type="linear" dataKey="plot" stroke="var(--chart-2)" dot={{ r: 4 }} isAnimationActive={false} />
          : metric === 'bps' || metric === 'dps' ? <Bar dataKey="barRange" fill="var(--chart-2)" name={label} minPointSize={2} isAnimationActive={false} />
            : (metric === 'per' || metric === 'pbr') ? <Area type="linear" dataKey="plot" stroke="var(--chart-2)" strokeWidth={2} fill="var(--chart-2)" fillOpacity={0.08} dot={trendDot} baseValue={valueAxis?.zero ?? undefined} connectNulls={false} isAnimationActive={false} />
              : <Line type="linear" dataKey="plot" stroke="var(--chart-2)" strokeWidth={2} dot={useTrendDots ? trendDot : metric !== 'marketcap' ? { r: 2 } : data.length < 25} connectNulls={false} isAnimationActive={false} />}
        {showMovingAverages && <>
          <Line type="linear" dataKey="average5" name="5거래일 이동평균" stroke="var(--brand-ink)" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="linear" dataKey="average10" name="10거래일 이동평균" stroke="var(--muted-foreground)" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
        </>}
        {showDividendGrowth && <Line yAxisId="growth" type="linear" dataKey="change" stroke="var(--chart-3)" strokeDasharray="4 3" strokeWidth={1.5} name="직전 제공 기록 대비 변화율 (%)" dot={singlePoint ? { r: 3 } : false} connectNulls={false} isAnimationActive={false} />}
      </ComposedChart>
    </ResponsiveContainer>
  </div>;
}

export type DividendComparisonSeries = {
  id: string;
  label: string;
  color: string;
  dash: string;
  selected: boolean;
  values: Record<string, { date: string; value: BusinessValue; plot: number | null }>;
};

export type DividendComparisonDifference = { id: string; label: string; value: string };

export function DividendComparisonPlot({ months, series, differences, minimum, maximum, unit }: {
  months: string[];
  series: DividendComparisonSeries[];
  differences: Record<string, DividendComparisonDifference[]>;
  minimum: BusinessValue;
  maximum: BusinessValue;
  unit: string;
}) {
  const points = months.map(month => ({ month }));
  const formatTick = (value: BusinessValue) => formatInvestorNumber(value, unit);
  const valueAxis = readableAxis(minimum, maximum, formatTick);
  const tick = { fill: 'var(--muted-foreground)', fontSize: 12 };
  return <div className={styles.plot}>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={{ top: 12, right: 16, left: 4, bottom: 4 }} accessibilityLayer>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={tick} tickFormatter={month => month.replace('-', '.')} ticks={calendarDateTicks(months, 'month')} interval="preserveStartEnd" minTickGap={18} />
        <YAxis
          width={unit === '원' ? 54 : 42}
          tick={tick}
          tickFormatter={value => valueAxis?.marks.get(Number(value)) ?? formatTick(businessChartAxisValue(minimum, maximum, Number(value)))}
          domain={valueAxis?.domain ?? normalizedDomain}
          ticks={valueAxis ? [...valueAxis.marks.keys()] : normalizedTicks}
        />
        {valueAxis?.zero != null && <ReferenceLine y={valueAxis.zero} stroke="var(--input)" />}
        <Tooltip filterNull={false} content={({ active, label }) => {
          const month = String(label ?? '');
          const monthDifferences = differences[month];
          return active && month ? <div role="status" className="max-w-[min(18rem,calc(100vw-3rem))] rounded-md border border-border bg-popover p-3 text-xs shadow-md">
            <p className="mb-2 font-medium tabular-nums">{month.replace('-', '.')}</p>
            <dl className="grid gap-2">
              {series.map(item => {
                const row = item.values[month];
                return <div key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-3" aria-current={item.selected ? true : undefined}>
                  <dt className={item.selected ? 'font-semibold' : undefined}>{item.label}</dt>
                  <dd className="tabular-nums">{row ? <><span title={`${formatBusinessValue(row.value)}${unit}`}>{formatInvestorAmount(row.value, unit)}</span> <time dateTime={row.date} className="text-muted-foreground">({row.date})</time></> : <span className="text-muted-foreground">미제공</span>}</dd>
                </div>;
              })}
            </dl>
            {monthDifferences?.length > 0 && <dl className={styles.comparisonDifferences}>
              {monthDifferences.map(({ id, label, value }) => <div key={id}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>}
          </div> : null;
        }} />
        {series.map(item => {
          const lastMonth = months.findLast(month => item.values[month]);
          const sparse = Object.keys(item.values).length <= 12;
          const dot = ({ index, cx, cy }: DotItemDotProps) => {
            if (cx == null || cy == null || item.values[months[index]]?.plot == null) return null;
            const last = months[index] === lastMonth;
            const isolated = !item.values[months[index - 1]] && !item.values[months[index + 1]];
            if (!sparse && !last && !isolated) return null;
            return <circle className="recharts-line-dot" cx={cx} cy={cy} r={last ? 3 : 2} fill={item.dash ? 'var(--background)' : item.color} stroke={item.color} strokeWidth={1.5} />;
          };
          return <Line
          key={item.id}
          name={item.label}
          type="linear"
          dataKey={(row: { month: string }) => item.values[row.month]?.plot ?? null}
          stroke={item.color}
          strokeDasharray={item.dash || undefined}
          strokeWidth={item.dash ? 1.75 : 2.75}
          dot={dot}
          connectNulls={false}
          isAnimationActive={false}
          />;
        })}
      </ComposedChart>
    </ResponsiveContainer>
  </div>;
}
