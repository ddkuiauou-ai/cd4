"use client";

import React, { useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "../lib/utils";
import Rate from "@/components/rate";

interface Props {
    data: Item[];
}

interface Item {
    date: string;
    value: number;
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

export default function ListDPSEnhanced({ data }: Props) {
    const processedData = useMemo(() => {
        if (!data || data.length === 0) return [];

        const lastDatesOfDec = getLatestDecemberDates(data);
        const filteredData = data
            .filter((item) => lastDatesOfDec.includes(item.date))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((item) => ({
                ...item,
                displayDate: new Date(item.date).getFullYear().toString(),
                value: Number(item.value) || 0,
            }));

        // 전년 대비 증감률 계산
        return filteredData.map((item, index) => {
            const prevItem = filteredData[index + 1];
            const changeRate = prevItem
                ? ((item.value - prevItem.value) / Math.abs(prevItem.value)) * 100
                : 0;

            return {
                ...item,
                changeRate,
                hasPrevData: !!prevItem,
            };
        });
    }, [data]);

    if (!processedData || processedData.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>주당배당금 DPS 연도별 데이터</CardTitle>
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
        <Card>
            <CardHeader>
                <CardTitle>주당배당금 DPS 연도별 데이터</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">연도</TableHead>
                                <TableHead className="text-right">주당배당금</TableHead>
                                <TableHead className="w-[120px] text-right">전년 대비</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {processedData.map((item) => (
                                <TableRow key={item.date}>
                                    <TableCell className="font-medium">
                                        {item.displayDate}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {formatNumber(item.value)}원
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {item.hasPrevData ? (
                                            <Rate
                                                rate={item.changeRate}
                                            />
                                        ) : (
                                            <span className="text-muted-foreground text-sm">
                                                —
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
