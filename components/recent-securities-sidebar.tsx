"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    type RecentlyViewedSecurity, type MetricType, getRecentlyViewedSecurities,
    removeRecentlyViewedSecurity, clearRecentlyViewedSecurities, METRIC_CONFIG,
    formatMetricValue, getLastViewedMetric,
} from "@/lib/recent-securities";

export function RecentSecuritiesSidebar({ currentSecCode }: { currentSecCode?: string }) {
    const [securities, setSecurities] = useState<RecentlyViewedSecurity[]>([]);
    const [mounted, setMounted] = useState(false);
    const [rankingOrder, setRankingOrder] = useState(false);
    const pathname = usePathname();
    const refresh = useCallback(() => setSecurities(getRecentlyViewedSecurities()), []);

    useEffect(() => { setMounted(true); refresh(); }, [pathname, refresh]);
    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key === 'recently-viewed-securities' || event.key === null) refresh();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, [refresh]);

    const displaySecurities = useMemo(() => {
        if (!rankingOrder) return securities;
        const scores = new Map<string, { score: number; count: number }>();
        for (const type of Object.keys(METRIC_CONFIG) as MetricType[]) {
            const values = securities.filter(s => s.metrics[type]?.value != null)
                .sort((a, b) => ['per', 'pbr'].includes(type)
                    ? a.metrics[type]!.value! - b.metrics[type]!.value!
                    : b.metrics[type]!.value! - a.metrics[type]!.value!);
            values.forEach((security, index) => {
                const previous = scores.get(security.secCode) ?? { score: 0, count: 0 };
                scores.set(security.secCode, { score: previous.score + index + 1, count: previous.count + 1 });
            });
        }
        const average = (s: RecentlyViewedSecurity) => {
            const result = scores.get(s.secCode);
            return result ? result.score / result.count : Infinity;
        };
        return [...securities].sort((a, b) => average(a) - average(b) || b.lastViewed - a.lastViewed);
    }, [securities, rankingOrder]);

    return (
        <section className="recent-securities space-y-3" aria-labelledby="recent-securities-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="recent-securities-title" className="text-base font-semibold">최근 본 종목</h2>
                {securities.length > 0 && <button type="button" onClick={() => clearRecentlyViewedSecurities()}
                    className="min-h-9 text-xs text-muted-foreground hover:text-foreground">전체 삭제</button>}
            </div>
            <div className="flex items-center gap-1 text-xs" aria-label="최근 본 종목 정렬">
                <button type="button" aria-pressed={!rankingOrder} onClick={() => setRankingOrder(false)}
                    className={cn('min-h-9 rounded-sm px-2', !rankingOrder ? 'bg-background font-semibold text-foreground' : 'text-muted-foreground')}>최신순</button>
                <button type="button" aria-pressed={rankingOrder} onClick={() => setRankingOrder(true)}
                    title="최근 본 종목 안에서 저장된 지표별 순위의 평균으로 정렬합니다. PER·PBR은 낮은 값, 나머지 지표는 높은 값 순입니다."
                    className={cn('min-h-9 rounded-sm px-2', rankingOrder ? 'bg-background font-semibold text-foreground' : 'text-muted-foreground')}>랭킹순</button>
            </div>
            {!mounted ? <p className="py-4 text-sm text-muted-foreground" role="status">최근 본 종목을 불러오는 중…</p>
                : securities.length === 0 ? <p className="py-4 text-sm text-muted-foreground">종목을 둘러보면 이곳에 표시됩니다.</p>
                : <ul className="divide-y divide-border rounded-sm border border-border bg-background">
                    {displaySecurities.map(security => {
                        const metric = getLastViewedMetric(security);
                        const value = security.metrics[metric]?.value ?? null;
                        return <li key={security.secCode} className="flex items-center">
                            <Link href={`/security/${security.secCode}/${metric}`}
                                aria-current={security.secCode === currentSecCode ? 'page' : undefined}
                                className="min-w-0 flex-1 px-3 py-3 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                                <span className="block truncate text-sm font-medium">{security.korName || security.name}</span>
                                <span className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                                    <span>{security.ticker} · {security.exchange}</span>
                                    <span className="shrink-0">{METRIC_CONFIG[metric].label} {formatMetricValue(metric, value)}</span>
                                </span>
                            </Link>
                            <button type="button" onClick={() => removeRecentlyViewedSecurity(security.secCode)}
                                aria-label={`${security.korName || security.name} 최근 기록 삭제`}
                                className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        </li>;
                    })}
                </ul>}
            {rankingOrder && securities.length > 0 && <p className="text-xs leading-relaxed text-muted-foreground">최근 본 종목의 저장된 지표를 비교한 순서입니다.</p>}
        </section>
    );
}
