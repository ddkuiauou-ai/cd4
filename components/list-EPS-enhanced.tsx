"use client";

import { useState } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import React from "react";
import { cn } from "@/lib/utils";
import Rate from "@/components/rate";
import {
    TrendingUpIcon,
    TrendingDownIcon,
    CalendarIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    BarChart3,
    Target,
    Calculator
} from "lucide-react";

interface Props {
    data: Item[];
}

interface Item {
    date: string;
    value: number;
    changeRate?: number;
}

/**
 * EPS를 간단하고 읽기 쉬운 형태로 포맷
 */
function formatEPSSimple(num: number): { main: string; unit: string } {
    if (num === null || num === undefined || Number.isNaN(num))
        return { main: "-", unit: "" };
    if (num === 0)
        return { main: "0", unit: "원" };

    // 천원 단위로 표시
    const thousand = num / 1000;
    if (Math.abs(thousand) >= 1) {
        return {
            main: thousand.toFixed(0),
            unit: "천원"
        };
    }

    return {
        main: num.toFixed(0),
        unit: "원"
    };
}

function formatDetailValue(value: number): string {
    return `${value.toFixed(0)}원`;
}

function getLatestDecemberDates(data: Item[]): string[] {
    const lastDecDates: Record<string, string> = {};
    data.forEach(({ date }) => {
        const [year, month] = date.split("-");
        if (month === "12") {
            if (!lastDecDates[year] || date > lastDecDates[year]) {
                lastDecDates[year] = date;
            }
        }
    });
    return Object.values(lastDecDates);
}

const calculateChangeRates = (data: Item[], lastDatesOfDec: string[]) => {
    const filteredData = data.filter((data) => lastDatesOfDec.includes(data.date));

    // 날짜순으로 정렬 (오래된 것부터)
    const sortedData = filteredData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 변경률 계산
    const dataWithRate = sortedData.map((data, index, array) => {
        const prevData = array[index - 1];
            return {
                ...data,
            changeRate: prevData
                ? ((data.value - prevData.value) / Math.abs(prevData.value)) * 100
                : undefined,
        };
    });

    // 최신 데이터가 맨 위로 오도록 역순 정렬
    return dataWithRate.reverse();
};

export default function ListEPSEnhanced({ data }: Props) {
    const [selectedYear, setSelectedYear] = useState<string | null>(null);
    const [showAllYears, setShowAllYears] = useState(false);

    const lastDatesOfDec = React.useMemo(
        () => getLatestDecemberDates(data),
        [data]
    );
    const valueWithRate = React.useMemo(
        () => calculateChangeRates(data, lastDatesOfDec),
        [data, lastDatesOfDec]
    );

    const minRate = Math.min(
        ...valueWithRate.map((m) => m.changeRate || Infinity)
    );
    const maxRate = Math.max(
        ...valueWithRate.map((m) => m.changeRate || -Infinity)
    );

    // 통계 계산
    const totalYears = valueWithRate.length;
    const positiveYears = valueWithRate.filter(item => (item.changeRate || 0) > 0).length;
    const negativeYears = valueWithRate.filter(item => (item.changeRate || 0) < 0).length;
    const averageGrowth = valueWithRate.length > 0
        ? valueWithRate.reduce((sum, item) => sum + (item.changeRate || 0), 0) / valueWithRate.length
        : 0;

    // 통계 분석 데이터
    const values = valueWithRate.map(item => item.value);
    const maxValue = values.length > 0 ? Math.max(...values) : 0;
    const minValue = values.length > 0 ? Math.min(...values) : 0;
    const avgValue = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;

    const bestGrowthYear = valueWithRate.length > 0 ? valueWithRate.reduce((best, current) =>
        (current.changeRate || 0) > (best.changeRate || 0) ? current : best
    ) : null;
    const worstGrowthYear = valueWithRate.length > 0 ? valueWithRate.reduce((worst, current) =>
        (current.changeRate || 0) < (worst.changeRate || 0) ? current : worst
    ) : null;

    if (!data || data.length === 0) {
        return (
            <div className="space-y-6 relative">
            <Card>
                <CardHeader>
                    <CardTitle>주당순이익 EPS 연도별 데이터</CardTitle>
                    <CardDescription>
                        기업의 연간 주당순이익 상세 데이터와 전년 대비 변화율을 확인하세요.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                        데이터가 없습니다.
                    </div>
                </CardContent>
            </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 relative">
            <div className="space-y-8 relative">
                <div className="space-y-4 relative">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="sr-only">연간 EPS 변동</h4>
                            <p className="sr-only">
                                기업의 연도별 EPS 변동 추이를 분석합니다. 각 연도별 EPS와 전년 대비 증감률을 포함한 상세 데이터를 제공합니다.
                            </p>
                        </div>
                        <div className="sr-only">
                            {totalYears}개 연도
                        </div>
                    </div>

                    {/* 요약 통계 - 4개 카드 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-background relative">
                            <div className="flex items-center gap-1.5 mb-1">
                                <CalendarIcon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">분석기간</span>
                            </div>
                            <div className="text-lg font-bold">{totalYears}년</div>
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-background relative">
                            <div className="flex items-center gap-1.5 mb-1">
                                <ArrowUpIcon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">상승</span>
                            </div>
                            <div className="text-lg font-bold">{positiveYears}년</div>
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-background relative">
                            <div className="flex items-center gap-1.5 mb-1">
                                <ArrowDownIcon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">하락</span>
                            </div>
                            <div className="text-lg font-bold">{negativeYears}년</div>
                        </div>

                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-background relative">
                            <div className="flex items-center gap-1.5 mb-1">
                                <div className="w-3 h-3 bg-gray-400 dark:bg-gray-500 rounded-full flex-shrink-0"></div>
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">평균</span>
                            </div>
                            <div className={`text-lg font-bold ${averageGrowth >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {averageGrowth >= 0 ? '+' : ''}{averageGrowth.toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    {/* 데스크톱: 테이블 + 사이드바 레이아웃 */}
                    <div className="hidden lg:block relative">
                        <div className="grid grid-cols-3 gap-8">
                            {/* 테이블 영역 (2/3) */}
                            <div className="col-span-2">
                                <div className="bg-background border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden w-full">
                                    <Table className="w-full table-fixed">
                                        <caption className="sr-only">
                                            연도별 EPS 변동 데이터 테이블입니다. 각 연도의 EPS, 전년 대비 증감률, 특이사항을 포함합니다.
                                        </caption>
                    <TableHeader>
                                            <TableRow className="hover:bg-transparent border-b bg-gray-50 dark:bg-gray-800">
                                                <TableHead className="font-semibold text-gray-800 dark:text-gray-200 pl-6 w-[15%]">연도</TableHead>
                                                <TableHead className="text-right font-semibold text-gray-800 dark:text-gray-200 w-[40%]">EPS</TableHead>
                                                <TableHead className="text-center font-semibold text-gray-800 dark:text-gray-200 w-[25%]">전년대비</TableHead>
                                                <TableHead className="text-center font-semibold text-gray-800 dark:text-gray-200 w-[20%]">비고</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                                            {valueWithRate.map(({ date, value, changeRate }, index) => {
                                                const isMinRate = changeRate === minRate && changeRate !== undefined;
                                                const isMaxRate = changeRate === maxRate && changeRate !== undefined;
                                                const isLatest = index === 0;
                                                const formattedValue = formatEPSSimple(value);
                                                const isHighest = value === maxValue;
                                                const isLowest = value === minValue;

                            return (
                                                    <TableRow
                                                        key={date}
                                                        className={cn(
                                                            "border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                                                            isLatest && "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-600"
                                                        )}
                                                    >
                                                        <TableCell className="font-medium pl-6 py-4 w-[15%]">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-lg font-bold">{new Date(date).getFullYear()}</span>
                                                                {isLatest && (
                                                                    <span className="text-xs bg-black dark:bg-white text-white dark:text-black px-2 py-1 rounded font-medium">
                                                                        최신
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="text-right py-4 w-[40%]">
                                                            <div className="text-right space-y-1">
                                                                <div className="flex items-baseline justify-end gap-1">
                                                                    <span className="text-xl font-bold">{formattedValue.main}</span>
                                                                    <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{formattedValue.unit}</span>
                                                                </div>
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                                                    {formatDetailValue(value)}
                                                                </div>
                                                            </div>
                                                        </TableCell>

                                                        <TableCell className="text-center py-4 w-[25%]">
                                                            {changeRate === undefined ? (
                                                                <span className="text-gray-500 dark:text-gray-400 text-sm">—</span>
                                                            ) : (
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <div className={cn(
                                                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border",
                                                                        changeRate > 0
                                                                            ? "bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                                                                            : changeRate < 0
                                                                                ? "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                                                                                : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                                                                    )}>
                                                                        {changeRate > 0 ? (
                                                                            <span className="text-xs">▲</span>
                                                                        ) : changeRate < 0 ? (
                                                                            <span className="text-xs">▼</span>
                                                                        ) : (
                                                                            <span className="text-xs">—</span>
                                                                        )}
                                                                        {Math.abs(changeRate).toFixed(1)}%
                                                                    </div>
                                                                    {(isMaxRate || isMinRate) && (
                                                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                                                            {isMaxRate ? "최고" : "최저"}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                    </TableCell>

                                                        <TableCell className="text-center py-4 w-[20%]">
                                                            {(isHighest || isLowest) ? (
                                                                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold border bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700">
                                                                    {isHighest ? "최고" : "최저"}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-500 dark:text-gray-400 text-sm">—</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                                </div>
                            </div>

                            {/* 사이드바 영역 (1/3) */}
                            <div className="col-span-1 space-y-4">
                                {/* 핵심 통계 */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-background relative">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Calculator className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                        <h4 className="font-semibold text-sm">핵심 통계</h4>
                                    </div>
                                    <p className="sr-only">EPS의 평균값, 역대 최고치, 역대 최저치 등 핵심 통계 정보입니다.</p>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600 dark:text-gray-400">평균 EPS</span>
                                            <span className="font-bold text-sm">{formatEPSSimple(avgValue).main}{formatEPSSimple(avgValue).unit}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600 dark:text-gray-400">역대 최고</span>
                                            <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{formatEPSSimple(maxValue).main}{formatEPSSimple(maxValue).unit}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600 dark:text-gray-400">역대 최저</span>
                                            <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{formatEPSSimple(minValue).main}{formatEPSSimple(minValue).unit}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 성장 분석 */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-background relative">
                                    <div className="flex items-center gap-2 mb-3">
                                        <TrendingUpIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                        <h4 className="font-semibold text-sm">변동 분석</h4>
                                    </div>
                                    <p className="sr-only">EPS 변동 패턴을 바탕으로 한 상승/하락 연도 분포, 최고 변동률과 최대 변동률 등 분석입니다.</p>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600 dark:text-gray-400">상승 연도</span>
                                            <span className="font-bold text-sm">{positiveYears}년</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-600 dark:text-gray-400">하락 연도</span>
                                            <span className="font-bold text-sm">{negativeYears}년</span>
                                        </div>
                                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs text-gray-600 dark:text-gray-400">최고 변동률</span>
                                                <div className="text-right">
                                                    <div className="font-bold text-sm text-red-600 dark:text-red-400">+{bestGrowthYear ? (bestGrowthYear.changeRate || 0).toFixed(1) : 0}%</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">{bestGrowthYear ? new Date(bestGrowthYear.date).getFullYear() : '-'}년</div>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-gray-600 dark:text-gray-400">최대 변동률</span>
                                                <div className="text-right">
                                                    <div className="font-bold text-sm text-blue-600 dark:text-blue-400">{worstGrowthYear ? (worstGrowthYear.changeRate || 0).toFixed(1) : 0}%</div>
                                                    <div className="text-xs text-gray-500 dark:text-gray-400">{worstGrowthYear ? new Date(worstGrowthYear.date).getFullYear() : '-'}년</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 기간 분석 */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-background">
                                    <div className="flex items-center gap-2 mb-3">
                                        <CalendarIcon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                        <h4 className="font-semibold text-sm">기간 분석</h4>
                                    </div>
                                    <p className="sr-only">분석 대상 기간의 시작과 끝, 총 분석 기간 등 데이터 범위 정보입니다.</p>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">분석 기간</span>
                                            <span className="font-medium">{valueWithRate.length}년</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">최신 데이터</span>
                                            <span className="font-medium">{new Date(valueWithRate[0]?.date).getFullYear()}년</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-400">최초 데이터</span>
                                            <span className="font-medium">{new Date(valueWithRate[valueWithRate.length - 1]?.date).getFullYear()}년</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 투자 인사이트 */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-background">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Target className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                                        <h4 className="font-semibold text-sm">투자 인사이트</h4>
                                    </div>
                                    <p className="sr-only">EPS 변동 패턴을 바탕으로 한 수익성 분석과 기업 성장 전망에 대한 인사이트입니다.</p>
                                    <div className="space-y-2 text-xs">
                                        <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                                            <div className="font-medium mb-1">수익성 분석</div>
                                            <div className="text-gray-600 dark:text-gray-400">
                                                {positiveYears > negativeYears
                                                    ? "수익성 개선 추세가 우세한 패턴"
                                                    : "수익성 변동이 큰 주기적 패턴"}
                                            </div>
                                        </div>
                                        <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                                            <div className="font-medium mb-1">성장 전망</div>
                                            <div className="text-gray-600 dark:text-gray-400">
                                                {averageGrowth > 10
                                                    ? "EPS 10% 이상 성장, 강력한 성장 모멘텀"
                                                    : averageGrowth > 0
                                                        ? "안정적 성장 패턴 유지"
                                                        : "성장 정체 또는 조정 구간"}
                            </div>
                        </div>
                            </div>
                        </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
