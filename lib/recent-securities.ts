import { formatBusinessValue, formatCompactBusinessValue } from "./business-analysis";
import { companyPath, companyRouteCodes, securityPath, securityRouteCodes, type SecurityRouteIdentity } from './entity-paths';
/**
 * 최근 본 종목 관리 유틸리티
 * 로컬 스토리지를 사용하여 최근 본 종목을 저장하고 관리합니다.
 */

export interface RecentlyViewedSecurity {
    secCode: string; // "KOSPI.005930"
    securityId?: string;
    routeCode?: string | null;
    lastPath?: string;
    name: string; // 영문명
    korName?: string; // 한글명
    ticker: string; // "005930"
    exchange: string; // "KOSPI"
    lastViewed: number; // 마지막 방문 타임스탬프
    lastMetric?: MetricType; // 기존 저장 항목과 호환되는 마지막 지표
    metrics: {
        per?: { value: number | string | null; lastViewed: number };
        marketcap?: { value: number | string | null; lastViewed: number };
        bps?: { value: number | string | null; lastViewed: number };
        eps?: { value: number | string | null; lastViewed: number };
        pbr?: { value: number | string | null; lastViewed: number };
        div?: { value: number | string | null; lastViewed: number };
        dps?: { value: number | string | null; lastViewed: number };
    };
}

const STORAGE_KEY = 'recently-viewed-securities';
const MAX_RECENT_SECURITIES = 10;
let snapshotText: string | null | undefined;
let snapshotRows: RecentlyViewedSecurity[] = [];

export function getRecentSecuritiesSnapshot(): RecentlyViewedSecurity[] {
    let stored: string | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* Storage may be disabled. */ }
    if (stored !== snapshotText) {
        snapshotText = stored;
        snapshotRows = getRecentlyViewedSecurities();
    }
    return snapshotRows;
}

export function subscribeRecentSecurities(listener: () => void): () => void {
    const onStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY || event.key === null) listener();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
}

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
export function formatMetricValue(type: string, value: number | string | null): string {
    const ratio = type === 'per' || type === 'pbr' || type === 'div';
    const formatted = ratio ? formatBusinessValue(value) : formatCompactBusinessValue(value);
    return formatted === '—' ? formatted : `${formatted}${type === 'per' || type === 'pbr' ? '배' : type === 'div' ? '%' : '원'}`;
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

        const parsed: unknown = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item): item is RecentlyViewedSecurity =>
            item && typeof item.secCode === 'string' && typeof item.ticker === 'string' &&
            typeof item.name === 'string' && typeof item.exchange === 'string' &&
            Number.isFinite(item.lastViewed) && item.metrics && typeof item.metrics === 'object'
        ).sort((a, b) => b.lastViewed - a.lastViewed).slice(0, MAX_RECENT_SECURITIES);
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
    metricValue?: number | string | null
): void {
    if (typeof window === 'undefined') return;

    try {
        const securities = getRecentlyViewedSecurities();
        const now = Date.now();
        const secCode = security.secCode;

        // 기존 항목 찾기 및 업데이트
        const existingIndex = securities.findIndex(s => security.securityId && s.securityId
            ? s.securityId === security.securityId : s.secCode === secCode);

        if (existingIndex >= 0) {
            // 기존 항목 업데이트 및 맨 앞으로 이동
            const existing = securities.splice(existingIndex, 1)[0];
            Object.assign(existing, security, { lastMetric: metricType });
            existing.lastPath = security.lastPath || securityPath({ securityId: existing.securityId || secCode, routeCode: existing.routeCode ?? existing.secCode }, metricType);
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
                lastMetric: metricType,
                lastPath: security.lastPath || securityPath({ securityId: security.securityId || secCode, routeCode: secCode }, metricType),
                lastViewed: now,
                metrics: {
                    [metricType]: { value: metricValue ?? null, lastViewed: now }
                }
            });
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(securities.slice(0, MAX_RECENT_SECURITIES)));
        notifyRecentSecuritiesChanged();
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
        notifyRecentSecuritiesChanged();
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
        notifyRecentSecuritiesChanged();
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

/** Same-tab updates use the same event as cross-tab changes. */
function notifyRecentSecuritiesChanged() {
    window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEY, newValue: localStorage.getItem(STORAGE_KEY),
    }));
}

export function getLastViewedMetric(security: RecentlyViewedSecurity): MetricType {
    if (security.lastMetric && security.lastMetric in METRIC_CONFIG) return security.lastMetric;
    return (Object.entries(security.metrics)
        .filter(([type, data]) => type in METRIC_CONFIG && data)
        .sort((a, b) => (b[1]?.lastViewed ?? 0) - (a[1]?.lastViewed ?? 0))[0]?.[0] ?? 'marketcap') as MetricType;
}

export function getRecentSecurityPath(security: RecentlyViewedSecurity): string {
    if (security.lastPath && /^\/(security|company)\/[^/?#]+(?:\/(marketcap|per|pbr|eps|bps|div|dps))?\/?$/.test(security.lastPath)) return security.lastPath;
    return securityPath({ securityId: security.securityId || security.secCode, routeCode: security.secCode }, getLastViewedMetric(security));
}

/** Upgrade old aliases only after a unique match in the complete identity inventory. */
export function migrateRecentSecurityIdentities(identities: readonly (SecurityRouteIdentity & { companyId?: string | null; type?: string | null; delistingDate?: Date | string | null })[]): void {
    if (typeof window === 'undefined') return;
    const recent = getRecentlyViewedSecurities();
    const aliases = securityRouteCodes(identities);
    const companies = companyRouteCodes(identities.map(identity => ({ ...identity, companyId: identity.companyId ?? null })));
    const result = new Map<string, RecentlyViewedSecurity>();
    for (const item of recent) {
        const byId = identities.find(identity => identity.securityId === (item.securityId || item.secCode));
        const matches = byId ? [byId] : identities.filter(identity => `${identity.exchange}.${identity.ticker}` === item.secCode);
        const identity = matches.length === 1 ? matches[0] : null;
        const routeCode = identity ? aliases.get(identity.securityId) ?? null : item.routeCode;
        const pathMatch = item.lastPath?.match(/^\/(security|company)\/[^/?#]+(?:\/(marketcap|per|pbr|eps|bps|div|dps))?\/?$/);
        const path = !identity ? item.lastPath : pathMatch?.[1] === 'security'
            ? securityPath({ ...identity, routeCode }, pathMatch[2])
            : pathMatch?.[1] === 'company' && identity.companyId
                ? companyPath({ companyId: identity.companyId, routeCode: companies.get(identity.companyId) ?? null }, pathMatch[2])
                : securityPath({ ...identity, routeCode }, getLastViewedMetric(item));
        const updated: RecentlyViewedSecurity = identity ? { ...item, securityId: identity.securityId, routeCode,
            secCode: routeCode || identity.securityId,
            lastPath: path } : item;
        const key = updated.securityId || updated.secCode;
        const previous = result.get(key);
        if (!previous) result.set(key, updated);
        else {
            const merged = { ...updated.metrics, ...previous.metrics };
            for (const metric of Object.keys(updated.metrics) as MetricType[]) {
                if ((updated.metrics[metric]?.lastViewed ?? 0) > (merged[metric]?.lastViewed ?? 0)) merged[metric] = updated.metrics[metric];
            }
            result.set(key, { ...previous, metrics: merged });
        }
    }
    const migrated = [...result.values()].sort((a, b) => b.lastViewed - a.lastViewed).slice(0, MAX_RECENT_SECURITIES);
    if (JSON.stringify(migrated) !== JSON.stringify(recent)) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)); notifyRecentSecuritiesChanged(); } catch { /* Keep the readable records when storage is unavailable. */ }
    }
}
