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

/** Format the annual value while retaining its exact amount in the table. */
function formatMarketcapSimple(num: number): { main: string; unit: string } {
  if (num === null || num === undefined || Number.isNaN(num))
    return { main: "-", unit: "" };
  if (num === 0)
    return { main: "0", unit: "원" };

  // 조 (Trillion) 단위
  if (Math.abs(num) >= 1_000_000_000_000) {
    const trillion = num / 1_000_000_000_000;
    return {
      main: trillion.toFixed(trillion >= 100 ? 0 : 1),
      unit: "조원"
    };
  }

  // 억 (Hundred Million) 단위
  if (Math.abs(num) >= 100_000_000) {
    const hundredMillion = num / 100_000_000;
    return {
      main: hundredMillion.toFixed(hundredMillion >= 100 ? 0 : 1),
      unit: "억원"
    };
  }

  // 만원 단위
  if (Math.abs(num) >= 10_000) {
    const tenThousand = num / 10_000;
    return {
      main: tenThousand.toFixed(tenThousand >= 1000 ? 0 : 1),
      unit: "만원"
    };
  }

  // 그 외는 기본 포맷
  return {
    main: num.toLocaleString(),
    unit: "원"
  };
}

function formatDetailValue(value: number): string {
  return `${value.toLocaleString()}원`;
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

export default function ListMarketcap({ data }: Props) {
    const lastDatesOfDec = useMemo(() => getLatestDecemberDates(data), [data]);
    const rows = useMemo(() => calculateChangeRates(data, lastDatesOfDec), [data, lastDatesOfDec]);
    return <DetailAnnualTable rows={rows} label="시가총액" formatDetailValue={value => value == null || !Number.isFinite(value) ? '—' : formatDetailValue(value)} formatValue={value => { if (value == null || !Number.isFinite(value)) return '—'; const formatted = formatMarketcapSimple(value); return `${formatted.main}${formatted.unit}`; }} />;
}
