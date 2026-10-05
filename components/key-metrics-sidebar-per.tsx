"use client";
import { DetailMetricFacts } from './detail-metric-facts';

interface KeyMetricsSidebarPERProps {
    perRank: number | null;
    latestPER: number | null;
    per12Month: number | null;
    per3Year: number | null;
    per5Year: number | null;
    per10Year: number | null;
    per20Year: number | null;
    rangeMin: number | null;
    rangeMax: number | null;
    currentPrice: number | null;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebarPER(props: KeyMetricsSidebarPERProps) {
    const format = (value: number | null) => value != null && Number.isFinite(value) ? `${value.toFixed(2)}배` : '—';
    const price = props.currentPrice;
    return <DetailMetricFacts onCollapsedChange={props.onCollapsedChange} rows={[
        ['PER 순위', props.perRank != null ? `${props.perRank}위` : '—'],
        ['현재 PER', format(props.latestPER)],
        ['현재 주가', price != null ? `${price.toLocaleString('ko-KR')}원` : '—'],
        ['12개월 평균', format(props.per12Month)],
        ['3년 평균', format(props.per3Year)],
        ['5년 평균', format(props.per5Year)],
        ['최저 PER', format(props.rangeMin)],
        ['최고 PER', format(props.rangeMax)],
    ]} note="평균·최저·최고는 이력 데이터 기준입니다." />;
}
