"use client";
import { DetailMetricFacts } from './detail-metric-facts';
import { formatNumber } from '@/lib/utils';

interface KeyMetricsSidebarMARKETCAPProps {
    marketcapRank: number | null;
    latestMarketcap: number | null;
    marketcap12Month: number | null;
    marketcap3Year: number | null;
    marketcap5Year: number | null;
    marketcap10Year: number | null;
    marketcap20Year: number | null;
    rangeMin: number | null;
    rangeMax: number | null;
    currentPrice: number | null;
    onCollapsedChange?: (collapsed: boolean) => void;
}

export function KeyMetricsSidebarMARKETCAP(props: KeyMetricsSidebarMARKETCAPProps) {
    const format = (value: number | null) => value != null && Number.isFinite(value) ? `${formatNumber(value)}원` : '—';
    const price = props.currentPrice;
    return <DetailMetricFacts onCollapsedChange={props.onCollapsedChange} rows={[
        ['시가총액 순위', props.marketcapRank != null ? `${props.marketcapRank}위` : '—'],
        ['현재 시가총액', format(props.latestMarketcap)],
        ['현재 주가', price != null ? `${price.toLocaleString('ko-KR')}원` : '—'],
        ['12개월 평균', format(props.marketcap12Month)],
        ['3년 평균', format(props.marketcap3Year)],
        ['5년 평균', format(props.marketcap5Year)],
        ['최저 시가총액', format(props.rangeMin)],
        ['최고 시가총액', format(props.rangeMax)],
    ]} note="평균·최저·최고는 이력 데이터 기준입니다." />;
}
