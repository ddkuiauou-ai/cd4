import type { DetailSecurityRow, DetailCompanyData } from '@/components/detail-types';

type SecuritySnapshot = Pick<DetailSecurityRow, 'securityId' | 'marketcap' | 'marketcapDate'>;

/** Keep a value and its date together; a sibling's missing snapshot must not redate this security. */
export function getSecurityMarketcapSnapshot(security: SecuritySnapshot, data: DetailCompanyData) {
    if (security.marketcap != null) {
        return { value: security.marketcap, date: security.marketcapDate ?? null, fromHistory: false };
    }
    const normalized = data?.securities.find(item => item.securityId === security.securityId);
    const latest = normalized?.marketcapHistory.reduce<(typeof normalized.marketcapHistory)[number] | undefined>((last, item) => {
        if (item.marketcap == null || !Number.isFinite(item.marketcap) || Number.isNaN(new Date(item.date).getTime())) return last;
        return !last || new Date(item.date).getTime() > new Date(last.date).getTime() ? item : last;
    }, undefined);
    return latest
        ? { value: latest.marketcap, date: latest.date, fromHistory: true }
        : { value: normalized?.marketcap ?? null, date: normalized?.marketcapDate ?? null, fromHistory: true };
}
