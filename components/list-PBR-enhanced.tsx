"use client";

import { useMemo } from "react";
import {
    formatNumberRaw,
    formatNumberRatio,
    formatNumberPercent,
    formatNumber,
} from "../lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
    data: {
        date: string;
        value: number;
    }[];
};

export default function ListPBREnhanced({ data }: Props) {
    const tableData = useMemo(() => {
        if (!data || data.length === 0) return [];

        // 🔥 중복 날짜 데이터 제거 (같은 연도의 경우 최신 값 유지)
        const dateMap = new Map<string, { date: string; value: number }>();

        data
            .filter(item => item.value !== null && item.value !== undefined)
            .forEach(item => {
                const year = new Date(item.date).getFullYear().toString();
                const existingItem = dateMap.get(year);
                if (!existingItem || new Date(item.date) > new Date(existingItem.date)) {
                    dateMap.set(year, item);
                }
            });

        return Array.from(dateMap.values())
            .map((item, index, array) => {
                const year = new Date(item.date).getFullYear();
                const prevValue = index > 0 ? array[index - 1].value : null;
                const changeValue = prevValue ? item.value - prevValue : null;
                const changeRate = prevValue && prevValue !== 0 ? ((item.value - prevValue) / prevValue) * 100 : null;

                return {
                    year,
                    pbr: item.value,
                    change: changeValue,
                    changeRate: changeRate,
                    uniqueKey: `pbr-list-${item.date}-${index}`, // 고유 키 생성
                };
            })
            .sort((a, b) => b.year - a.year); // 최신 연도부터
    }, [data]);

    if (!tableData || tableData.length === 0) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>연도별 주가순자산비율 (PBR)</CardTitle>
                    <CardDescription>
                        연도별 PBR 상세 데이터를 확인할 수 있습니다.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                        데이터가 없습니다.
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>연도별 주가순자산비율 (PBR)</CardTitle>
                <CardDescription>
                    연도별 PBR 상세 데이터를 확인할 수 있습니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="px-4 py-3 text-left font-medium text-muted-foreground">연도</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">PBR</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">전년 대비</th>
                                <th className="px-4 py-3 text-right font-medium text-muted-foreground">증감률(%)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map((row, index) => (
                                <tr
                                    key={row.uniqueKey}
                                    className={`border-b hover:bg-muted/50 ${index === 0 ? "bg-muted/20" : ""}`}
                                >
                                    <td className="px-4 py-3 font-medium">
                                        {row.year}년
                                        {index === 0 && <span className="ml-2 text-xs text-muted-foreground">(최신)</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                        {formatNumberRatio(row.pbr)}배
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                        {row.change !== null ? (
                                            <span className={row.change > 0 ? "text-red-600" : row.change < 0 ? "text-blue-600" : "text-muted-foreground"}>
                                                {row.change > 0 ? "+" : ""}{formatNumberRatio(row.change)}배
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono">
                                        {row.changeRate !== null ? (
                                            <span className={row.changeRate > 0 ? "text-red-600" : row.changeRate < 0 ? "text-blue-600" : "text-muted-foreground"}>
                                                {row.changeRate > 0 ? "+" : ""}{row.changeRate.toFixed(1)}%
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 요약 통계 */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-lg">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">최신 PBR</p>
                        <p className="text-lg font-bold">
                            {formatNumberRatio(tableData[0]?.pbr || 0)}배
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">평균 PBR</p>
                        <p className="text-lg font-bold">
                            {formatNumberRatio(
                                tableData.length > 0 ? tableData.reduce((sum, row) => sum + row.pbr, 0) / tableData.length : 0
                            )}배
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">최고 PBR</p>
                        <p className="text-lg font-bold">
                            {formatNumberRatio(tableData.length > 0 ? Math.max(...tableData.map(row => row.pbr)) : 0)}배
                        </p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">최저 PBR</p>
                        <p className="text-lg font-bold">
                            {formatNumberRatio(tableData.length > 0 ? Math.min(...tableData.map(row => row.pbr)) : 0)}배
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
