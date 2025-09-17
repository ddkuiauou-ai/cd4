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
import Rate from "@/components/rate";

interface Props {
    data: Item[];
}

interface Item {
    date: string;
    value: number;
    changeRate?: number;
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
    return data
        .filter((data) => lastDatesOfDec.includes(data.date))
        .map((data, index, array) => {
            const nextMarketcap = array[index + 1];
            return {
                ...data,
                changeRate: nextMarketcap
                    ? data.value === 0 || nextMarketcap.value === 0
                        ? 0
                        : ((nextMarketcap.value - data.value) / Math.abs(data.value)) * 100
                    : 0,
            };
        })
        .reverse()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export default function ListDIVEnhanced({ data }: Props) {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>배당수익률 DIV 연도별 데이터</CardTitle>
                    <CardDescription>
                        Dividend Yield - 기업의 연간 배당수익률 상세 데이터입니다.
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

    const lastDatesOfDec = getLatestDecemberDates(data);
    const processedData = calculateChangeRates(data, lastDatesOfDec);

    return (
        <Card>
            <CardHeader>
                <CardTitle>배당수익률 DIV 연도별 데이터</CardTitle>
                <CardDescription>
                    Dividend Yield - 기업의 연간 배당수익률 상세 데이터입니다. 높을수록 배당 수익이 큽니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="overflow-hidden rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="font-semibold text-center">연도</TableHead>
                                <TableHead className="font-semibold text-right">배당수익률</TableHead>
                                <TableHead className="font-semibold text-right">전년 대비</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {processedData.map((item, index) => {
                                const year = new Date(item.date).getFullYear();
                                const divValue = item.value;
                                const changeRate = item.changeRate || 0;

                                return (
                                    <TableRow
                                        key={item.date}
                                        className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}
                                    >
                                        <TableCell className="text-center font-medium">
                                            {year}년
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            <span className="text-primary font-semibold">
                                                {divValue.toFixed(2)}%
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {index < processedData.length - 1 ? (
                                                <Rate
                                                    rate={changeRate}
                                                    size="sm"
                                                />
                                            ) : (
                                                <span className="text-muted-foreground text-sm">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                <div className="mt-4 text-xs text-muted-foreground">
                    <p>
                        * 배당수익률(DIV) = (연간 배당금 ÷ 주가) × 100
                    </p>
                    <p>
                        * 각 연도 12월 말 기준 데이터를 표시합니다.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
