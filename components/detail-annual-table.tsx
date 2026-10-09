"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { compareBusinessValues, summarizeBusinessWindow, type BusinessValue } from '@/lib/business-analysis';
import type { AnnualComparisonReason } from '@/lib/detail-presentation';

interface AnnualRow { date: string; value: BusinessValue; changeRate?: number; difference?: string; comparisonReason?: AnnualComparisonReason; observedCount?: number; targetCount?: number; yearToDate?: boolean; yearEnd?: boolean; }
const comparisonReasons: Record<AnnualComparisonReason, string> = {
    no_previous_year: '전년 관측값이 없습니다.',
    non_adjacent_year: '인접한 전년 관측값이 없어 비교할 수 없습니다.',
    missing_previous: '전년 값이 미제공이라 비교할 수 없습니다.',
    missing_current: '현재 값이 미제공이라 비교할 수 없습니다.',
    cohort_changed: '관측 종목이 달라 비교할 수 없습니다.',
    non_positive_previous: '이전 값이 0/음수라 증감률 계산 불가',
};
export function DetailAnnualTable({ rows, label, formatValue, formatDetailValue, yearEndOnly = false }: {
    rows: AnnualRow[]; label: string; formatValue: (value: BusinessValue) => string; formatDetailValue: (value: BusinessValue) => string; yearEndOnly?: boolean;
}) {
    const [showAll, setShowAll] = useState(false);
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const visible = showAll ? rows : rows.slice(0, 5);
    const year = (date: string) => date.slice(0, 4);
    const summary = summarizeBusinessWindow(rows);
    const rates = rows.filter(row => row.changeRate != null && Number.isFinite(row.changeRate));
    const coverage = rows.some(row => row.targetCount != null);
    const changeLabel = (rate: number | undefined) => rate != null && Number.isFinite(rate)
        ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)}%` : '—';
    const changeClass = (rate: number | undefined) => rate != null && Number.isFinite(rate)
        ? rate > 0 ? 'market-up' : rate < 0 ? 'market-down' : 'text-muted-foreground' : 'text-muted-foreground';
    const differenceLabel = (difference: string) => `${compareBusinessValues(difference, 0) === 1 ? '+' : ''}${formatDetailValue(difference)}`;
    if (!rows.length) return <p className="border-y border-border py-8 text-sm text-muted-foreground">{yearEndOnly ? '연말 기준' : '연도별'} {label} 데이터가 없습니다.</p>;
    return <div className="detail-annual-data space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-xs text-muted-foreground">{yearEndOnly ? '각 연도의 마지막 12월 관측값' : '각 연도의 마지막 관측값 · 최근 연도의 12월 이전 값은 연중(YTD) 자료'} · {rows.length}개 연도</p>
            {rows.length > 5 && <button type="button" aria-expanded={showAll} onClick={() => setShowAll(value => !value)}
                className="min-h-10 border border-border px-3 text-sm hover:bg-muted">{showAll ? '최근 5년만 보기' : `${rows.length}개 연도 모두 보기`}</button>}
        </div>
        <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-sm tabular-nums">
                <caption className="sr-only">연도별 {label}과 전년 대비 변화율</caption>
                <thead><tr className="border-y border-border">
                    <th scope="col" className="py-3 text-left font-medium text-muted-foreground">연도</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium text-muted-foreground">{label}</th>
                    <th scope="col" className="py-3 text-right font-medium text-muted-foreground">전년 대비</th>
                    <th scope="col" className="py-3 pl-4 text-right font-medium text-muted-foreground">기준일</th>
                </tr></thead>
                <tbody>{visible.map((row, index) => <tr key={row.date} className="border-b border-border hover:bg-muted/30">
                    <th scope="row" className="py-4 text-left font-medium">{year(row.date)}{row.yearToDate && <span className="ml-2 text-xs text-muted-foreground">연중(YTD)</span>}{index === 0 && <span className="ml-2 text-xs text-muted-foreground">최신</span>}</th>
                    <td className="px-4 py-4 text-right font-semibold"><span>{formatValue(row.value)}</span>{formatValue(row.value) !== formatDetailValue(row.value) && <span className="mt-1 block text-xs font-normal text-muted-foreground">{formatDetailValue(row.value)}</span>}{coverage && <span className="mt-1 block text-xs font-normal text-muted-foreground">{row.observedCount ?? 0}/{row.targetCount ?? 0}개 관측</span>}</td>
                    <td className={cn('py-4 text-right', changeClass(row.changeRate))}><span>{changeLabel(row.changeRate)}</span>{row.difference != null && <span className="mt-1 block text-xs text-muted-foreground">차이 {differenceLabel(row.difference)}</span>}{row.comparisonReason && <span className="mt-1 block text-xs text-muted-foreground">{comparisonReasons[row.comparisonReason]}</span>}</td>
                    <td className="py-4 pl-4 text-right text-xs text-muted-foreground">{row.date}</td>
                </tr>)}</tbody>
            </table>
        </div>
        <ul className="divide-y divide-border border-y border-border sm:hidden">
            {visible.map((row, index) => <li key={row.date}>
                <button type="button" aria-expanded={selectedYear === row.date} onClick={() => setSelectedYear(value => value === row.date ? null : row.date)}
                    className="flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left">
                    <span className="text-sm font-medium">{year(row.date)}년{row.yearToDate && <span className="mt-1 block text-xs text-muted-foreground">연중(YTD)</span>}{index === 0 && <span className="mt-1 block text-xs text-muted-foreground">최신</span>}</span>
                    <span className="text-right tabular-nums"><span className="block text-sm font-semibold">{formatValue(row.value)}</span>
                        <span className={cn('mt-1 block text-xs', changeClass(row.changeRate))}>전년 대비 {changeLabel(row.changeRate)}</span></span>
                </button>
                {selectedYear === row.date && <div className="space-y-1 pb-4 text-xs text-muted-foreground"><p>기준일 {row.date} · {label} {formatDetailValue(row.value)}{coverage && ` · ${row.observedCount ?? 0}/${row.targetCount ?? 0}개 관측`}</p>{row.difference != null && <p>전년 대비 차이 {differenceLabel(row.difference)}</p>}{row.comparisonReason && <p>{comparisonReasons[row.comparisonReason]}</p>}</div>}
            </li>)}
        </ul>
        <dl className="grid grid-cols-2 gap-4 border-b border-border pb-5 text-sm sm:grid-cols-4">
            {[
                [yearEndOnly ? '연말 평균' : '연도별 평균', formatValue(summary.mean)], [yearEndOnly ? '연말 최고' : '연도별 최고', formatValue(summary.max)],
                [yearEndOnly ? '연말 최저' : '연도별 최저', formatValue(summary.min)],
                ['상승 · 하락 연도', `${rates.filter(row => row.changeRate! > 0).length}년 · ${rates.filter(row => row.changeRate! < 0).length}년`],
            ].map(([name, value]) => <div key={name}><dt className="mb-2 text-xs text-muted-foreground">{name}</dt><dd className="font-medium tabular-nums">{value}</dd></div>)}
        </dl>
        <p className="text-xs leading-relaxed text-muted-foreground">인접한 전년 관측값이 양수일 때 변화율을 표시합니다. 연중 자료는 연말 실적과 구분하여 기준일을 함께 확인해 주세요.{coverage && ' 관측 종목이 달라진 연도는 변화율을 표시하지 않습니다.'}</p>
    </div>;
}
