"use client";
import { DetailMetricFacts } from './detail-metric-facts';

interface KeyMetricsSidebarDPSProps {
    dpsRank: number | null;
    latestDPS: number | null;
    dps12Month: number | null;
    dps3Year: number | null;
    dps5Year: number | null;
    dps10Year: number | null;
    dps20Year: number | null;
    rangeMin: number | null;
    rangeMax: number | null;
    currentPrice: number | null;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebarDPS(props: KeyMetricsSidebarDPSProps) {
    const format = (value: number | null) => value != null && Number.isFinite(value) ? `${Math.round(value).toLocaleString('ko-KR')}원` : '—';
    const price = props.currentPrice;
    return <DetailMetricFacts onCollapsedChange={props.onCollapsedChange} rows={[
        ['주당배당금 순위', props.dpsRank != null ? `${props.dpsRank}위` : '—'],
        ['현재 주당배당금', format(props.latestDPS)],
        ['현재 주가', price != null ? `${price.toLocaleString('ko-KR')}원` : '—'],
        ['12개월 평균', format(props.dps12Month)],
        ['3년 평균', format(props.dps3Year)],
        ['5년 평균', format(props.dps5Year)],
        ['최저 주당배당금', format(props.rangeMin)],
        ['최고 주당배당금', format(props.rangeMax)],
    ]} note="평균·최저·최고는 이력 데이터 기준입니다." />;
}
