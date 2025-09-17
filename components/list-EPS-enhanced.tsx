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
        .reverse(); // 최신 연도가 위로 오도록
};

export default function ListEPSEnhanced({ data }: Props) {
    if (!data || data.length === 0) {
        return (
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
        );
    }

    const lastDatesOfDec = getLatestDecemberDates(data);
    const processedData = calculateChangeRates(data, lastDatesOfDec);

    const formatEPS = (value: number) => {
        if (value === 0) return "0원";
        const absValue = Math.abs(value);
        if (absValue >= 1000) {
            return `${(value / 1000).toLocaleString()}천원`;
        }
        return `${value.toLocaleString()}원`;
    };

    const getEPSColor = (value: number) => {
        if (value > 0) return "text-red-600"; // 한국 증시 관례: 플러스는 빨간색
        if (value < 0) return "text-blue-600"; // 한국 증시 관례: 마이너스는 파란색
        return "text-muted-foreground";
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>주당순이익 EPS 연도별 데이터</CardTitle>
                <CardDescription>
                    기업의 연간 주당순이익 상세 데이터와 전년 대비 변화율을 확인하세요.
                    EPS가 높을수록 주주에게 더 많은 이익을 제공합니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">연도</TableHead>
                            <TableHead className="text-right">주당순이익</TableHead>
                            <TableHead className="text-right w-[120px]">전년 대비</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {processedData.map((item, index) => {
                            const year = new Date(item.date).getFullYear();
                            return (
                                <TableRow key={item.date}>
                                    <TableCell className="font-medium">{year}년</TableCell>
                                    <TableCell className={`text-right font-mono ${getEPSColor(item.value)}`}>
                                        {formatEPS(item.value)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {index === processedData.length - 1 ? (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        ) : (
                                            <Rate rate={item.changeRate || 0} />
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>

                {/* 요약 정보 */}
                {processedData.length > 0 && (
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-muted-foreground">최근 EPS</div>
                            <div className={`font-medium ${getEPSColor(processedData[0]?.value || 0)}`}>
                                {formatEPS(processedData[0]?.value || 0)}
                            </div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-muted-foreground">최고 EPS</div>
                            <div className="font-medium text-red-600">
                                {formatEPS(Math.max(...processedData.map(d => d.value)))}
                            </div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-muted-foreground">최저 EPS</div>
                            <div className="font-medium text-blue-600">
                                {formatEPS(Math.min(...processedData.map(d => d.value)))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 범례 */}
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground border-t pt-4">
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm bg-red-500"></div>
                        <span>흑자 (이익)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm bg-blue-500"></div>
                        <span>적자 (손실)</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        * EPS = 당기순이익 ÷ 발행주식수
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
