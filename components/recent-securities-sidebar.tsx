"use client";

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Clock, X, TrendingUp, DollarSign, BarChart3, ArrowUpDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    RecentlyViewedSecurity,
    getRecentlyViewedSecurities,
    removeRecentlyViewedSecurity,
    clearRecentlyViewedSecurities,
    METRIC_CONFIG,
    formatMetricValue,
    getMetricUrlParam,
} from "@/lib/recent-securities";

interface RecentSecuritiesSidebarProps {
    currentSecCode?: string;
}

export function RecentSecuritiesSidebar({ currentSecCode }: RecentSecuritiesSidebarProps) {
    const [recentSecurities, setRecentSecurities] = useState<RecentlyViewedSecurity[]>([]);
    const [mounted, setMounted] = useState(false);
    const [isSortedByRanking, setIsSortedByRanking] = useState(false);
    const router = useRouter();
    const pathname = usePathname();


    // 이벤트 핸들러들을 useCallback으로 최적화
    const handleSecurityClick = useCallback((secCode: string, metric?: string) => {
        if (metric) {
            router.push(`/security/${secCode}/${metric}`);
        } else {
            router.push(`/security/${secCode}`);
        }
    }, [router]);

    const updateSecurities = useCallback(() => {
        const data = getRecentlyViewedSecurities();
        setRecentSecurities(data);
    }, []);

    const handleRemoveSecurity = useCallback((e: React.MouseEvent, secCode: string) => {
        e.stopPropagation();
        removeRecentlyViewedSecurity(secCode);
        updateSecurities();
    }, [updateSecurities]);

    // 지표 라인 포맷팅 함수 (재사용 가능하도록 분리)
    const formatMetricLine = useCallback((metrics: RecentlyViewedSecurity['metrics']) => {
        const metricEntries = Object.entries(metrics);
        if (metricEntries.length === 0) return null;

        // 우선순위에 따라 정렬 (모든 항목 표시)
        const sortedMetrics = metricEntries
            .filter(([type]) => type in METRIC_CONFIG) // 설정된 메트릭만
            .sort(([typeA], [typeB]) => {
                const priorityA = METRIC_CONFIG[typeA as keyof typeof METRIC_CONFIG]?.priority || 999;
                const priorityB = METRIC_CONFIG[typeB as keyof typeof METRIC_CONFIG]?.priority || 999;
                return priorityA - priorityB;
            }); // 모든 항목 표시

        const formattedMetrics = sortedMetrics.map(([type, data]) => {
            if (!data?.value) return null;

            const config = METRIC_CONFIG[type as keyof typeof METRIC_CONFIG];
            const label = config?.label || type.toUpperCase();
            const formattedValue = formatMetricValue(type, data.value);

            return `${label} ${formattedValue}`;
        }).filter(Boolean);

        return formattedMetrics.join(' | ');
    }, []);

    // 클라이언트 사이드에서만 실행
    useEffect(() => {
        setMounted(true);
        updateSecurities();
    }, [updateSecurities]);

    // 현재 경로가 변경될 때마다 최근 본 종목 목록 새로고침
    useEffect(() => {
        if (mounted) {
            updateSecurities();
        }
    }, [pathname, mounted, updateSecurities]);

    // localStorage 변경 감지 (다른 탭/창에서 변경된 경우)
    useEffect(() => {
        if (!mounted) return;

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'recently-viewed-securities') {
                updateSecurities();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [mounted, updateSecurities]);

    // 메트릭별 랭킹 계산 및 정렬
    const sortSecuritiesByRanking = useCallback((securities: RecentlyViewedSecurity[]) => {
        if (securities.length === 0) return securities;

        // 각 메트릭별로 값들을 수집
        const metricValues: Record<string, { secCode: string; value: number }[]> = {};

        securities.forEach(security => {
            Object.entries(security.metrics).forEach(([metricType, metricData]) => {
                if (metricData?.value !== null && metricData?.value !== undefined) {
                    if (!metricValues[metricType]) {
                        metricValues[metricType] = [];
                    }
                    metricValues[metricType].push({
                        secCode: security.secCode,
                        value: metricData.value
                    });
                }
            });
        });

        // 각 메트릭별로 순위 계산
        const rankingScores: Record<string, number> = {};

        Object.entries(metricValues).forEach(([metricType, values]) => {
            // 값들을 정렬 (낮은 값이 좋은 지표는 오름차순, 높은 값이 좋은 지표는 내림차순)
            const isLowerBetter = ['per', 'pbr'].includes(metricType); // 낮은 값이 좋은 지표들
            const sortedValues = [...values].sort((a, b) =>
                isLowerBetter ? a.value - b.value : b.value - a.value
            );

            // 각 값에 순위 부여 (1부터 시작, 공동 순위 처리)
            sortedValues.forEach((item, index) => {
                const rank = index + 1;
                if (!rankingScores[item.secCode]) {
                    rankingScores[item.secCode] = 0;
                }
                rankingScores[item.secCode] += rank;
            });
        });

        // 평균 순위 계산 및 정렬
        return securities.map(security => ({
            ...security,
            averageRank: rankingScores[security.secCode] ?
                rankingScores[security.secCode] / Object.keys(security.metrics).length : Infinity
        })).sort((a, b) => (a.averageRank || Infinity) - (b.averageRank || Infinity));
    }, []);

    const handleClearAll = useCallback(() => {
        clearRecentlyViewedSecurities();
        setRecentSecurities([]);
    }, []);

    const handleSortToggle = useCallback(() => {
        setIsSortedByRanking(prev => !prev);
    }, []);

    // 표시할 종목 리스트 (정렬 상태에 따라 다름)
    const displaySecurities = useMemo(() => {
        return isSortedByRanking ? sortSecuritiesByRanking(recentSecurities) : recentSecurities;
    }, [recentSecurities, isSortedByRanking, sortSecuritiesByRanking]);

    // 클라이언트 사이드에서만 렌더링
    if (!mounted) {
        return (
            <div className="rounded-xl border bg-background p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    최근 본 종목
                </h3>
                <div className="text-xs text-muted-foreground">로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="rounded-xl border bg-background p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    최근 본 종목
                </h3>
                <div className="flex items-center gap-2">
                    {recentSecurities.length > 1 && (
                        <div className="relative group">
                            <button
                                onClick={handleSortToggle}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleSortToggle();
                                    }
                                }}
                                className={cn(
                                    "text-xs transition-colors flex items-center gap-1 px-2 py-1 rounded pr-6 relative",
                                    isSortedByRanking
                                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                )}
                                aria-label={`정렬 방식: ${isSortedByRanking ? '랭킹순' : '최신순'}. 각 종목의 메트릭별 랭킹을 평균내어 순위를 매겨 정렬합니다. 낮은 PER/PBR은 좋은 점수, 높은 시가총액은 좋은 점수로 계산됩니다.`}
                            >
                                <ArrowUpDown className="h-3 w-3" />
                                {isSortedByRanking ? '랭킹순' : '최신순'}
                                <Info className="h-3 w-3 absolute right-1 top-1/2 transform -translate-y-1/2 text-current opacity-60 hover:opacity-100 transition-opacity cursor-help" />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-popover border rounded-md shadow-md text-xs text-popover-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none w-48 z-50 whitespace-normal text-center">
                                시총 1등 + PER 3등 = 통합 2등 (랭킹 평균으로 정렬)
                            </div>
                        </div>
                    )}
                    {recentSecurities.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleClearAll();
                                }
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="최근 본 종목 모두 삭제"
                        >
                            전체 삭제
                        </button>
                    )}
                </div>
            </div>

            {recentSecurities.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                    최근 본 종목이 없습니다
                </div>
            ) : (
                <div className="space-y-2">
                    {displaySecurities.map((security) => {
                        const metrics = security.metrics || {};

                        // 지표 정보를 한 줄로 포맷팅
                        const metricLine = formatMetricLine(metrics);

                        return (
                            <div
                                key={security.secCode}
                                className={cn(
                                    "group p-2 rounded-lg transition-all hover:bg-muted/50",
                                    security.secCode === currentSecCode && "bg-muted/70"
                                )}
                            >
                                {/* 종목명 행 + 삭제 버튼 */}
                                <div className="flex items-center gap-2">
                                    <button
                                        className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer hover:bg-transparent focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
                                        onClick={() => handleSecurityClick(security.secCode)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleSecurityClick(security.secCode);
                                            }
                                        }}
                                        aria-label={`${security.korName || security.name} 종목 상세 페이지로 이동`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <div className="text-sm font-medium text-foreground truncate">
                                                    {security.korName || security.name}
                                                </div>
                                                <div className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-[10px] flex-shrink-0">
                                                    {security.ticker}
                                                </div>
                                                <div className="text-xs text-muted-foreground flex-shrink-0">
                                                    {security.exchange}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={(e) => handleRemoveSecurity(e, security.secCode)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                // KeyboardEvent를 MouseEvent로 변환
                                                const mouseEvent = {
                                                    ...e,
                                                    button: 0,
                                                    buttons: 1,
                                                    clientX: 0,
                                                    clientY: 0,
                                                    pageX: 0,
                                                    pageY: 0,
                                                    screenX: 0,
                                                    screenY: 0,
                                                    stopPropagation: e.stopPropagation.bind(e),
                                                    preventDefault: e.preventDefault.bind(e),
                                                } as any;
                                                handleRemoveSecurity(mouseEvent, security.secCode);
                                            }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded flex-shrink-0 focus:opacity-100 focus:ring-2 focus:ring-primary focus:ring-offset-1"
                                        aria-label={`${security.korName || security.name} 종목 삭제`}
                                    >
                                        <X className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                </div>

                                {/* 메트릭 라인 */}
                                {metricLine && (
                                    <div className="text-xs text-muted-foreground leading-relaxed mt-1 cursor-pointer" onClick={() => handleSecurityClick(security.secCode)}>
                                        {(() => {
                                            const metrics = metricLine.split(' | ');
                                            return metrics.map((metric, index) => {
                                                // "시총 39조" 형태에서 "시총" 부분 추출
                                                const metricType = metric.split(' ')[0];
                                                const displayText = metric;

                                                const urlParam = getMetricUrlParam(metricType);

                                                return (
                                                    <span key={index}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSecurityClick(security.secCode, urlParam);
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    handleSecurityClick(security.secCode, urlParam);
                                                                }
                                                            }}
                                                            className="hover:text-foreground hover:underline transition-colors focus:outline-none focus:ring-1 focus:ring-primary focus:bg-muted/20 rounded px-0.5"
                                                            aria-label={`${security.korName || security.name} ${metricType} 페이지로 이동`}
                                                        >
                                                            {displayText}
                                                        </button>
                                                        {index < metrics.length - 1 && ' | '}
                                                    </span>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {displaySecurities.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground text-center">
                        최대 {displaySecurities.length}/10개 표시
                    </p>
                </div>
            )}
        </div>
    );
}

export default memo(RecentSecuritiesSidebar);
