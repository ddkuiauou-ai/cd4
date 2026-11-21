"use client";

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { compareBusinessValues, formatBusinessValue, summarizeBusinessWindow, type BusinessValue } from '@/lib/business-analysis';
import type { AnnualComparisonReason } from '@/lib/detail-presentation';
import { formatInvestorAmount } from '@/lib/investor-number';
import { DetailRecordInfo } from './detail-record-info';
import styles from './detail-annual-table.module.css';

interface AnnualRow { date: string; value: BusinessValue; changeRate?: number; difference?: string; comparisonReason?: AnnualComparisonReason; observedCount?: number; targetCount?: number; yearToDate?: boolean; yearEnd?: boolean; }
export type AnnualDividendComparison = {
    commonName: string;
    pairs: Array<{ securityId: string; label: string }>;
    byDate: Record<string, Record<string, string | null>>;
};
type DividendComparison = AnnualDividendComparison & { unit: '원' | '%p' };
const annualDifferenceUnit = { per: '배', pbr: '배', eps: '원', bps: '원', dps: '원', div: '%p' } as const;
type FinancialMetric = keyof typeof annualDifferenceUnit;
const comparisonReasons: Record<AnnualComparisonReason, string> = {
    no_previous_year: '전년 관측값이 없습니다.',
    non_adjacent_year: '인접한 전년 관측값이 없어 비교할 수 없습니다.',
    missing_previous: '전년 값이 미제공이라 비교할 수 없습니다.',
    missing_current: '현재 값이 미제공이라 비교할 수 없습니다.',
    cohort_changed: '관측 종목이 달라 비교할 수 없습니다.',
    non_positive_previous: '이전 값이 0/음수라 증감률 계산 불가',
};

function hasAnnualDividendGaps<T extends AnnualDividendComparison>(comparison: T | undefined): comparison is T {
    return Boolean(comparison && Object.values(comparison.byDate).some(values =>
        comparison.pairs.some(pair => values[pair.securityId] != null)));
}

export function FinancialAnnualMetadata({ count, dividendComparison, yearEndOnly = false }: {
    count: number; dividendComparison?: AnnualDividendComparison; yearEndOnly?: boolean;
}) {
    const gapHelp = hasAnnualDividendGaps(dividendComparison)
        ? ` 각 우선주 값에서 ${dividendComparison.commonName} 값을 뺀 차이는 최근 5년 중 같은 날의 관측값이 있을 때 표시합니다.`
        : '';
    const observationHelp = yearEndOnly
        ? '12월 관측이 있는 연도마다 12월 마지막 관측값을 표시합니다. 그날 값이 비어 있으면 미제공으로 표시합니다.'
        : '각 연도의 마지막 관측값입니다. ‘연중’은 한 해가 끝나기 전의 값입니다.';
    return <div className={styles.headerMetadata}>
        <span>{count}개 연도</span>
        <DetailRecordInfo label={`${yearEndOnly ? '연말' : '연도별'} 기록의 관측·비교 기준`}
            text={observationHelp + ' 전년 대비는 인접한 전년 관측값과의 변화율(%)입니다.' + gapHelp} />
    </div>;
}

type AnnualTableProps = {
    rows: AnnualRow[]; label: string; formatValue: (value: BusinessValue) => string; formatDetailValue: (value: BusinessValue) => string;
    yearEndOnly?: boolean; layout?: 'ratio' | 'per-share' | 'marketcap'; dividendComparison?: DividendComparison; financialMetric?: FinancialMetric;
};

function AnnualRecordValue({ label, value, exact, reason }: { label: string; value: string; exact?: string; reason?: string }) {
    const exactText = exact && exact !== value ? `원값 ${exact}` : null;
    const details = [reason, exactText].filter(Boolean).join(' ');
    return details ? <DetailRecordInfo label={`${label} ${value}`} text={details}>{value}</DetailRecordInfo> : value;
}

function exactSignedAmount(value: BusinessValue, unit: string) {
    const sign = compareBusinessValues(value, 0);
    const amount = formatBusinessValue(value).replace(/^-/, '−');
    return sign == null ? '—' : `${sign > 0 ? '+' : ''}${amount}${unit}`;
}

const changeClass = (rate: number | undefined) => rate != null && Number.isFinite(rate)
    ? rate > 0 ? 'market-up' : rate < 0 ? 'market-down' : 'text-muted-foreground' : 'text-muted-foreground';

function FinancialAnnualTable({ rows, label, formatValue, formatDetailValue, yearEndOnly, financialMetric, dividendComparison: comparison }: AnnualTableProps & { financialMetric: FinancialMetric }) {
    const dividendComparison = hasAnnualDividendGaps(comparison) ? comparison : undefined;
    const summary = summarizeBusinessWindow(rows);
    const rates = rows.flatMap(row => row.changeRate != null && Number.isFinite(row.changeRate) ? [row.changeRate] : []);
    const rising = rates.filter(rate => rate > 0).length;
    const falling = rates.filter(rate => rate < 0).length;
    const statistics = [
        ['평균', formatValue(summary.mean)], ['최저', formatValue(summary.min)], ['최고', formatValue(summary.max)], ['상승 · 하락 연도', `${rising}년 · ${falling}년`],
    ];
    const statisticsList = <dl className={cn(styles.annualStatistics, financialMetric === 'pbr' && styles.statisticsAbove)} aria-label="표에 표시한 관측의 통계">
        {statistics.map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
    </dl>;
    return <div className="detail-annual-data">
        {financialMetric === 'pbr' && statisticsList}
        <table className={cn(styles.annualTable, dividendComparison && styles.withDividendComparison)}>
            <caption className="sr-only">{yearEndOnly ? '연말' : '연도별'} {label} 및 전년 대비 변화율·값 차이</caption>
            <thead><tr>
                <th scope="col">연도 / 관측일</th>
                <th scope="col">{label}</th>
                <th scope="col">전년 대비</th>
                {dividendComparison && <th scope="col">우선주 − 보통주 <small>{dividendComparison.unit}</small></th>}
            </tr></thead>
            <tbody>{rows.map(row => {
                const year = row.date.slice(0, 4);
                const difference = row.comparisonReason === 'non_positive_previous' ? row.difference : undefined;
                const unit = annualDifferenceUnit[financialMetric];
                const change = difference ?? row.changeRate;
                const changeUnit = difference != null ? unit : '%';
                const exactChange = exactSignedAmount(change ?? null, changeUnit);
                const exactPerShareDifference = difference != null && (financialMetric === 'eps' || financialMetric === 'bps');
                const changeValue = exactPerShareDifference ? exactChange : formatInvestorAmount(change, changeUnit, true);
                const reason = row.comparisonReason === 'non_positive_previous'
                    ? '전년 값이 0 이하라 변화율을 계산할 수 없어 값 차이를 표시합니다.'
                    : row.comparisonReason ? comparisonReasons[row.comparisonReason] : undefined;
                return <tr key={row.date}>
                    <th scope="row">{year}{!yearEndOnly && row.yearToDate && <span className={styles.annualYearToDate}>연중</span>}
                        <time dateTime={row.date}>{row.date}</time>
                    </th>
                    <td className={styles.annualMetricValue}><AnnualRecordValue label={`${year}년 ${label}`}
                        value={formatValue(row.value)} exact={formatDetailValue(row.value).replace(/^-/, '−')}
                        reason={row.value == null ? (yearEndOnly ? '마지막 12월 관측일의 값이 미제공입니다.' : '관측값 미제공') : undefined} />
                        {row.observedCount != null && <small className={styles.annualCoverage}>
                            {row.observedCount}{row.targetCount != null && `/${row.targetCount}`}개 관측
                        </small>}
                    </td>
                    <td className={changeClass(compareBusinessValues(change ?? null, 0) ?? undefined)}>
                        {reason ? <AnnualRecordValue label={`${year}년 ${difference != null ? '전년 값 차이' : '전년 대비'}`}
                            value={changeValue} exact={exactChange} reason={reason} />
                            : <span title={changeValue === exactChange ? undefined : exactChange}>{changeValue}</span>}
                    </td>
                    {dividendComparison && <td data-annual-dividend-difference>
                        <dl className={styles.dividendDifferences}>
                            {dividendComparison.pairs.map(({ securityId, label: preferredName }) => {
                                const gap = dividendComparison.byDate[row.date]?.[securityId] ?? null;
                                return <div key={securityId} data-security-id={securityId}>
                                    <dt className={dividendComparison.pairs.length === 1 ? 'sr-only' : styles.preferredName}>{preferredName}</dt>
                                    <dd>{gap == null ? <><span aria-hidden="true">—</span><span className="sr-only">같은 날 비교값 없음</span></>
                                        : <AnnualRecordValue label={`${year}년 ${preferredName} − ${dividendComparison.commonName}`}
                                            value={formatInvestorAmount(gap, dividendComparison.unit, true)}
                                            exact={exactSignedAmount(gap, dividendComparison.unit)} />}</dd>
                                </div>;
                            })}
                        </dl>
                    </td>}
                </tr>;
            })}</tbody>
        </table>
        {financialMetric !== 'pbr' && statisticsList}
    </div>;
}

export function DetailAnnualTable(props: AnnualTableProps) {
    const { rows, label, yearEndOnly, financialMetric, layout } = props;
    if (!rows.length) return <p className="border-y border-border py-8 text-sm text-muted-foreground">{yearEndOnly ? '연말 기준' : '연도별'} {label} 데이터가 없습니다.</p>;
    if (layout === 'marketcap') return <MarketcapAnnualTable {...props} />;
    return financialMetric ? <FinancialAnnualTable {...props} financialMetric={financialMetric} /> : <StandardAnnualTable {...props} />;
}

function MarketcapAnnualTable({ rows, label, formatValue, formatDetailValue }: AnnualTableProps) {
    const company = label === '등록 종목 합계';
    return <div className="detail-annual-data">
        <table className={cn(styles.annualTable, styles.marketcapTable)}>
            <caption className="sr-only">연도별 {label} 및 전년 대비 변화율
                {company && ' · 각 관측일에 값이 있는 등록 종목을 합산합니다.'}</caption>
            <thead><tr>
                <th scope="col">연도 / 관측일</th><th scope="col">{label}</th><th scope="col">전년 대비</th>
            </tr></thead>
            <tbody>{rows.map(row => {
                const year = row.date.slice(0, 4);
                const value = formatValue(row.value);
                const exact = formatDetailValue(row.value);
                const rate = row.changeRate != null && Number.isFinite(row.changeRate) ? row.changeRate : null;
                const rateLabel = rate == null ? '—' : `${rate > 0 ? '+' : ''}${rate.toFixed(1)}%`;
                const reason = row.comparisonReason ? comparisonReasons[row.comparisonReason] : undefined;
                const coverage = company && row.observedCount != null
                    ? `${row.observedCount}${row.targetCount != null ? `/${row.targetCount}` : ''}개 관측${row.targetCount != null &&
                        row.observedCount > 0 && row.observedCount < row.targetCount ? ' · 일부' : ''}` : null;
                return <tr key={row.date}>
                    <th scope="row">{year}{row.yearToDate && <span className={styles.annualYearToDate}>연중</span>}
                        <time dateTime={row.date}>{row.date}</time>
                    </th>
                    <td className={styles.annualMetricValue}>
                        {value === exact ? value : <details className={styles.exactMarketcap}>
                            <summary>{value}</summary><small>정확 금액 <strong>{exact}</strong></small>
                        </details>}
                        {coverage && <small className={styles.annualCoverage}>{coverage}</small>}
                    </td>
                    <td className={changeClass(row.changeRate)}>
                        {reason ? <AnnualRecordValue label={`${year}년 전년 대비`} value={rateLabel}
                            reason={row.difference == null ? reason : `${reason} 값 차이 ${exactSignedAmount(row.difference, '원')}`} /> : rateLabel}
                    </td>
                </tr>;
            })}</tbody>
        </table>
    </div>;
}

function StandardAnnualTable({ rows, label, formatValue, formatDetailValue, yearEndOnly = false, layout }: AnnualTableProps) {
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const compact = layout != null;
    const summaryAbove = layout === 'ratio';
    const perShare = layout === 'per-share';
    const exactDisplay = perShare;
    const year = (date: string) => date.slice(0, 4);
    const coverage = rows.some(row => row.targetCount != null);
    const coverageLabel = ({ observedCount, targetCount }: AnnualRow) => coverage ? `${observedCount ?? 0}/${targetCount ?? 0}개 관측` : null;
    const changeLabel = (rate: number | undefined) => rate != null && Number.isFinite(rate)
        ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)}%` : '—';
    const differenceLabel = (difference: string) => `${compareBusinessValues(difference, 0) === 1 ? '+' : ''}${formatDetailValue(difference)}`;
    let statistics: ReactNode = null;
    if (!perShare) {
        const summary = summarizeBusinessWindow(rows);
        const rates = rows.filter(row => row.changeRate != null && Number.isFinite(row.changeRate));
        const counts = ['상승 · 하락 연도', `${rates.filter(row => row.changeRate! > 0).length}년 · ${rates.filter(row => row.changeRate! < 0).length}년`];
        const terms = summaryAbove
            ? [['평균', summary.mean], ['최저', summary.min], ['최고', summary.max]] as const
            : [[yearEndOnly ? '연말 평균' : '연도별 평균', summary.mean], [yearEndOnly ? '연말 최고' : '연도별 최고', summary.max],
                [yearEndOnly ? '연말 최저' : '연도별 최저', summary.min]] as const;
        statistics = <dl className={summaryAbove ? styles.statistics : 'grid grid-cols-2 gap-4 border-b border-border pb-5 text-sm sm:grid-cols-4'}>
            {[...terms.map(([term, value]) => [term, formatValue(value)]), counts].map(([term, value]) => <div key={term}>
                <dt className={cn('text-xs text-muted-foreground', !summaryAbove && 'mb-2')}>{term}</dt>
                <dd className="font-medium tabular-nums">{value}</dd>
            </div>)}
        </dl>;
    }
    const comparisonDateLabel = compact ? '관측일' : '기준일';
    const yearToDateLabel = compact ? '연중' : '연중(YTD)';
    return <div className={cn('detail-annual-data', compact ? styles.compact : 'space-y-5', perShare && styles.perShare)}>
        <p className="text-xs text-muted-foreground">{yearEndOnly ? '각 연도의 마지막 12월 관측값' : '각 연도의 마지막 관측값'} · {rows.length}개 연도</p>
        {summaryAbove && statistics}
        <div className="hidden overflow-x-auto sm:block">
            <table className={cn('w-full text-sm tabular-nums', compact && styles.table)}>
                <caption className="sr-only">{perShare ? `${yearEndOnly ? '연말' : '연도별'} ${label} 및 전년 대비 변화율` : `연도별 ${label}과 전년 대비 변화율`}</caption>
                <thead><tr className="border-y border-border">
                    <th scope="col" className="py-3 text-left font-medium text-muted-foreground">연도</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">{label}</th>
                    <th scope="col" className="py-3 text-right font-medium text-muted-foreground">전년 대비</th>
                    <th scope="col" className="py-3 pl-4 text-right font-medium text-muted-foreground">{comparisonDateLabel}</th>
                </tr></thead>
                <tbody>{rows.map(row => {
                    const value = formatValue(row.value);
                    const exact = formatDetailValue(row.value);
                    const hasExtraPrecision = value !== exact;
                    const observations = coverageLabel(row);
                    return <tr key={row.date} className="border-b border-border hover:bg-muted/30">
                        <th scope="row" className="py-4 text-left font-medium">{year(row.date)}{row.yearToDate && <span className="ml-2 text-xs text-muted-foreground">{yearToDateLabel}</span>}</th>
                        <td className="px-4 py-4 text-right font-semibold"><span>{value}</span>
                            {hasExtraPrecision && <span className="mt-1 block text-xs font-normal text-muted-foreground">{exact}</span>}
                            {observations && <span className="mt-1 block text-xs font-normal text-muted-foreground">{observations}</span>}
                        </td>
                        <td className={cn('py-4 text-right', changeClass(row.changeRate))}>
                            <span>{changeLabel(row.changeRate)}</span>
                            {row.difference != null && <span className="mt-1 block text-xs text-muted-foreground">{compact ? '값 차이' : '차이'} {differenceLabel(row.difference)}</span>}
                            {row.comparisonReason && <span className="mt-1 block text-xs text-muted-foreground">{comparisonReasons[row.comparisonReason]}</span>}
                        </td>
                        <td className="py-4 pl-4 text-right text-xs text-muted-foreground"><time dateTime={row.date}>{row.date}</time></td>
                    </tr>;
                })}</tbody>
            </table>
        </div>
        <ul className="divide-y divide-border border-y border-border sm:hidden">
            {rows.map(row => {
                const value = formatValue(row.value);
                const exact = formatDetailValue(row.value);
                const observations = coverageLabel(row);
                const expanded = selectedYear === row.date;
                return <li key={row.date}>
                    <button type="button" aria-expanded={expanded} onClick={() => setSelectedYear(value => value === row.date ? null : row.date)}
                        className="flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left">
                        <span className="text-sm font-medium">{year(row.date)}년{row.yearToDate && <span className="mt-1 block text-xs text-muted-foreground">{yearToDateLabel}</span>}</span>
                        <span className={cn('text-right tabular-nums', exactDisplay && styles.mobileValue)}><span className="block text-sm font-semibold">{value}</span>
                            <span className={cn('mt-1 block text-xs', changeClass(row.changeRate))}>
                                전년 대비 {changeLabel(row.changeRate)}
                            </span>
                        </span>
                    </button>
                    {expanded && <div className="space-y-1 pb-4 text-xs text-muted-foreground">
                        <p>{comparisonDateLabel} <time dateTime={row.date}>{row.date}</time>{!exactDisplay && ` · ${label} ${exact}`}{observations && ` · ${observations}`}</p>
                        {row.difference != null && <p>전년 대비 {compact ? '값 차이' : '차이'} {differenceLabel(row.difference)}</p>}
                        {row.comparisonReason && <p>{comparisonReasons[row.comparisonReason]}</p>}
                    </div>}
                </li>;
            })}
        </ul>
        {!summaryAbove && statistics}
    </div>;
}
