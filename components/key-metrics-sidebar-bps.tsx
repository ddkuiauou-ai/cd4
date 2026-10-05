"use client";
import { DetailMetricFacts } from './detail-metric-facts';

interface KeyMetricsSidebarBPSProps {
    bpsRank: number | null;
    latestBPS: number | null;
    bps12Month: number | null;
    bps3Year: number | null;
    bps5Year: number | null;
    bps10Year: number | null;
    bps20Year: number | null;
    rangeMin: number | null;
    rangeMax: number | null;
    currentPrice: number | null;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebarBPS(props: KeyMetricsSidebarBPSProps) {
    const format = (value: number | null) => value != null && Number.isFinite(value) ? `${Math.round(value).toLocaleString('ko-KR')}원` : '—';
    const price = props.currentPrice;
    return <DetailMetricFacts onCollapsedChange={props.onCollapsedChange} rows={[
        ['BPS 순위', props.bpsRank != null ? `${props.bpsRank}위` : '—'],
        ['현재 BPS', format(props.latestBPS)],
        ['현재 주가', price != null ? `${price.toLocaleString('ko-KR')}원` : '—'],
        ['12개월 평균', format(props.bps12Month)],
        ['3년 평균', format(props.bps3Year)],
        ['5년 평균', format(props.bps5Year)],
        ['최저 BPS', format(props.rangeMin)],
        ['최고 BPS', format(props.rangeMax)],
    ]} note="평균·최저·최고는 이력 데이터 기준입니다." />;
}
