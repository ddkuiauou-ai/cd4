"use client";

import Link from "next/link";
import { useEffect, useId, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight, X } from "lucide-react";
import {
    removeRecentlyViewedSecurity, clearRecentlyViewedSecurities, METRIC_CONFIG,
    formatMetricValue, getLastViewedMetric,
    getRecentSecurityKey, getRecentSecurityPath, migrateRecentSecurityIdentities, repairRecentlyViewedSecurities,
    getRecentSecuritiesSnapshot, subscribeRecentSecurities,
} from "@/lib/recent-securities";
import { useSearchData } from './search-data';
import { RecentPanelTrigger } from './recent-panel-trigger';
import styles from './recent-securities-sidebar.module.css';

export function RecentSecuritiesSidebar({ currentSecCode, variant = 'full' }: { currentSecCode?: string; variant?: 'full' | 'ranking-preview' }) {
    const snapshot = useSyncExternalStore(subscribeRecentSecurities, getRecentSecuritiesSnapshot, () => null);
    const securities = snapshot ?? [];
    const mounted = snapshot !== null;
    const pathname = usePathname();
    const headingId = useId();
    const { data: searchData, status: searchStatus } = useSearchData(false);
    useEffect(() => { repairRecentlyViewedSecurities(); }, []);
    useEffect(() => {
        if (searchStatus === 'success') migrateRecentSecurityIdentities(searchData);
    }, [pathname, searchData, searchStatus]);
    const preview = variant === 'ranking-preview';
    const displaySecurities = preview ? securities.slice(0, 4) : securities;

    return (
        <section className={`recent-securities space-y-3${preview ? ` ${styles.preview}` : ''}`} aria-labelledby={headingId}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={headingId} className="text-base font-semibold">최근 본 종목</h2>
                {preview && mounted ? <span className={styles.count}>{securities.length}개</span> : securities.length > 0 && <button type="button" onClick={() => clearRecentlyViewedSecurities()}
                    className="min-h-9 text-xs text-muted-foreground hover:text-foreground">전체 삭제</button>}
            </div>
            {!mounted ? <p className="py-4 text-sm text-muted-foreground" role="status">최근 본 종목을 불러오는 중…</p>
                : securities.length === 0 ? <p className="py-4 text-sm text-muted-foreground">종목을 둘러보면 이곳에 표시됩니다.</p>
                : <ul className={preview ? styles.previewList : "divide-y divide-border rounded-sm border border-border bg-background"}>
                    {displaySecurities.map(security => {
                        const metric = getLastViewedMetric(security);
                        const value = security.metrics[metric]?.value ?? null;
                        return <li key={getRecentSecurityKey(security)} className="flex items-center">
                            <Link href={getRecentSecurityPath(security)} prefetch={false}
                                aria-current={security.secCode === currentSecCode || security.securityId === currentSecCode ? 'page' : undefined}
                                className="min-w-0 flex-1 px-3 py-3 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                                <span className="block truncate text-sm font-medium">{security.korName || security.name}</span>
                                <span className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                                    <span>{security.ticker} · {security.exchange}</span>
                                    {!preview && <span className="shrink-0">{METRIC_CONFIG[metric].label} {formatMetricValue(metric, value)}</span>}
                                </span>
                            </Link>
                            {!preview && <button type="button" onClick={() => removeRecentlyViewedSecurity(security.secCode)}
                                aria-label={`${security.korName || security.name} 최근 기록 삭제`}
                                className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>}
                        </li>;
                    })}
                </ul>}
            {preview && securities.length > 0 && <RecentPanelTrigger className={styles.allRecords}>전체 기록 보기 <ArrowUpRight size={16} aria-hidden="true" /></RecentPanelTrigger>}
        </section>
    );
}
