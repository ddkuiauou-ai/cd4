"use client";
import { DetailAnnualTable } from './detail-annual-table';
import { detailAnnualRows } from '@/lib/detail-presentation';
import { formatBusinessValue, formatCompactBusinessValue, type BusinessValue } from '@/lib/business-analysis';

export default function ListDPSMarketcap({ data }: { data: Array<{ date: string; value: BusinessValue }> }) {
  return <DetailAnnualTable rows={detailAnnualRows(data,'dps')} label="DPS"
    formatValue={value => value == null ? '—' : `${formatCompactBusinessValue(value)}원`}
    formatDetailValue={value => value == null ? '—' : `${formatBusinessValue(value)}원`} />;
}
