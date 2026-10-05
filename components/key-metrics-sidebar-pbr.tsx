"use client";
import { DetailMetricFacts } from './detail-metric-facts';

interface KeyMetricsSidebarPBRProps {
    pbrRank: number | null;
    latestPBR: number | null;
    pbr12Month: number | null;
    pbr3Year: number | null;
    pbr5Year: number | null;
    pbr10Year: number | null;
    pbr20Year: number | null;
    rangeMin: number | null;
    rangeMax: number | null;
    currentPrice: number | null;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebarPBR(props: KeyMetricsSidebarPBRProps) {
    const format = (value: number | null) => value != null && Number.isFinite(value) ? `${value.toFixed(2)}배` : '—';
    const price = props.currentPrice;
    return <DetailMetricFacts onCollapsedChange={props.onCollapsedChange} rows={[
        ['PBR 순위', props.pbrRank != null ? `${props.pbrRank}위` : '—'],
        ['현재 PBR', format(props.latestPBR)],
        ['현재 주가', price != null ? `${price.toLocaleString('ko-KR')}원` : '—'],
        ['12개월 평균', format(props.pbr12Month)],
        ['3년 평균', format(props.pbr3Year)],
        ['5년 평균', format(props.pbr5Year)],
        ['최저 PBR', format(props.rangeMin)],
        ['최고 PBR', format(props.rangeMax)],
    ]} note="평균·최저·최고는 이력 데이터 기준입니다." />;
}
