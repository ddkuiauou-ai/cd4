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
import { formatNumber } from "@/lib/utils";
import Rate from "@/app/components/Rate";

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
                    ? ((data.value - nextMarketcap.value) / nextMarketcap.value) * 100
                    : undefined,
            };
        });
};

function MarketcapList({ data }: Props) {
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

    return (
        <Card>
            <CardHeader className="px-7">
                <CardTitle>연간 시가총액</CardTitle>
                <CardDescription>연말 기준 시가총액 리스트</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <div className="hidden sm:inline-block">날짜</div>
                                <div className="sm:hidden">연도</div>
                            </TableHead>
                            <TableHead className="text-center">등락율</TableHead>
                            <TableHead className="text-center">시가총액</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {valueWithRate.map(({ date, value, changeRate }) => (
                            <TableRow
                                key={date}
                                className={
                                    changeRate === minRate || changeRate === maxRate
                                        ? "bg-accent"
                                        : ""
                                }
                            >
                                <TableCell>
                                    <div className="hidden sm:inline-block font-medium">
                                        {date}
                                    </div>
                                    <div className="font-medium sm:hidden">
                                        {date.slice(0, 4)}
                                    </div>
                                </TableCell>
                                <TableCell className="font-semibold text-xs sm:text-sm ">
                                    <div className="flex justify-end">
                                        {changeRate === undefined ? (
                                            "-"
                                        ) : (
                                            <Rate rate={changeRate} />
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="hidden sm:block font-medium ">
                                        {value.toLocaleString()}원
                                    </div>
                                    <div className="sm:hidden text-sm sm:text-muted-foreground md:inline">
                                        {formatNumber(value)}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

export default MarketcapList;
