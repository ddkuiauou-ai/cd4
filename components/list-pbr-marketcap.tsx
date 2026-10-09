"use client";
import { DetailAnnualTable } from './detail-annual-table';
import { detailAnnualRows } from '@/lib/detail-presentation';
import { formatBusinessValue, formatCompactBusinessValue, type BusinessValue } from '@/lib/business-analysis';

export default function ListPBRMarketcap({ data }: { data: Array<{ date: string; value: BusinessValue }> }) {
  return <DetailAnnualTable rows={detailAnnualRows(data,'pbr')} label="PBR"
    formatValue={value => value == null ? '—' : `${formatCompactBusinessValue(value)}배`}
    formatDetailValue={value => value == null ? '—' : `${formatBusinessValue(value)}배`} />;
}
