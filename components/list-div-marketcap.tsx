"use client";
import { useMemo } from 'react';
import { DetailAnnualTable } from './detail-annual-table';

interface Props {
    data: Item[];
}

interface Item {
    date: string;
    value: number;
    changeRate?: number;
}

/**
 * 배당수익률을 간단하고 읽기 쉬운 형태로 포맷
 */
function formatDIVSimple(num: number): { main: string; unit: string } {
    if (num === null || num === undefined || Number.isNaN(num))
        return { main: "-", unit: "" };
    if (num === 0)
        return { main: "0", unit: "%" };

    // 소수점 둘째 자리까지 표시
    return {
        main: num.toFixed(2),
        unit: "%"
    };
}

function formatDetailValue(value: number): string {
    return `${value.toFixed(2)}%`;
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
        const prevMarketcap = array[index - 1];
        return {
            ...data,
            changeRate: prevMarketcap
                ? ((data.value - prevMarketcap.value) / prevMarketcap.value) * 100
                : undefined,
        };
    });

    // 최신 데이터가 맨 위로 오도록 역순 정렬
    return dataWithRate.reverse();
};

export default function ListDIVMarketcap({ data }: Props) {
    const lastDatesOfDec = useMemo(() => getLatestDecemberDates(data), [data]);
    const rows = useMemo(() => calculateChangeRates(data, lastDatesOfDec), [data, lastDatesOfDec]);
    return <DetailAnnualTable rows={rows} label="DIV" formatDetailValue={value => value == null || !Number.isFinite(value) ? '—' : formatDetailValue(value)} formatValue={value => { if (value == null || !Number.isFinite(value)) return '—'; const formatted = formatDIVSimple(value); return `${formatted.main}${formatted.unit}`; }} />;
}
