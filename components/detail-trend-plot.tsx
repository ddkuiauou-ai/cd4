'use client';

import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { businessChartAxisValue, formatBusinessValue, formatCompactBusinessValue, type BusinessValue } from '@/lib/business-analysis';
import type { DetailMetric, DetailObservation } from '@/lib/detail-presentation';

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
};

export function DetailTrendPlot({ data, label, unit, metric, minimum, maximum, singlePoint, showMovingAverages }: {
  data: DetailPlotRow[];
  label: string;
  unit: string;
  metric?: DetailMetric;
  minimum: BusinessValue;
  maximum: BusinessValue;
  singlePoint: boolean;
  showMovingAverages: boolean;
}) {
  const tick = { fill: 'var(--muted-foreground)', fontSize: 11 };
  const valueText = (value: BusinessValue) => value == null ? '—' : `${formatBusinessValue(value)}${unit}`;
  return <div className="h-[280px] w-full min-w-0 sm:h-[320px]">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 12, right: 10, left: 0, bottom: 12 }} accessibilityLayer>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={tick} tickFormatter={date => String(date).slice(0, 7)} minTickGap={26} />
        <YAxis
          width={metric === 'dps' ? 42 : 54}
          tick={tick}
          tickFormatter={value => formatCompactBusinessValue(businessChartAxisValue(minimum, maximum, Number(value)))}
          domain={[0, 1]}
          ticks={[0, .25, .5, .75, 1]}
        />
        <Tooltip content={({ active, payload }) => {
          const row = payload?.[0]?.payload as DetailPlotRow | undefined;
          return active && row ? <div className="max-w-[min(18rem,calc(100vw-3rem))] rounded-md border border-border bg-popover p-3 text-sm shadow-md">
            <p className="mb-2 text-xs text-muted-foreground">{row.date}</p>
            <p>{label} <strong className="tabular-nums">{valueText(row.value)}</strong></p>
            {showMovingAverages && <>
              <p>5거래일 이동평균 {valueText(row.average5Source)}</p>
              <p>10거래일 이동평균 {valueText(row.average10Source)}</p>
            </>}
            {metric === 'dps' && <>
              {row.changeSource != null ? <p>직전 제공 기록 대비 {formatBusinessValue(row.changeSource)}%</p>
                : row.differenceSource != null ? <p>직전 제공 기록 대비 차이 {valueText(row.differenceSource)}</p> : null}
              {row.comparisonReason && <p className="mt-1 text-xs text-muted-foreground">{row.comparisonReason}</p>}
            </>}
            {row.providedCount != null && <p className="mt-1 text-xs text-muted-foreground">평균에 포함된 제공 관측 {row.providedCount}개</p>}
            {row.targetCount != null && <p className="mt-1 text-xs text-muted-foreground">{row.observedCount ?? 0}/{row.targetCount}개 관측{row.partial ? ' · 부분 관측' : ''}</p>}
          </div> : null;
        }} />
        {metric === 'dps' && <YAxis yAxisId="growth" width={45} orientation="right" tick={tick} tickFormatter={value => `${value}%`} />}
        {singlePoint ? <Line type="linear" dataKey="plot" stroke="var(--chart-2)" dot={{ r: 4 }} isAnimationActive={false} />
          : metric === 'bps' || metric === 'dps' ? <Bar dataKey="barRange" fill="var(--chart-2)" name={label} minPointSize={2} isAnimationActive={false} />
            : metric === 'per' ? <Area type="linear" dataKey="plot" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.12} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
              : <Line type="linear" dataKey="plot" stroke="var(--chart-2)" strokeWidth={2} dot={metric !== 'marketcap' ? { r: 2 } : data.length < 25} connectNulls={false} isAnimationActive={false} />}
        {showMovingAverages && <>
          <Line type="linear" dataKey="average5" name="5거래일 이동평균" stroke="var(--brand-ink)" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="linear" dataKey="average10" name="10거래일 이동평균" stroke="var(--muted-foreground)" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
        </>}
        {metric === 'dps' && <Line yAxisId="growth" type="linear" dataKey="change" stroke="var(--chart-3)" name="직전 제공 기록 대비 (%)" dot={false} connectNulls={false} isAnimationActive={false} />}
      </ComposedChart>
    </ResponsiveContainer>
  </div>;
}

export type DividendComparisonSeries = {
  id: string;
  label: string;
  color: string;
  dash: string;
  values: Record<string, { date: string; value: BusinessValue; plot: number | null }>;
};

export function DividendComparisonPlot({ months, series, minimum, maximum, unit }: {
  months: string[];
  series: DividendComparisonSeries[];
  minimum: BusinessValue;
  maximum: BusinessValue;
  unit: string;
}) {
  const points = months.map(month => ({ month }));
  return <div className="h-[280px] w-full min-w-0 sm:h-[320px]">
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={{ top: 12, right: 16, left: 4, bottom: 12 }} accessibilityLayer>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} minTickGap={30} />
        <YAxis
          width={52}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
          tickFormatter={value => formatCompactBusinessValue(businessChartAxisValue(minimum, maximum, Number(value)))}
          domain={[0, 1]}
          ticks={[0, .25, .5, .75, 1]}
        />
        <Tooltip filterNull={false} content={({ active, label }) => {
          const month = String(label ?? '');
          return active && month ? <div className="max-w-[min(18rem,calc(100vw-3rem))] rounded-md border border-border bg-popover p-3 text-xs shadow-md">
            <p className="mb-2 font-medium tabular-nums">{month}</p>
            <dl className="grid gap-2">
              {series.map(item => {
                const row = item.values[month];
                return <div key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt>{item.label}</dt>
                  <dd className="tabular-nums">{row ? <>{formatBusinessValue(row.value)}{unit} <span className="text-muted-foreground">({row.date})</span></> : <span className="text-muted-foreground">미제공</span>}</dd>
                </div>;
              })}
            </dl>
          </div> : null;
        }} />
        {series.map(item => <Line
          key={item.id}
          name={item.label}
          type="linear"
          dataKey={(row: { month: string }) => item.values[row.month]?.plot ?? null}
          stroke={item.color}
          strokeDasharray={item.dash || undefined}
          strokeWidth={2}
          dot={{ r: 2, strokeWidth: 1 }}
          connectNulls={false}
          isAnimationActive={false}
        />)}
      </ComposedChart>
    </ResponsiveContainer>
  </div>;
}
