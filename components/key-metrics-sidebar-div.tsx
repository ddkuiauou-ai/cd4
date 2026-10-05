"use client";
import { DetailMetricFacts } from './detail-metric-facts';

interface KeyMetricsSidebarDIVProps {
    divRank: number | null;
    latestDIV: number | null;
    div12Month: number | null;
    div3Year: number | null;
    div5Year: number | null;
    div10Year: number | null;
    div20Year: number | null;
    rangeMin: number | null;
    rangeMax: number | null;
    currentPrice: number | null;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebarDIV(props: KeyMetricsSidebarDIVProps) {
    const format = (value: number | null) => value != null && Number.isFinite(value) ? `${value.toFixed(2)}%` : '—';
    const price = props.currentPrice;
    return <DetailMetricFacts onCollapsedChange={props.onCollapsedChange} rows={[
        ['배당수익률 순위', props.divRank != null ? `${props.divRank}위` : '—'],
        ['현재 배당수익률', format(props.latestDIV)],
        ['현재 주가', price != null ? `${price.toLocaleString('ko-KR')}원` : '—'],
        ['12개월 평균', format(props.div12Month)],
        ['3년 평균', format(props.div3Year)],
        ['5년 평균', format(props.div5Year)],
        ['최저 배당수익률', format(props.rangeMin)],
        ['최고 배당수익률', format(props.rangeMax)],
    ]} note="평균·최저·최고는 이력 데이터 기준입니다." />;
}
