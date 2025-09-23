"use client";

import { usePathname } from "next/navigation";
import { formatNumber } from "@/lib/utils";

interface MarketcapSidebarFilterProps {
    companySecs: any[];
    currentTicker: string;
    companyMarketcapData: any;
    market: string;
}

export function MarketcapSidebarFilter({
    companySecs,
    currentTicker,
    companyMarketcapData,
    market
}: MarketcapSidebarFilterProps) {
    const pathname = usePathname();

    // 필터 버튼 클릭 핸들러
    const handleFilterClick = () => {
        window.history.pushState(null, '', pathname);
        // 페이지 새로고침하여 차트 업데이트
        window.location.reload();
    };

    const handleTotalClick = () => {
        window.history.pushState(null, '', pathname);
        window.location.reload();
    };

    return (
        <div className="space-y-3">
            {companySecs
                .filter(sec => sec.type && (sec.type.includes("보통주") || sec.type.includes("우선주")))
                .sort((a, b) => {
                    if (a.type?.includes("보통주") && !b.type?.includes("보통주")) return -1;
                    if (!a.type?.includes("보통주") && b.type?.includes("보통주")) return 1;
                    return (a.type || "").localeCompare(b.type || "");
                })
                .slice(0, 4) // 최대 4개까지만 표시
                .map((sec) => {
                    const isCurrentSecurity = sec.ticker === currentTicker;
                    const latestMarketcap = sec.marketcaps?.[0]?.marketcap || 0;

                    return (
                        <button
                            key={sec.securityId}
                            onClick={handleFilterClick}
                            className={`block w-full p-3 rounded-lg border transition-all hover:shadow-sm text-left ${isCurrentSecurity
                                    ? 'bg-primary/5 border-primary/20 shadow-sm'
                                    : 'hover:bg-muted/50'
                                }`}
                        >
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm font-medium ${isCurrentSecurity ? 'text-primary' : 'text-foreground'
                                        }`}>
                                        {sec.type}
                                    </span>
                                    {isCurrentSecurity && (
                                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                                    )}
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">시가총액</span>
                                    <span className="font-medium">
                                        {latestMarketcap > 0 ? formatNumber(latestMarketcap) + "원" : "—"}
                                    </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">티커</span>
                                    <span className="font-mono text-muted-foreground">{sec.ticker}</span>
                                </div>
                            </div>
                        </button>
                    );
                })}

            {/* 시가총액 구성 전체 보기 버튼 */}
            <button
                onClick={handleTotalClick}
                className="block w-full p-3 rounded-lg border transition-all hover:shadow-sm text-left hover:bg-muted/50"
            >
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                            시가총액 구성
                        </span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">전체 종목</span>
                        <span className="font-medium">
                            {companyMarketcapData?.totalMarketcap ? formatNumber(companyMarketcapData.totalMarketcap) + "원" : "—"}
                        </span>
                    </div>
                </div>
            </button>

            {companySecs.filter(sec => sec.type?.includes("보통주") || sec.type?.includes("우선주")).length > 4 && (
                <div className="text-center pt-2">
                    <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        +{companySecs.filter(sec => sec.type?.includes("보통주") || sec.type?.includes("우선주")).length - 4}개 더보기
                    </button>
                </div>
            )}
        </div>
    );
}
