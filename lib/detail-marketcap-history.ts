import type { DetailCompanyData } from '@/components/detail-types';

export type DetailMarketcapObservation = { date: Date | string; value: number };

/** Aggregation fills absent securities with zero and can omit all-zero dates. */
export function getSecurityMarketcapHistory(data: DetailCompanyData, securityId: string): DetailMarketcapObservation[] {
    return data?.securities.find(item => item.securityId === securityId)?.marketcapHistory
        .filter(item => item.marketcap != null && Number.isFinite(item.marketcap) && !Number.isNaN(new Date(item.date).getTime()))
        .map(item => ({ date: item.date, value: item.marketcap })) ?? [];
}

export function describeMarketcapHistory(history: DetailMarketcapObservation[]) {
    const dates = history.map(item => new Date(item.date))
        .filter(date => !Number.isNaN(date.getTime()))
        .map(date => date.toISOString().slice(0, 10)).sort();
    if (!dates.length) return '이력 통계: 기록 없음.';
    const first = dates[0];
    const last = dates[dates.length - 1];
    return first === last ? `이력 통계: 마지막 기록 ${last}.` : `이력 통계 범위 ${first} ~ ${last} (마지막 기록).`;
}

export const DETAIL_HISTORY_PERIOD_NOTE = '기간 평균·비교는 오늘 기준으로 계산합니다.';
