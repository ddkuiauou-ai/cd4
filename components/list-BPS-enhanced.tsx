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
                uniqueKey: `${data.date}-${index}`, // 고유 키 추가
            };
        })
        .reverse(); // 최신 연도가 위로 오도록
};

export default function ListBPSEnhanced({ data }: Props) {
    if (!data || data.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>주당순자산가치 BPS 연도별 데이터</CardTitle>
                    <CardDescription>
                        기업의 연간 주당순자산가치 상세 데이터와 전년 대비 변화율을 확인하세요.
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

    const formatBPS = (value: number) => {
        if (value === 0) return "0원";
        const absValue = Math.abs(value);
        if (absValue >= 1000) {
            return `${(value / 1000).toLocaleString()}천원`;
        }
        return `${value.toLocaleString()}원`;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>주당순자산가치 BPS 연도별 데이터</CardTitle>
                <CardDescription>
                    기업의 연간 주당순자산가치 상세 데이터와 전년 대비 변화율을 확인하세요.
                    BPS가 높을수록 기업의 자산 가치가 높음을 의미합니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[100px]">연도</TableHead>
                            <TableHead className="text-right">주당순자산가치</TableHead>
                            <TableHead className="text-right w-[120px]">전년 대비</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {processedData.map((item, index) => {
                            const year = new Date(item.date).getFullYear();
                            return (
                                <TableRow key={item.uniqueKey || `${item.date}-${index}`}>
                                    <TableCell className="font-medium">{year}년</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {formatBPS(item.value)}
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
                            <div className="text-muted-foreground">최근 BPS</div>
                            <div className="font-medium">
                                {formatBPS(processedData[0]?.value || 0)}
                            </div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-muted-foreground">최고 BPS</div>
                            <div className="font-medium">
                                {formatBPS(Math.max(...processedData.map(d => d.value)))}
                            </div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                            <div className="text-muted-foreground">최저 BPS</div>
                            <div className="font-medium">
                                {formatBPS(Math.min(...processedData.map(d => d.value)))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 설명 */}
                <div className="mt-4 text-xs text-muted-foreground border-t pt-4">
                    * BPS = 순자산 ÷ 발행주식수 (기업의 청산 시 주주가 받을 수 있는 금액)
                </div>
            </CardContent>
        </Card>
    );
}
