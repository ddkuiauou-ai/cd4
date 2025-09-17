/*
█████████████████████████████████████████████████████████████████████████████████████████████████████
██ SECURITIES SECTION - 2x2 Grid Interactive Securities Component                                  ██
██                                                                                                 ██
██ 목적: 회사의 증권을 2x2 그리드로 배치하고 L자 연결로 시각화                                       ██
██ 기능: 카드 선택 → L자 연결 시각화 → 영역별 하이라이트                                              ██
██ 스타일: CD3 흑백 디자인 시스템 (black/white/gray only)                                            ██
██                                                                                                 ██
██ 2x2 Grid Layout:                                                                               ██
██ ┌─────────┬─────────┐                                                                           ██
██ │    1    │    2    │  1: 보통주 카드    2: 우선주 카드                                          ██
██ │ 보통주   │ 우선주   │                                                                           ██
██ ├─────────┴─────────┤                                                                           ██
██ │       3 & 4       │  3,4: 시가총액 구성 요약 (2칸 차지)                                        ██
██ │   시가총액 구성     │                                                                           ██
██ └───────────────────┘                                                                           ██
██                                                                                                 ██
██ 연결 영역:                                                                                        ██
██ - 보통주 선택: 1,3,4 영역 연결                                                                     ██
██ - 우선주 선택: 2,3,4 영역 연결                                                                     ██
██ - 시가총액 구성 선택: 1,2,3,4 전체 영역 연결                                                       ██
█████████████████████████████████████████████████████████████████████████████████████████████████████
*/

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import CardMarketcap from "@/components/card-marketcap";
import { MarketcapSummaryExpandable } from "@/components/marketcap-summary-expandable";

type FilterType = "all" | "보통주" | "우선주" | "시가총액 구성";

interface InteractiveSecuritiesSectionProps {
    companyMarketcapData: any;
    companySecs: any[];
    currentTicker: string;
    market: string;
    onTickerChange?: (newTicker: string) => void;
}

/**
 * SECURITIES SECTION - 2x2 Grid Interactive Component
 *
 * 회사의 증권 목록을 2x2 그리드로 배치하고 선택에 따라 영역을 시각적으로 연결
 */
export function InteractiveSecuritiesSection({
    companyMarketcapData,
    companySecs,
    currentTicker,
    market,
    onTickerChange
}: InteractiveSecuritiesSectionProps) {

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════    // ═══════════════════════════════════════════════════════════════════════════════════════════════════

    const [mounted, setMounted] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
    const [lShapePolygon, setLShapePolygon] = useState<string>("");
    const [isTransitioning, setIsTransitioning] = useState(false);

    const pathname = usePathname();
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const grid1Ref = useRef<HTMLDivElement>(null);  // 보통주 카드
    const grid2Ref = useRef<HTMLDivElement>(null);  // 우선주 카드
    const grid34Ref = useRef<HTMLDivElement>(null); // 시가총액 구성

    // 데이터 유효성 검증
    const hasValidData = Boolean(
        companyMarketcapData &&
        companySecs &&
        companySecs.length > 0 &&
        currentTicker
    );

    // 유효한 증권 목록 추출
    const validSecurities = hasValidData
        ? companyMarketcapData.securities?.filter((sec: any) =>
            sec && sec.type && (sec.type.includes("보통주") || sec.type.includes("우선주"))
        ) || []
        : [];

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════    // ═══════════════════════════════════════════════════════════════════════════════════════════════════

    // 카드 클릭 핸들러
    const handleCardClick = (securityType: string) => {
        if (!mounted || !hasValidData || isTransitioning) return;

        const targetSecurity = companySecs.find(sec =>
            sec.type?.includes(securityType?.includes("보통주") ? "보통주" : "우선주")
        );

        if (targetSecurity?.ticker) {
            setIsTransitioning(true);
            const newFilter = securityType?.includes("보통주") ? "보통주" : "우선주";
            setSelectedFilter(newFilter);

            const newUrl = `/company/${targetSecurity.ticker}/marketcap`;
            window.history.pushState(null, '', newUrl);

            if (onTickerChange) {
                onTickerChange(targetSecurity.ticker);
            }

            setTimeout(() => setIsTransitioning(false), 300);
        }
    };

    // 요약 클릭 핸들러
    const handleSummaryClick = () => {
        if (!mounted || !hasValidData || isTransitioning) return;

        const representativeSecurity = companySecs.find(sec =>
            sec.type?.includes("보통주")
        ) || companySecs[0];

        if (representativeSecurity?.ticker) {
            setIsTransitioning(true);
            setSelectedFilter("시가총액 구성"); // "all" 대신 "시가총액 구성" 필터 적용

            const newUrl = `/company/${representativeSecurity.ticker}/marketcap`;
            window.history.pushState(null, '', newUrl);

            if (onTickerChange) {
                onTickerChange(representativeSecurity.ticker);
            }

            setTimeout(() => setIsTransitioning(false), 300);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════    // ═══════════════════════════════════════════════════════════════════════════════════════════════════

    const getCardStyle = (secType: string) => {
        const isCurrentType = (
            (selectedFilter === "보통주" && secType.includes("보통주")) ||
            (selectedFilter === "우선주" && secType.includes("우선주"))
        );

        const isClickable = !isTransitioning; // 언제든 클릭 가능 (같은 버튼도 클릭 가능)

        return {
            isClickable,
            className: cn(
                "transition-all duration-300 select-none",
                isClickable
                    ? "cursor-pointer hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-gray-400"
                    : "cursor-default",
                isCurrentType && "ring-2 ring-black ring-offset-2",
                isTransitioning && "pointer-events-none"
            )
        };
    };

    const getSummaryStyle = () => {
        const isCurrentlySelected = selectedFilter === "시가총액 구성";

        return {
            isClickable: !isTransitioning, // 언제든 클릭 가능 (같은 버튼도 클릭 가능)
            className: cn(
                "transition-all duration-300 select-none",
                !isTransitioning
                    ? "cursor-pointer hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-gray-400"
                    : "cursor-default",
                isCurrentlySelected && "ring-2 ring-black ring-offset-2",
                isTransitioning && "pointer-events-none"
            )
        };
    };

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════    // ═══════════════════════════════════════════════════════════════════════════════════════════════════

    const calculate2x2ConnectionPolygon = useCallback(() => {
        if (
            !mounted ||
            selectedFilter === "all" ||
            !containerRef.current ||
            !grid1Ref.current ||
            !grid2Ref.current ||
            !grid34Ref.current
        ) {
            return "";
        }

        try {
            const containerRect = containerRef.current.getBoundingClientRect();
            const grid1Rect = grid1Ref.current.getBoundingClientRect();
            const grid2Rect = grid2Ref.current.getBoundingClientRect();
            const grid34Rect = grid34Ref.current.getBoundingClientRect();

            // 컨테이너 기준 상대 좌표 계산
            const toRelative = (rect: DOMRect) => ({
                left: rect.left - containerRect.left,
                top: rect.top - containerRect.top,
                right: rect.right - containerRect.left,
                bottom: rect.bottom - containerRect.top
            });

            const g1 = toRelative(grid1Rect);
            const g2 = toRelative(grid2Rect);
            const g34 = toRelative(grid34Rect);

            let path: string[] = [];

            if (selectedFilter === "보통주") {
                // 1,3,4 영역 연결 (보통주 + 시가총액 구성)
                const minX = Math.min(g1.left, g34.left);
                const maxX = Math.max(g1.right, g34.right);
                const minY = Math.min(g1.top, g34.top);
                const maxY = Math.max(g1.bottom, g34.bottom);

                path = [
                    `M${minX},${minY}`,
                    `L${maxX},${minY}`,
                    `L${maxX},${maxY}`,
                    `L${minX},${maxY}`,
                    `L${minX},${minY}`,
                    `Z`
                ];
            } else if (selectedFilter === "우선주") {
                // 2,3,4 영역 연결 (우선주 + 시가총액 구성)
                const minX = Math.min(g2.left, g34.left);
                const maxX = Math.max(g2.right, g34.right);
                const minY = Math.min(g2.top, g34.top);
                const maxY = Math.max(g2.bottom, g34.bottom);

                path = [
                    `M${minX},${minY}`,
                    `L${maxX},${minY}`,
                    `L${maxX},${maxY}`,
                    `L${minX},${maxY}`,
                    `L${minX},${minY}`,
                    `Z`
                ];
            } else if (selectedFilter === "시가총액 구성") {
                // 1,2,3,4 전체 영역 연결
                const minX = Math.min(g1.left, g2.left, g34.left);
                const maxX = Math.max(g1.right, g2.right, g34.right);
                const minY = Math.min(g1.top, g2.top, g34.top);
                const maxY = Math.max(g1.bottom, g2.bottom, g34.bottom);

                path = [
                    `M${minX},${minY}`,
                    `L${maxX},${minY}`,
                    `L${maxX},${maxY}`,
                    `L${minX},${maxY}`,
                    `L${minX},${minY}`,
                    `Z`
                ];
            }

            return path.join(' ');
        } catch (error) {
            console.error('2x2 Grid 연결 영역 계산 오류:', error);
            return "";
        }
    }, [mounted, selectedFilter]);

    // 마운트 및 연결 영역 업데이트
    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const updateConnection = () => {
            const path = calculate2x2ConnectionPolygon();
            setLShapePolygon(path);
        };

        const timeoutId = setTimeout(updateConnection, 50);

        const handleResize = () => {
            clearTimeout(timeoutId);
            setTimeout(updateConnection, 100);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', handleResize);
        };
    }, [mounted, selectedFilter, calculate2x2ConnectionPolygon]);

    // 초기 필터 설정
    useEffect(() => {
        if (!mounted || !hasValidData) {
            setSelectedFilter("all");
            return;
        }

        const currentSecurity = companySecs.find(sec => sec.ticker === currentTicker);
        if (!currentSecurity) {
            setSelectedFilter("all");
            return;
        }

        if (currentSecurity.type?.includes("보통주")) {
            setSelectedFilter("보통주");
        } else if (currentSecurity.type?.includes("우선주")) {
            setSelectedFilter("우선주");
        } else {
            setSelectedFilter("all");
        }
    }, [mounted, currentTicker, companySecs, hasValidData]);

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════    // ═══════════════════════════════════════════════════════════════════════════════════════════════════

    if (!hasValidData) {
        return (
            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-200 shadow-sm text-center">
                <div className="text-gray-700 font-medium">데이터를 불러오는 중...</div>
            </div>
        );
    }

    // 보통주와 우선주 데이터 추출
    const commonStock = validSecurities.find((sec: any) => sec.type?.includes("보통주"));
    const preferredStock = validSecurities.find((sec: any) => sec.type?.includes("우선주"));

    const commonStockData = commonStock ? companySecs.find(
        (companySec: any) => companySec.securityId === commonStock.securityId
    ) : null;

    const preferredStockData = preferredStock ? companySecs.find(
        (companySec: any) => companySec.securityId === preferredStock.securityId
    ) : null;

    return (
        <div ref={containerRef} className={cn(
            "relative w-full",
            "transition-all duration-500 ease-out",
            isTransitioning && "opacity-95"
        )}>

            {/* 스크린 리더용 설명 */}
            <div className="sr-only">
                2x2 종목 필터링 인터페이스입니다.
                {`현재 ${selectedFilter === "all" ? "전체 뷰" :
                    selectedFilter === "보통주" ? "보통주 선택" :
                        selectedFilter === "우선주" ? "우선주 선택" : "시가총액 구성 선택"
                    } 상태입니다.`}
            </div>

            {/* 2x2 그리드 컨테이너 */}
            <div className="relative">

                {/* 연결 영역 SVG */}
                {selectedFilter !== "all" && lShapePolygon && (
                    <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{ zIndex: 0 }}
                        aria-hidden="true"
                    >
                        <defs>
                            <linearGradient id="grid2x2Gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="rgba(0, 0, 0, 0.05)" />
                                <stop offset="50%" stopColor="rgba(0, 0, 0, 0.08)" />
                                <stop offset="100%" stopColor="rgba(0, 0, 0, 0.05)" />
                            </linearGradient>
                        </defs>
                        <path
                            d={lShapePolygon}
                            fill="url(#grid2x2Gradient)"
                            stroke="rgba(0, 0, 0, 0.15)"
                            strokeWidth="1"
                            strokeDasharray="3,2"
                            className="transition-all duration-500 ease-in-out"
                            style={{
                                opacity: 0.9,
                                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
                            }}
                        />
                    </svg>
                )}

                {/* 2x2 메인 그리드 */}
                <div className="grid grid-cols-2 gap-4 relative z-10">

                    {/* 그리드 1: 보통주 카드 */}
                    <div ref={grid1Ref} className="relative">
                        {commonStockData ? (
                            <div
                                className={cn(
                                    getCardStyle(commonStock.type).className,
                                    "group/card relative transform-gpu"
                                )}
                                onClick={getCardStyle(commonStock.type).isClickable ? () => handleCardClick(commonStock.type) : undefined}
                                data-card-type={commonStock.type}
                                role={getCardStyle(commonStock.type).isClickable ? "button" : "presentation"}
                                tabIndex={getCardStyle(commonStock.type).isClickable ? 0 : -1}
                            >
                                <CardMarketcap
                                    security={commonStockData as any}
                                    market={market}
                                    isSelected={selectedFilter === "보통주"}
                                    isCompanyPage={true}
                                    currentMetric="marketcap"
                                />
                            </div>
                        ) : (
                            <div className="p-4 rounded-2xl bg-gray-100 border border-gray-200 text-center text-gray-500">
                                보통주 없음
                            </div>
                        )}
                    </div>

                    {/* 그리드 2: 우선주 카드 */}
                    <div ref={grid2Ref} className="relative">
                        {preferredStockData ? (
                            <div
                                className={cn(
                                    getCardStyle(preferredStock.type).className,
                                    "group/card relative transform-gpu"
                                )}
                                onClick={getCardStyle(preferredStock.type).isClickable ? () => handleCardClick(preferredStock.type) : undefined}
                                data-card-type={preferredStock.type}
                                role={getCardStyle(preferredStock.type).isClickable ? "button" : "presentation"}
                                tabIndex={getCardStyle(preferredStock.type).isClickable ? 0 : -1}
                            >
                                <CardMarketcap
                                    security={preferredStockData as any}
                                    market={market}
                                    isSelected={selectedFilter === "우선주"}
                                    isCompanyPage={true}
                                    currentMetric="marketcap"
                                />
                            </div>
                        ) : (
                            <div className="p-4 rounded-2xl bg-gray-100 border border-gray-200 text-center text-gray-500">
                                우선주 없음
                            </div>
                        )}
                    </div>

                    {/* 그리드 3&4: 시가총액 구성 요약 (2칸 차지) */}
                    <div ref={grid34Ref} className="col-span-2 relative">
                        <div
                            className={cn(
                                getSummaryStyle().className,
                                "group/summary relative z-10 transform-gpu"
                            )}
                            onClick={getSummaryStyle().isClickable ? handleSummaryClick : undefined}
                            role={getSummaryStyle().isClickable ? "button" : "presentation"}
                            tabIndex={getSummaryStyle().isClickable ? 0 : -1}
                        >
                            <MarketcapSummaryExpandable
                                data={companyMarketcapData}
                                filterType={selectedFilter}
                            />
                        </div>
                    </div>

                </div>

            </div>

        </div>
    );
}

// 기본 내보내기
export default InteractiveSecuritiesSection;
