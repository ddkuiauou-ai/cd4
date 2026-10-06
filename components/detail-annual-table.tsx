"use client";

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AnnualRow { date: string; value: number | null; changeRate?: number; }
export function DetailAnnualTable({ rows, label, formatValue, formatDetailValue }: {
    rows: AnnualRow[]; label: string; formatValue: (value: number | null) => string; formatDetailValue: (value: number | null) => string;
}) {
    const [showAll, setShowAll] = useState(false);
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const visible = showAll ? rows : rows.slice(0, 5);
    const year = (date: string) => date.slice(0, 4);
    const values = rows.map(row => row.value).filter((value): value is number => value != null && Number.isFinite(value));
    const rates = rows.filter(row => row.changeRate != null && Number.isFinite(row.changeRate));
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const changeLabel = (rate: number | undefined) => rate != null && Number.isFinite(rate)
        ? `${rate > 0 ? '+' : ''}${rate.toFixed(1)}%` : '—';
    const changeClass = (rate: number | undefined) => rate != null && Number.isFinite(rate)
        ? rate > 0 ? 'market-up' : rate < 0 ? 'market-down' : 'text-muted-foreground' : 'text-muted-foreground';
    if (!rows.length) return <p className="border-y border-border py-8 text-sm text-muted-foreground">연말 기준 {label} 데이터가 없습니다.</p>;
    return <div className="detail-annual-data space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-xs text-muted-foreground">각 연도의 마지막 12월 데이터 · {rows.length}개 연도</p>
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
                    <th scope="row" className="py-4 text-left font-medium">{year(row.date)}{index === 0 && <span className="ml-2 text-xs text-muted-foreground">최신</span>}</th>
                    <td className="px-4 py-4 text-right font-semibold"><span>{formatValue(row.value)}</span>{formatValue(row.value) !== formatDetailValue(row.value) && <span className="mt-1 block text-xs font-normal text-muted-foreground">{formatDetailValue(row.value)}</span>}</td>
                    <td className={cn('py-4 text-right', changeClass(row.changeRate))}>{changeLabel(row.changeRate)}</td>
                    <td className="py-4 pl-4 text-right text-xs text-muted-foreground">{row.date}</td>
                </tr>)}</tbody>
            </table>
        </div>
        <ul className="divide-y divide-border border-y border-border sm:hidden">
            {visible.map((row, index) => <li key={row.date}>
                <button type="button" aria-expanded={selectedYear === row.date} onClick={() => setSelectedYear(value => value === row.date ? null : row.date)}
                    className="flex min-h-16 w-full items-center justify-between gap-4 py-4 text-left">
                    <span className="text-sm font-medium">{year(row.date)}년{index === 0 && <span className="mt-1 block text-xs text-muted-foreground">최신</span>}</span>
                    <span className="text-right tabular-nums"><span className="block text-sm font-semibold">{formatValue(row.value)}</span>
                        <span className={cn('mt-1 block text-xs', changeClass(row.changeRate))}>전년 대비 {changeLabel(row.changeRate)}</span></span>
                </button>
                {selectedYear === row.date && <p className="pb-4 text-xs text-muted-foreground">기준일 {row.date} · {label} {formatDetailValue(row.value)}</p>}
            </li>)}
        </ul>
        <dl className="grid grid-cols-2 gap-4 border-b border-border pb-5 text-sm sm:grid-cols-4">
            {[
                ['연말 평균', formatValue(average)], ['연말 최고', formatValue(values.length ? Math.max(...values) : null)],
                ['연말 최저', formatValue(values.length ? Math.min(...values) : null)],
                ['상승 · 하락 연도', `${rates.filter(row => row.changeRate! > 0).length}년 · ${rates.filter(row => row.changeRate! < 0).length}년`],
            ].map(([name, value]) => <div key={name}><dt className="mb-2 text-xs text-muted-foreground">{name}</dt><dd className="font-medium tabular-nums">{value}</dd></div>)}
        </dl>
        <p className="text-xs leading-relaxed text-muted-foreground">전년 값이 없거나 0인 경우 변화율을 표시하지 않습니다. {label === 'EPS' ? 'EPS 변화율은 전년 값의 절댓값을 기준으로 계산합니다.' : ''}</p>
    </div>;
}
