"use client";
import { lazy, useMemo, useState, type ReactNode } from 'react';
import type { DetailCompanyData, DetailSecurityRow } from './detail-types';
import { ChartWhenVisible } from './detail-chart-visibility';
import { DetailChartSkeleton } from './detail-record-skeleton';
import { DetailCompanyHistoryObservation } from './detail-company-history-observation';
import { createMarketcapSeries, marketcapDateAxis, type MarketcapChartPoint } from '@/lib/chart-selection';
import { earlierDate, type DetailObservation } from '@/lib/detail-presentation';
import { projectBusinessChartRows, businessChartAxisValue, formatBusinessValue, formatCompactBusinessValue, formatMarketcapAmount, type BusinessValue } from '@/lib/business-analysis';
import { isMarketcapMonthly, lastMonthlyObservations, marketcapPeriodMonths } from './detail-chart-observations';
import styles from './detail-chart.module.css';
import { MarketcapRangeControls, useMarketcapChartRange } from './marketcap-chart-range';

const ChartCompanyMarketcap = lazy(() => import('./chart-company-marketcap'));
const ChartMarketcap = lazy(() => import('./chart-marketcap'));
const totalLabel = '등록 종목 합계';
const hasCoverage = (row: { observedCount?: number; targetCount?: number }): row is { observedCount: number; targetCount: number } =>
  Number.isInteger(row.observedCount) && Number.isInteger(row.targetCount);

export type RegisteredMarketcapDisplay = {
  minimum: BusinessValue;
  maximum: BusinessValue;
  dateTicks?: string[];
  formatDate: (date: string) => string;
  renderObservation: (date: string) => ReactNode;
  annotation?: { date: string; plot: number; label: string };
};

export function InteractiveChartSection({ companyMarketcapData, type, selectedSecurityId, selectedType = '시가총액 구성', start, end, unified }: {
  companyMarketcapData: DetailCompanyData; companySecs: DetailSecurityRow[]; type: 'summary' | 'detailed';
  selectedSecurityId?: string; selectedType?: string; selectedTicker?: string; onTickerChange?: (value: string) => void; start?: string; end?: string;
  unified?: { rows: DetailObservation[]; selectedLabel: string; initialRange?: string };
}) {
  const [legacyPeriod, setPeriod] = useState('5Y');
  const range = useMarketcapChartRange('capRange', unified?.initialRange);
  const period = unified ? range.period : legacyPeriod;
  const summary = type === 'summary';
  const customRange = Boolean(start || end);
  const preset = summary && !customRange;
  const monthly = preset && isMarketcapMonthly(period);
  const memberSeries = useMemo(() => createMarketcapSeries(companyMarketcapData?.securities ?? []), [companyMarketcapData]);
  const compareMembers = memberSeries.length > 1 && (!selectedSecurityId || memberSeries.some(item => item.securityId === selectedSecurityId));
  const series = unified && !compareMembers ? [] : memberSeries;
  const single = unified && !compareMembers;
  const totalSeriesLabel = unified ? single ? unified.selectedLabel : '기업 합산' : totalLabel;
  const activeSecurityId = single ? undefined : selectedSecurityId;
  const input = single ? unified.rows.map(row => ({
    date: row.date, totalMarketcap: !row.state || row.state === 'provided' ? row.value : null,
    securitiesBreakdown: {} as Record<string, BusinessValue>, observedCount: undefined, targetCount: undefined,
  })) : companyMarketcapData?.aggregatedHistory ?? [];
  const all = [...input].sort((a,b) => a.date.localeCompare(b.date));
  const last = end || all.at(-1)?.date || '';
  const cutoff = start || (preset && marketcapPeriodMonths[period] ? earlierDate(last, marketcapPeriodMonths[period]) : '');
  const selected = all.filter(row => (!cutoff || row.date >= cutoff) && (!end || row.date <= end));
  const monthlyDates = monthly ? new Set([...lastMonthlyObservations(selected.map(row => ({ date: row.date, value: row.totalMarketcap }))).values()]
    .map(row => row.date)) : null;
  const history = monthlyDates ? selected.filter(row => monthlyDates.has(row.date)) : selected;
  const controls = summary && all.length > 0 && !customRange && <MarketcapRangeControls label="시가총액 차트 범위"
    period={period} select={unified ? range.select : setPeriod} />;
  if (!history.length) return <div>{controls}<p className={styles.empty} role="status">표시할 시가총액 관측이 없습니다.</p></div>;
  if (history.length === 1 && companyMarketcapData && !single) return <div>{controls}
    <DetailCompanyHistoryObservation data={companyMarketcapData} observation={history[0] as typeof companyMarketcapData.aggregatedHistory[number]} count={1} selectedSecurityId={selectedSecurityId} />
  </div>;

  const plottedSeries = summary && !unified ? [] : series;
  const keys = ['총합계', ...plottedSeries.map(item => item.key)];
  const partialRow = (row: typeof history[number]) => hasCoverage(row) && row.observedCount < row.targetCount;
  const fullTotal = (row: typeof history[number]) => unified && partialRow(row) ? null : row.totalMarketcap;
  const observations = history.flatMap(row => [fullTotal(row), ...plottedSeries.map(item => row.securitiesBreakdown[item.securityId] ?? null)]
    .map(value => ({ date: row.date, value })));
  const domain = projectBusinessChartRows(observations);
  const points: MarketcapChartPoint[] = history.map((row, index) => ({ date: row.date,
    ...Object.fromEntries(keys.map((key, column) => [key, domain.rows[index * keys.length + column].plot])),
  }));
  const observationsByDate = new Map(history.map(row => [row.date, row]));
  const firstDate = history[0].date;
  const lastDate = history.at(-1)!.date;
  const latestValue = history.findLast(row => row.totalMarketcap != null);
  const activeKey = plottedSeries.find(item => item.securityId === activeSecurityId)?.key ?? '총합계';
  const activeIndex = keys.indexOf(activeKey);
  const lastActive = points.findLastIndex(row => row[activeKey] != null);
  const activeObservation = lastActive < 0 ? undefined : observations[lastActive * keys.length + activeIndex];
  const registeredHistory: RegisteredMarketcapDisplay = {
    minimum: domain.min,
    maximum: domain.max,
    ...marketcapDateAxis(history.map(row => row.date)),
    ...(monthly ? { formatDate: (date: string) => date.slice(0, 7).replace('-', '.') } : {}),
    annotation: unified && activeObservation ? { date: activeObservation.date, plot: Number(points[lastActive][activeKey]),
      label: `${unified.selectedLabel} ${formatMarketcapAmount(activeObservation.value)}` } : undefined,
    renderObservation: date => {
      const row = observationsByDate.get(date);
      if (!row) return null;
      const rows = [
        { key: '총합계', label: unified && partialRow(row) ? '등록 종목 부분합' : totalSeriesLabel, value: row.totalMarketcap, selected: !activeSecurityId },
        ...series.map(item => ({ key: item.key, label: item.label, value: row.securitiesBreakdown[item.securityId], selected: item.securityId === selectedSecurityId })),
      ];
      return <div className={styles.marketcapTooltip} role="status">
        <time dateTime={date}>{date}</time>
        {hasCoverage(row) && <p>{row.observedCount}/{row.targetCount}개 종목 관측{row.observedCount > 0 && row.observedCount < row.targetCount ? ' · 부분 관측' : ''}</p>}
        <dl>{rows.map(({ key, label, value, selected }) => <div key={key} aria-current={selected ? true : undefined}>
          <dt>{label}</dt><dd>{value == null ? '미관측' : `${formatBusinessValue(value)}원`}</dd>
        </div>)}</dl>
      </div>;
    },
  };
  const partial = history.filter(row => hasCoverage(row) && row.observedCount > 0 && row.observedCount < row.targetCount).length;
  const missing = history.filter(row => row.totalMarketcap == null && series.every(item => row.securitiesBreakdown[item.securityId] == null)).length;
  const Chart = summary && !unified ? ChartCompanyMarketcap : ChartMarketcap;
  return <div className={styles.history}>
    {controls}
    {domain.min == null ? <p className={styles.empty} role="status">표시할 시가총액 관측이 없습니다.</p> : <figure className={styles.figure}>
      <p className={styles.caption}>단위 원{monthly && ' · 월별 마지막 관측'}{!single && ' · 등록 종목 합계는 날짜별 관측값의 합계'}</p>
      <div role="group" aria-label="등록 시가총액 차트. 좌우 방향키로 관측값을 확인할 수 있습니다.">
        <ChartWhenVisible fallback={<DetailChartSkeleton variant="marketcap" marketcapScope={summary ? 'company' : 'comparison'} label="시가총액 차트" plotOnly />}>
          <Chart data={points} format="formatNumber" formatTooltip="formatNumberTooltip" series={plottedSeries} selectedSecurityId={activeSecurityId}
            selectedType={single ? '시가총액 구성' : selectedType} totalLabel={totalSeriesLabel} registeredHistory={registeredHistory}
            axisFormat={value => formatCompactBusinessValue(businessChartAxisValue(domain.min, domain.max, value))} />
        </ChartWhenVisible>
      </div>
      {unified && activeObservation ? <p className={styles.marketcapReadout}><time dateTime={activeObservation.date}>{activeObservation.date}</time>
        <span>{unified.selectedLabel}</span><strong>{formatMarketcapAmount(activeObservation.value)}</strong></p>
        : !unified && summary && latestValue && <p className={styles.marketcapReadout}><time dateTime={latestValue.date}>{latestValue.date}</time>
          <strong>{formatMarketcapAmount(latestValue.totalMarketcap)}</strong></p>}
      <figcaption className={styles.caption}>{firstDate} ~ {lastDate} · {(history.length - missing).toLocaleString('ko-KR')}일 관측
        {partial > 0 && ` · 부분 관측 ${partial.toLocaleString('ko-KR')}일`}{missing > 0 && ` · 미관측 ${missing.toLocaleString('ko-KR')}일`}
      </figcaption>
    </figure>}
  </div>;
}
