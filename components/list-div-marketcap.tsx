"use client";
import { DetailAnnualTable } from './detail-annual-table';
import { detailAnnualRows } from '@/lib/detail-presentation';
import { formatBusinessValue, formatCompactBusinessValue, type BusinessValue } from '@/lib/business-analysis';

export default function ListDIVMarketcap({ data }: { data: Array<{ date: string; value: BusinessValue }> }) {
  return <DetailAnnualTable rows={detailAnnualRows(data,'div')} label="DIV"
    formatValue={value => value == null ? '—' : `${formatCompactBusinessValue(value)}%`}
    formatDetailValue={value => value == null ? '—' : `${formatBusinessValue(value)}%`} />;
}
