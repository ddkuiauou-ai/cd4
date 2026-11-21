"use client";
import { lazy, useMemo, useState, type ReactNode } from 'react';
import type { DetailCompanyData, DetailSecurityRow } from './detail-types';
import { ChartWhenVisible } from './detail-chart-visibility';
import { DetailChartSkeleton } from './detail-record-skeleton';
import { DetailCompanyHistoryObservation } from './detail-company-history-observation';
import { createMarketcapSeries, marketcapDateAxis } from '@/lib/chart-selection';
import { earlierDate } from '@/lib/detail-presentation';
import { projectBusinessChartRows, businessChartAxisValue, formatBusinessValue, formatCompactBusinessValue, formatMarketcapAmount, type BusinessValue } from '@/lib/business-analysis';
import { isMarketcapMonthly, lastMonthlyObservations, marketcapPeriodMonths, marketcapPeriods } from './detail-chart-observations';
import styles from './detail-chart.module.css';

const ChartCompanyMarketcap = lazy(() => import('./chart-company-marketcap'));
const ChartMarketcap = lazy(() => import('./chart-marketcap'));
const totalLabel = '등록 종목 합계';
const hasCoverage = (row: { observedCount?: number; targetCount?: number }) => Number.isInteger(row.observedCount) && Number.isInteger(row.targetCount);

export type RegisteredMarketcapDisplay = {
  minimum: BusinessValue;
  maximum: BusinessValue;
  dateTicks?: string[];
  formatDate: (date: string) => string;
  renderObservation: (date: string) => ReactNode;
};

export function InteractiveChartSection({ companyMarketcapData, type, selectedSecurityId, selectedType = '시가총액 구성', start, end }: {
  companyMarketcapData: DetailCompanyData; companySecs: DetailSecurityRow[]; type: 'summary' | 'detailed';
  selectedSecurityId?: string; selectedType?: string; selectedTicker?: string; onTickerChange?: (value: string) => void; start?: string; end?: string;
}) {
  const [period, setPeriod] = useState('5Y');
  const summary = type === 'summary';
  const customRange = Boolean(start || end);
  const preset = summary && !customRange;
  const monthly = preset && isMarketcapMonthly(period);
  const series = useMemo(() => createMarketcapSeries(companyMarketcapData?.securities ?? []), [companyMarketcapData]);
  const all = [...(companyMarketcapData?.aggregatedHistory ?? [])].sort((a,b) => a.date.localeCompare(b.date));
  const last = end || all.at(-1)?.date || '';
  const cutoff = start || (preset && marketcapPeriodMonths[period] ? earlierDate(last, marketcapPeriodMonths[period]) : '');
  const selected = all.filter(row => (!cutoff || row.date >= cutoff) && (!end || row.date <= end));
  const monthlyDates = monthly ? new Set([...lastMonthlyObservations(selected.map(row => ({ date: row.date, value: row.totalMarketcap }))).values()]
    .map(row => row.date)) : null;
  const history = monthlyDates ? selected.filter(row => monthlyDates.has(row.date)) : selected;
  const controls = summary && all.length > 0 && !customRange && <div className={styles.controls}>
    <span className={styles.choiceCaption} aria-hidden="true">기간</span>
    <div className={styles.choices} role="group" aria-label="시가총액 차트 범위">
      {marketcapPeriods.map(([key, label]) => <button key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)}>{label}</button>)}
    </div>
  </div>;
  if (!history.length) return <div>{controls}<p className={styles.empty} role="status">표시할 시가총액 관측이 없습니다.</p></div>;
  if (history.length === 1 && companyMarketcapData) return <div>{controls}
    <DetailCompanyHistoryObservation data={companyMarketcapData} observation={history[0]} count={1} selectedSecurityId={selectedSecurityId} />
  </div>;

  const plottedSeries = summary ? [] : series;
  const keys = ['총합계', ...plottedSeries.map(item => item.key)];
  const observations = history.flatMap(row => [row.totalMarketcap, ...plottedSeries.map(item => row.securitiesBreakdown[item.securityId] ?? null)]
    .map(value => ({ date: row.date, value })));
  const domain = projectBusinessChartRows(observations);
  const points = history.map((row, index) => ({ date: row.date, ...Object.fromEntries(keys.map((key, column) => [key, domain.rows[index * keys.length + column].plot])) }));
  const observationsByDate = new Map(history.map(row => [row.date, row]));
  const firstDate = history[0].date;
  const lastDate = history.at(-1)!.date;
  const latestValue = history.findLast(row => row.totalMarketcap != null);
  const registeredHistory: RegisteredMarketcapDisplay = {
    minimum: domain.min,
    maximum: domain.max,
    ...marketcapDateAxis(history.map(row => row.date)),
    ...(monthly ? { formatDate: (date: string) => date.slice(0, 7).replace('-', '.') } : {}),
    renderObservation: date => {
      const row = observationsByDate.get(date);
      if (!row) return null;
      const rows = [
        { key: '총합계', label: totalLabel, value: row.totalMarketcap, selected: !selectedSecurityId },
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
  const Chart = summary ? ChartCompanyMarketcap : ChartMarketcap;
  return <div className={styles.history}>
    {controls}
    {domain.min == null ? <p className={styles.empty} role="status">표시할 시가총액 관측이 없습니다.</p> : <figure className={styles.figure}>
      <p className={styles.caption}>단위 원 · {monthly ? '월별 마지막 관측 · ' : ''}등록 종목 합계는 날짜별 관측값의 합계</p>
      <div role="group" aria-label="등록 시가총액 차트. 좌우 방향키로 관측값을 확인할 수 있습니다.">
        <ChartWhenVisible fallback={<DetailChartSkeleton variant="marketcap" marketcapScope={summary ? 'company' : 'comparison'} label="시가총액 차트" plotOnly />}>
          <Chart data={points} format="formatNumber" formatTooltip="formatNumberTooltip" series={plottedSeries} selectedSecurityId={selectedSecurityId}
            selectedType={selectedType} totalLabel={totalLabel} registeredHistory={registeredHistory}
            axisFormat={value => formatCompactBusinessValue(businessChartAxisValue(domain.min, domain.max, value))} />
        </ChartWhenVisible>
      </div>
      {summary && latestValue && <p className={styles.marketcapReadout}><time dateTime={latestValue.date}>{latestValue.date}</time>
        <strong>{formatMarketcapAmount(latestValue.totalMarketcap)}</strong></p>}
      <figcaption className={styles.caption}>{firstDate} ~ {lastDate} · {(history.length - missing).toLocaleString('ko-KR')}일 관측
        {partial > 0 && ` · 부분 관측 ${partial.toLocaleString('ko-KR')}일`}{missing > 0 && ` · 미관측 ${missing.toLocaleString('ko-KR')}일`}
      </figcaption>
    </figure>}
  </div>;
}
