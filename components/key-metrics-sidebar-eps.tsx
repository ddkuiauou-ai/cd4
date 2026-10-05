"use client";
import { DetailMetricFacts } from './detail-metric-facts';

interface KeyMetricsSidebarEPSProps {
    epsRank: number | null;
    latestEPS: number | null;
    eps12Month: number | null;
    eps3Year: number | null;
    eps5Year: number | null;
    eps10Year: number | null;
    eps20Year: number | null;
    rangeMin: number | null;
    rangeMax: number | null;
    currentPrice: number | null;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebarEPS(props: KeyMetricsSidebarEPSProps) {
    const format = (value: number | null) => value != null && Number.isFinite(value) ? `${Math.round(value).toLocaleString('ko-KR')}원` : '—';
    const price = props.currentPrice;
    return <DetailMetricFacts onCollapsedChange={props.onCollapsedChange} rows={[
        ['EPS 순위', props.epsRank != null ? `${props.epsRank}위` : '—'],
        ['현재 EPS', format(props.latestEPS)],
        ['현재 주가', price != null ? `${price.toLocaleString('ko-KR')}원` : '—'],
        ['12개월 평균', format(props.eps12Month)],
        ['3년 평균', format(props.eps3Year)],
        ['5년 평균', format(props.eps5Year)],
        ['최저 EPS', format(props.rangeMin)],
        ['최고 EPS', format(props.rangeMax)],
    ]} note="평균·최저·최고는 이력 데이터 기준입니다." />;
}
