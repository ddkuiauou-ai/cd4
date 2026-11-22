"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import {
    removeRecentlyViewedSecurity, clearRecentlyViewedSecurities, METRIC_CONFIG,
    formatMetricValue, getLastViewedMetric,
    getRecentSecurityKey, getRecentSecurityPath, getRecentSecurityPreview, migrateRecentSecurityIdentities, repairRecentlyViewedSecurities,
    getRecentSecuritiesSnapshot, subscribeRecentSecurities,
} from "@/lib/recent-securities";
import { useSearchData } from './search-data';
import { RecentPanelTrigger, useRecentPanelOpen } from './recent-panel-trigger';
import styles from './recent-securities-sidebar.module.css';

export function RecentSecuritiesSidebar({ currentSecCode, variant = 'full' }: { currentSecCode?: string; variant?: 'full' | 'preview' }) {
    const snapshot = useSyncExternalStore(subscribeRecentSecurities, getRecentSecuritiesSnapshot, () => null);
    const securities = snapshot ?? [];
    const mounted = snapshot !== null;
    const pathname = usePathname();
    const headingId = useId();
    const moreRecordsId = useId();
    const previewListsRef = useRef<HTMLDivElement>(null);
    const [hovered, setHovered] = useState(false);
    const [keptExpanded, setKeptExpanded] = useState(false);
    const panelOpenedFromPreview = useRecentPanelOpen(true);
    const { data: searchData, status: searchStatus } = useSearchData();
    useEffect(() => { repairRecentlyViewedSecurities(); }, []);
    useEffect(() => {
        if (searchStatus === 'success') migrateRecentSecurityIdentities(searchData);
    }, [pathname, searchData, searchStatus]);
    const preview = variant === 'preview';
    const expanded = hovered || keptExpanded || panelOpenedFromPreview;
    const displaySecurities = preview ? securities.slice(0, 3) : securities;

    useLayoutEffect(() => {
        const list = previewListsRef.current;
        if (!list || typeof ResizeObserver === 'undefined') return;

        const measure = () => {
            if (!list.clientWidth) return;
            for (const row of list.querySelectorAll('li')) {
                const link = row.querySelector('a');
                const button = row.querySelector('button');
                if (!link || !button) continue;
                // Use each label's content width even when the link has wrapped or clipped it.
                const textWidth = Array.from(link.children, text => Math.max(text.scrollWidth, text.getBoundingClientRect().width))
                    .reduce((total, width) => total + width, 0);
                const gap = parseFloat(getComputedStyle(link).columnGap) || 0;
                const deleteRoom = Math.max(0, Math.floor(row.clientWidth - textWidth - gap));
                row.toggleAttribute('data-delete-on-interaction', deleteRoom < button.offsetWidth);
                row.style.setProperty('--preview-delete-room', `${deleteRoom}px`);
            }
        };

        measure();
        let frame = 0;
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(measure);
        });
        observer.observe(list);
        list.querySelectorAll('a > span').forEach(text => observer.observe(text));
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [preview, snapshot]);

    const renderList = (records: typeof securities, label?: string) => (
        <ul aria-label={label} className={preview ? styles.previewList : "divide-y divide-border rounded-sm border border-border bg-background"}>
            {records.map(security => {
                const href = getRecentSecurityPath(security);
                const name = security.korName || security.name;
                const recentView = preview ? getRecentSecurityPreview(security, href) : undefined;
                const metric = preview ? null : getLastViewedMetric(security);
                const value = metric ? security.metrics[metric]?.value ?? null : null;
                return <li key={getRecentSecurityKey(security)} className="flex items-center">
                    <Link href={href} prefetch={false}
                        aria-current={currentSecCode && (security.secCode === currentSecCode || security.securityId === currentSecCode) ? 'page' : undefined}
                        aria-label={recentView?.valueText ? `${name} ${recentView.valueText}` : undefined}
                        className="min-w-0 flex-1 px-3 py-3 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                        <span className="block truncate text-sm font-medium">{name}</span>
                        {recentView ? <span className={styles.previewDetail} title={recentView.valueText ? recentView.label : undefined}>
                            {recentView.valueText ?? recentView.label}
                        </span>
                            : <span className="mt-1 flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                            <span>{security.ticker} · {security.exchange}</span>
                            {metric && <span>{METRIC_CONFIG[metric].label} {formatMetricValue(metric, value)}</span>}
                        </span>}
                    </Link>
                    <button type="button" onClick={event => {
                        const row = event.currentTarget.closest('li');
                        const nextFocus = preview && (row?.nextElementSibling?.querySelector('button')
                            ?? row?.previousElementSibling?.querySelector('button')
                            ?? document.getElementById(headingId));
                        removeRecentlyViewedSecurity(security.secCode);
                        if (nextFocus) nextFocus.focus({ preventScroll: true });
                    }} aria-label={`${name} 최근 기록 삭제`}
                        className={preview ? styles.previewDelete : 'mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground'}>
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                </li>;
            })}
        </ul>
    );

    return (
        <section className={`recent-securities ${preview ? styles.preview : 'space-y-3'}`} aria-labelledby={headingId}
            data-recent-preview={preview || undefined} data-recent-expanded={preview ? expanded : undefined}
            onPointerEnter={preview ? event => { if (event.pointerType === 'mouse') setHovered(true); } : undefined}
            onPointerLeave={preview ? event => { if (event.pointerType === 'mouse') setHovered(false); } : undefined}
            onFocus={preview ? event => {
                if (event.target.matches(':focus-visible') && event.target.getAttribute('aria-controls') !== moreRecordsId) setKeptExpanded(true);
            } : undefined}
            onBlur={preview ? event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setKeptExpanded(false);
            } : undefined}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-2">
                    <h2 id={headingId} tabIndex={preview ? -1 : undefined} className="text-base font-semibold">최근 본 종목</h2>
                    {mounted && <span className={styles.count}>{securities.length}개</span>}
                </div>
                {!preview && securities.length > 0 && <button type="button" onClick={() => clearRecentlyViewedSecurities()}
                    className="min-h-9 text-xs text-muted-foreground hover:text-foreground">전체 삭제</button>}
            </div>
            {!mounted ? <p className="py-4 text-sm text-muted-foreground" role="status">최근 본 종목을 불러오는 중…</p>
                : securities.length === 0 ? <p className="py-4 text-sm text-muted-foreground">종목을 둘러보면 이곳에 표시됩니다.</p>
                : preview ? <div ref={previewListsRef}>
                    {renderList(displaySecurities)}
                    <div id={moreRecordsId} className={styles.extraRecords} inert={!expanded}>
                        <div className={styles.extraRecordsClip}>
                            {securities.length > 3 && renderList(securities.slice(3, 5), '추가 최근 본 종목')}
                        </div>
                    </div>
                </div> : renderList(displaySecurities)}
            {preview && securities.length > 0 && <RecentPanelTrigger className={styles.allRecords}
                previewDisclosure={expanded ? undefined : { controls: moreRecordsId, expand: () => setKeptExpanded(true) }}>
                <span className={styles.allRecordsLabel} aria-hidden={!expanded}>전체 기록 보기</span>
                <ChevronDown size={16} aria-hidden="true" />
            </RecentPanelTrigger>}
        </section>
    );
}
