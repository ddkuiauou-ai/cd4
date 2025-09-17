"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUpIcon, ArrowDownIcon } from "@radix-ui/react-icons";

interface ListPEREnhancedProps {
    data: { date: string; value: number }[];
    className?: string;
}

interface ProcessedDataItem {
    date: string;
    value: number;
    changePercent?: number;
    changeType?: "increase" | "decrease" | "neutral";
}

// 데이터 전처리 함수
function processTableData(data: { date: string; value: number }[]): ProcessedDataItem[] {
    if (!data || data.length === 0) return [];

    // 🔥 중복 날짜 데이터 제거
    const dateMap = new Map<string, { date: string; value: number }>();

    data.forEach(item => {
        const existingItem = dateMap.get(item.date);
        if (!existingItem || item.value > existingItem.value) {
            dateMap.set(item.date, item);
        }
    });

    const processedData = Array.from(dateMap.values())
        .filter(item => item.value !== null && !isNaN(item.value))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // 최신순 정렬

    // 변화율 계산
    const result = processedData.map((item, index) => {
        const processedItem: ProcessedDataItem = {
            date: item.date,
            value: item.value,
        };

        // 전년 대비 변화율 계산
        if (index < processedData.length - 1) {
            const prevValue = processedData[index + 1].value;
            if (prevValue && prevValue !== 0) {
                const changePercent = ((item.value - prevValue) / prevValue) * 100;
                processedItem.changePercent = changePercent;
                processedItem.changeType =
                    changePercent > 0 ? "increase" :
                        changePercent < 0 ? "decrease" : "neutral";
            }
        }

        return processedItem;
    });

    console.log('Table data processed:', result.length);
    return result;
}

export default function ListPEREnhanced({ data, className }: ListPEREnhancedProps) {
    const [showAll, setShowAll] = useState(false);

    const processedData = useMemo(() => processTableData(data), [data]);

    const displayData = showAll ? processedData : processedData.slice(0, 10);

    if (!processedData || processedData.length === 0) {
        return (
            <div className="border border-dashed border-muted-foreground/25 rounded-lg p-8">
                <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        PER 데이터 없음
                    </p>
                    <p className="text-xs text-muted-foreground">
                        표시할 데이터가 없습니다
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("space-y-4", className)}>
            <div className="rounded-lg border">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b bg-muted/50">
                                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground text-sm">
                                    연도
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground text-sm">
                                    PER
                                </th>
                                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground text-sm">
                                    전년 대비
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.map((item, index) => {
                                const formattedDate = new Date(item.date).toLocaleDateString('ko-KR', {
                                    year: 'numeric',
                                    month: 'long'
                                });

                                return (
                                    <tr
                                        key={`per-${item.date}-${index}`}
                                        className="border-b transition-colors hover:bg-muted/50"
                                    >
                                        <td className="p-4 align-middle text-sm font-medium">
                                            {formattedDate}
                                        </td>
                                        <td className="p-4 align-middle text-right text-sm font-mono">
                                            {item.value.toFixed(2)}배
                                        </td>
                                        <td className="p-4 align-middle text-right text-sm">
                                            {item.changePercent !== undefined ? (
                                                <div className="flex items-center justify-end space-x-1">
                                                    {item.changeType === "increase" && (
                                                        <ArrowUpIcon className="h-3 w-3 text-red-500" />
                                                    )}
                                                    {item.changeType === "decrease" && (
                                                        <ArrowDownIcon className="h-3 w-3 text-blue-500" />
                                                    )}
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            "text-xs font-mono",
                                                            item.changeType === "increase" && "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950/20",
                                                            item.changeType === "decrease" && "text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950/20",
                                                            item.changeType === "neutral" && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {item.changePercent > 0 ? "+" : ""}{item.changePercent.toFixed(1)}%
                                                    </Badge>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {processedData.length > 10 && (
                <div className="flex justify-center">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAll(!showAll)}
                        className="text-sm"
                    >
                        {showAll ? "접기" : `더 보기 (${processedData.length - 10}개 더)`}
                    </Button>
                </div>
            )}
        </div>
    );
}
