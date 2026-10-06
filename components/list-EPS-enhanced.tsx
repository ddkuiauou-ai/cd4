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
    const lastDatesOfDec = useMemo(() => getLatestDecemberDates(data), [data]);
    const rows = useMemo(() => calculateChangeRates(data, lastDatesOfDec), [data, lastDatesOfDec]);
    return <DetailAnnualTable rows={rows} label="EPS" formatDetailValue={value => value == null || !Number.isFinite(value) ? '—' : formatDetailValue(value)} formatValue={value => { if (value == null || !Number.isFinite(value)) return '—'; const formatted = formatEPSSimple(value); return `${formatted.main}${formatted.unit}`; }} />;
}
