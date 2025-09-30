/**
 * 최근 본 종목 관리 유틸리티
 * 로컬 스토리지를 사용하여 최근 본 종목을 저장하고 관리합니다.
 */

export interface RecentlyViewedSecurity {
    secCode: string; // "KOSPI.005930"
    name: string; // 영문명
    korName?: string; // 한글명
    ticker: string; // "005930"
    exchange: string; // "KOSPI"
    lastViewed: number; // 마지막 방문 타임스탬프
    metrics: {
        per?: { value: number | null; lastViewed: number };
        marketcap?: { value: number | null; lastViewed: number };
        bps?: { value: number | null; lastViewed: number };
        eps?: { value: number | null; lastViewed: number };
        pbr?: { value: number | null; lastViewed: number };
        div?: { value: number | null; lastViewed: number };
        dps?: { value: number | null; lastViewed: number };
    };
}

const STORAGE_KEY = 'recently-viewed-securities';
const MAX_RECENT_SECURITIES = 10;

// 메트릭 설정 (우선순위와 라벨)
export const METRIC_CONFIG = {
    marketcap: { priority: 1, label: '시총' },
    per: { priority: 2, label: 'PER' },
    div: { priority: 3, label: '배당' },
    dps: { priority: 4, label: '배당금' },
    bps: { priority: 5, label: 'BPS' },
    pbr: { priority: 6, label: 'PBR' },
    eps: { priority: 7, label: 'EPS' }
} as const;

// 메트릭 타입
export type MetricType = keyof typeof METRIC_CONFIG;

// 메트릭 값 포맷 함수
export function formatMetricValue(type: string, value: number | null): string {
    if (value === null) return '—';

    switch (type) {
        case 'marketcap':
            if (value >= 1e12) { // 1조 이상
                return `${(value / 1e12).toFixed(1)}조`;
            } else if (value >= 1e11) { // 1천억 이상
                return `${(value / 1e11).toFixed(1)}천억`;
            } else if (value >= 1e10) { // 1백억 이상
                return `${(value / 1e10).toFixed(1)}백억`;
            } else { // 그 이하
                return `${(value / 1e8).toFixed(1)}억`;
            }
        case 'per':
        case 'pbr': return `${value.toFixed(1)}배`;
        case 'div': return `${value.toFixed(1)}%`;
        case 'bps': return `${(value / 10000).toFixed(1)}만원`;
        case 'eps':
        case 'dps': return `${Math.round(value / 1000)}천원`;
        default: return value.toString();
    }
}

// 메트릭 라벨을 URL 파라미터로 변환
export function getMetricUrlParam(label: string): string {
    const typeMap: Record<string, string> = {
        '시총': 'marketcap',
        'PER': 'per',
        '배당': 'div',
        '배당금': 'dps',
        'BPS': 'bps',
        'PBR': 'pbr',
        'EPS': 'eps'
    };
    return typeMap[label] || 'per';
}

/**
 * 로컬 스토리지에서 최근 본 종목 목록을 가져옵니다.
 */
export function getRecentlyViewedSecurities(): RecentlyViewedSecurity[] {
    if (typeof window === 'undefined') return [];

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];

        const securities: RecentlyViewedSecurity[] = JSON.parse(stored);
        return securities.sort((a, b) => b.lastViewed - a.lastViewed); // 최신순 정렬
    } catch (error) {
        console.error('Failed to load recently viewed securities:', error);
        return [];
    }
}

/**
 * 로컬 스토리지에 최근 본 종목을 추가합니다.
 * 이미 존재하는 종목이면 해당 지표 정보를 업데이트합니다.
 */
export function addRecentlyViewedSecurity(
    security: Omit<RecentlyViewedSecurity, 'lastViewed' | 'metrics'>,
    metricType: MetricType,
    metricValue?: number | null
): void {
    if (typeof window === 'undefined') return;

    try {
        const securities = getRecentlyViewedSecurities();
        const now = Date.now();
        const secCode = security.secCode;

        // 기존 항목 찾기 및 업데이트
        const existingIndex = securities.findIndex(s => s.secCode === secCode);

        if (existingIndex >= 0) {
            // 기존 항목 업데이트 및 맨 앞으로 이동
            const existing = securities.splice(existingIndex, 1)[0];
            existing.metrics[metricType] = { value: metricValue ?? null, lastViewed: now };
            existing.lastViewed = now;
            securities.unshift(existing);
        } else {
            // 새 항목 추가 (최대 개수 제한 확인)
            if (securities.length >= MAX_RECENT_SECURITIES) {
                securities.pop(); // 가장 오래된 항목 제거
            }

            securities.unshift({
                ...security,
                lastViewed: now,
                metrics: {
                    [metricType]: { value: metricValue ?? null, lastViewed: now }
                }
            });
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(securities));
    } catch (error) {
        console.error('Failed to save recently viewed security:', error);
    }
}

/**
 * 특정 종목을 최근 본 종목 목록에서 제거합니다.
 */
export function removeRecentlyViewedSecurity(secCode: string): void {
    if (typeof window === 'undefined') return;

    try {
        const securities = getRecentlyViewedSecurities();
        const filteredSecurities = securities.filter(s => s.secCode !== secCode);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredSecurities));
    } catch (error) {
        console.error('Failed to remove recently viewed security:', error);
    }
}

/**
 * 최근 본 종목 목록을 모두 삭제합니다.
 */
export function clearRecentlyViewedSecurities(): void {
    if (typeof window === 'undefined') return;

    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error('Failed to clear recently viewed securities:', error);
    }
}

/**
 * 특정 종목이 최근 본 종목 목록에 있는지 확인합니다.
 */
export function isSecurityRecentlyViewed(secCode: string): boolean {
    const securities = getRecentlyViewedSecurities();
    return securities.some(s => s.secCode === secCode);
}
