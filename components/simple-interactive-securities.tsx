/*
█████████████████████████████████████████████████████████████████████████████████████████████████████
██ SECURITIES SECTION - Flexible Grid Interactive Securities Component                             ██
██                                                                                                 ██
██ 목적: 회사의 증권을 유연한 그리드로 배치하고 연결로 시각화                                        ██
██ 기능: 카드 선택 → 연결 시각화 → 영역별 하이라이트                                                ██
██ 스타일: CD3 흑백 디자인 시스템 (black/white/gray only)                                           ██
██                                                                                                 ██
██ Flexible Layout (최대 3종목/줄):                                                                  ██
██ ┌─────────┬─────────┬─────────┐                                                                 ██
██ │   보통주  │ 우선주1  │ 우선주2  │  (예시: 보통주 + 우선주 여러 개)                               ██
██ ├─────────┴─────────┴─────────┤                                                                 ██
██ │      시가총액 구성 요약       │  (전체 폭 차지)                                                  ██
██ └───────────────────────────────┘                                                                 ██
██                                                                                                 ██
██ 연결 영역:                                                                                        ██
██ - 개별 종목 선택: 해당 종목 + 시가총액 구성 연결                                                   ██
██ - 시가총액 구성 선택: 모든 종목 + 시가총액 구성 연결                                               ██
█████████████████████████████████████████████████████████████████████████████████████████████████████
*/

"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import CardMarketcap from "@/components/card-marketcap";
import { MarketcapSummaryExpandable } from "@/components/marketcap-summary-expandable";

type FilterType = "all" | "보통주" | "우선주" | "시가총액 구성" | string; // 다양한 증권 타입 지원

interface SecurityData {
    securityId: string;
    type: string;
    ticker: string;
    name: string;
    korName?: string;
    exchange: string;
}

interface InteractiveSecuritiesSectionProps {
    companyMarketcapData: any;
    companySecs: any[];
    currentTicker: string;
    market: string;
    onTickerChange?: (newTicker: string) => void;
    baseUrl?: string; // 기본값: "company", "security"로 변경 가능
    currentMetric?: string; // 기본값: "marketcap", "per" 등으로 변경 가능
    layout?: "main" | "sidebar"; // 레이아웃 타입
    maxItems?: number; // 사이드바용 아이템 제한
    showSummaryCard?: boolean; // 시가총액 구성 카드 표시 여부
    compactMode?: boolean; // 간결한 UI 모드
    highlightActiveTicker?: boolean; // 활성화된 종목 강조 여부
    defaultFilter?: FilterType; // 초기 선택 필터
}

/**
 * SECURITIES SECTION - Flexible Grid Interactive Component
 *
 * 회사의 증권 목록을 유연한 그리드로 배치하고 선택에 따라 영역을 시각적으로 연결
 */
export function InteractiveSecuritiesSection({
    companyMarketcapData,
    companySecs,
    currentTicker,
    market,
    onTickerChange,
    baseUrl = "company",
    currentMetric = "marketcap",
    layout = "main",
    maxItems,
    showSummaryCard = true,
    compactMode = false,
    highlightActiveTicker = true,
    defaultFilter = "all"
}: InteractiveSecuritiesSectionProps) {

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════    // ═══════════════════════════════════════════════════════════════════════════════════════════════════

    const [mounted, setMounted] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState<FilterType>(defaultFilter);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [clickedButton, setClickedButton] = useState<string | null>(null);

    const pathname = usePathname();
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);

    // 데이터 유효성 검증
    const hasValidData = Boolean(
        companyMarketcapData &&
        companySecs &&
        companySecs.length > 0 &&
        currentTicker
    );

    // 유효한 증권 목록 추출 및 정렬
    const validSecurities = hasValidData
        ? companyMarketcapData.securities?.filter((sec: any) =>
            sec && sec.type && (sec.type.includes("보통주") || sec.type.includes("우선주"))
        ).sort((a: any, b: any) => {
            // 보통주를 먼저, 그 다음 우선주를 순서대로
            if (a.type.includes("보통주") && !b.type.includes("보통주")) return -1;
            if (!a.type.includes("보통주") && b.type.includes("보통주")) return 1;
            return a.type.localeCompare(b.type);
        }) || []
        : [];

    // 증권별 데이터 매핑
    const securitiesWithData = validSecurities.map((security: any) => {
        const securityData = companySecs.find(
            (companySec: any) => companySec.securityId === security.securityId
        );
        return {
            ...security,
            data: securityData
        };
    }).filter((sec: any) => sec.data); // 데이터가 있는 것만

    // 최대 아이템 수 제한 (레이아웃에 따라)
    const defaultMaxItems = layout === "sidebar" ? 4 : 3;
    const effectiveMaxItems = maxItems || defaultMaxItems;
    const displaySecurities = securitiesWithData.slice(0, effectiveMaxItems);

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════    // ═══════════════════════════════════════════════════════════════════════════════════════════════════

    // 카드 클릭 핸들러 - 애니메이션 효과 추가
    const handleCardClick = (security: any) => {
        console.log('🔥 Sidebar Card Click:', {
            securityType: security.type,
            ticker: security.data?.ticker,
            layout: layout,
            currentTicker: currentTicker
        });

        if (!mounted || !hasValidData || isTransitioning || !security.data?.ticker) return;

        // 클릭 애니메이션 트리거
        setClickedButton(security.type);
        setTimeout(() => setClickedButton(null), 200);

        setIsTransitioning(true);
        setSelectedFilter(security.type); console.log('🚀 Card clicked:', security.type, security.data.ticker);

        // URL 변경 (새로운 종목으로 이동)
        const secCode = `${security.data.exchange}.${security.data.ticker}`;
        let newUrl = `/${baseUrl}/${secCode}/${currentMetric}`;

        // 보통주는 메인/사이드바 관계없이 focus=stock 추가
        const isCommonStock = security.type?.includes("보통주");
        if (isCommonStock) {
            newUrl += "?focus=stock";
        }
        // 메인 콘텐츠의 우선주만 focus=stock 추가 (사이드바 우선주는 파라미터 없음)
        else if (layout !== "sidebar") {
            newUrl += "?focus=stock";
        }

        // Next.js 클라이언트 사이드 네비게이션 사용 (스크롤 유지)
        router.push(newUrl, { scroll: false });

        // 선택된 필터 업데이트
        setSelectedFilter(security.type);

        setTimeout(() => setIsTransitioning(false), 300);
    };

    // 요약 클릭 핸들러 - 시가총액 구성 (보통주로 이동, focus 없음)
    const handleSummaryClick = () => {
        if (!mounted || !hasValidData || isTransitioning) return;

        // 클릭 애니메이션 트리거
        setClickedButton("시가총액 구성");
        setTimeout(() => setClickedButton(null), 200);

        const representativeSecurity = displaySecurities.find((sec: any) =>
            sec.type?.includes("보통주")
        ) || displaySecurities[0];

        if (representativeSecurity?.data?.ticker) {
            setIsTransitioning(true);
            setSelectedFilter("시가총액 구성");

            // 보통주 URL로 이동 (focus=stock 없음 → 시가총액 구성 어노테이션)
            const secCode = `${representativeSecurity.data.exchange}.${representativeSecurity.data.ticker}`;
            const newUrl = `/company/${secCode}/${currentMetric}`;

            // 클라이언트 사이드 네비게이션
            router.push(newUrl, { scroll: false });

            setTimeout(() => setIsTransitioning(false), 300);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════    // ═══════════════════════════════════════════════════════════════════════════════════════════════════

    const getCardStyle = (secType: string) => {
        const isClicked = clickedButton === secType;
        return {
            isClickable: !isTransitioning,
            className: cn(
                "select-none transition-all duration-200",
                !isTransitioning ? "cursor-pointer" : "cursor-default",
                isTransitioning && "pointer-events-none",
                // 키보드 포커스 시 미묘한 배경 변화 (focus ring 대신)
                "focus-visible:bg-muted/60 focus-visible:shadow-md",
                // 클릭 애니메이션 효과
                isClicked && "scale-95 shadow-lg transform-gpu"
            )
        };
    };

    const getSummaryStyle = () => {
        const isClicked = clickedButton === "시가총액 구성";
        return {
            isClickable: !isTransitioning,
            className: cn(
                "select-none transition-all duration-200",
                !isTransitioning ? "cursor-pointer" : "cursor-default",
                isTransitioning && "pointer-events-none",
                // 키보드 포커스 시 미묘한 배경 변화 (focus ring 대신)
                "focus-visible:bg-muted/60 focus-visible:shadow-md",
                // 클릭 애니메이션 효과
                isClicked && "scale-95 shadow-lg transform-gpu"
            )
        };
    };

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════    // ═══════════════════════════════════════════════════════════════════════════════════════════════════

    // 마운트 처리
    useEffect(() => {
        setMounted(true);
    }, []);

    // 초기 필터 설정 - URL 파라미터 고려
    useEffect(() => {
        if (!mounted || !hasValidData) {
            setSelectedFilter(defaultFilter);
            return;
        }

        if (!highlightActiveTicker) {
            setSelectedFilter(defaultFilter);
            return;
        }

        const currentSecurity = companySecs.find(sec => sec.ticker === currentTicker);
        if (!currentSecurity) {
            setSelectedFilter(defaultFilter);
            return;
        }

        // URL에서 focus 파라미터 확인
        const urlParams = new URLSearchParams(window.location.search);
        const focusStock = urlParams.get('focus') === 'stock';

        // 보통주의 경우: focus=stock 여부로 필터 결정
        if (currentSecurity.type?.includes("보통주")) {
            setSelectedFilter(focusStock ? "보통주" : "시가총액 구성");
        } else {
            // 우선주 등: 종목 타입으로 설정
            setSelectedFilter(currentSecurity.type || defaultFilter);
        }
    }, [mounted, currentTicker, companySecs, hasValidData, highlightActiveTicker, defaultFilter]);

    // ═══════════════════════════════════════════════════════════════════════════════════════════════════    // ═══════════════════════════════════════════════════════════════════════════════════════════════════

    if (!hasValidData) {
        return (
            <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 shadow-sm text-center">
                <div className="space-y-3">
                    <div className="text-gray-700 dark:text-gray-300 font-medium text-base">데이터를 불러오는 중입니다</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">잠시만 기다려주세요</div>
                </div>
            </div>
        );
    }

    if (displaySecurities.length === 0) {
        return (
            <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 shadow-sm text-center">
                <div className="space-y-3">
                    <div className="text-gray-700 dark:text-gray-300 font-medium text-base">표시할 종목이 없습니다</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">종목 정보를 확인해주세요</div>
                </div>
            </div>
        );
    }

    // 사이드바 레이아웃
    if (layout === "sidebar") {
        return (
            <div className="space-y-3">
                {displaySecurities.map((security: any) => {

                    return (
                        <div
                            key={security.securityId}
                            className="relative"
                        >
                            <div
                                className={cn(
                                    getCardStyle(security.type).className,
                                    "group/card relative h-full focus:outline-none focus:ring-0 rounded-lg"
                                )}
                                onClick={getCardStyle(security.type).isClickable ? () => handleCardClick(security) : undefined}
                                onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && getCardStyle(security.type).isClickable) {
                                        e.preventDefault();
                                        handleCardClick(security);
                                    }
                                }}
                                data-card-type={security.type}
                                role={getCardStyle(security.type).isClickable ? "button" : "presentation"}
                                tabIndex={getCardStyle(security.type).isClickable ? 0 : -1}
                                aria-label={`${security.type} - ${security.korName || security.name} 상세보기`}
                            >
                                <CardMarketcap
                                    security={security.data as any}
                                    market={market}
                                    isSelected={highlightActiveTicker && security.data?.ticker === currentTicker}
                                    isCompanyPage={true}
                                    currentMetric={currentMetric}
                                />
                            </div>
                        </div>
                    );
                })}

                {/* 시가총액 구성 전체 보기 버튼 (그리드 레이아웃에서만 표시) */}
                {showSummaryCard && layout !== "sidebar" && (
                    <button
                        onClick={getSummaryStyle().isClickable ? handleSummaryClick : undefined}
                        disabled={!getSummaryStyle().isClickable}
                        className={cn(
                            "block w-full p-3 rounded-lg border transition-all hover:shadow-sm text-left hover:bg-muted/50",
                            !getSummaryStyle().isClickable && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground">
                                    시가총액 구성
                                </span>
                            </div>
                            {!compactMode && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">전체 종목</span>
                                    <span className="font-medium text-foreground">
                                        {companyMarketcapData?.totalMarketcap ?
                                            `${(companyMarketcapData.totalMarketcap / 1e12).toFixed(1)}조원` : "—"}
                                    </span>
                                </div>
                            )}
                        </div>
                    </button>
                )}

                {/* 더보기 버튼 */}
                {securitiesWithData.length > effectiveMaxItems && (
                    <div className="text-center pt-2">
                        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                            +{securitiesWithData.length - effectiveMaxItems}개 더보기
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // 메인 그리드 레이아웃 (기존 로직)
    return (
        <div ref={containerRef} className={cn(
            "relative w-full",
            "transition-all duration-500 ease-out",
            isTransitioning && "opacity-95"
        )}>

            {/* 스크린 리더용 설명 */}
            <div className="sr-only">
                유연한 종목 필터링 인터페이스입니다.
                {`현재 ${selectedFilter === "all" ? "전체 뷰" :
                    selectedFilter === "시가총액 구성" ? "시가총액 구성 선택" : `${selectedFilter} 선택`
                    } 상태입니다.`}
            </div>

            {/* 그리드 컨테이너 */}
            <div className="relative">

                {/* 유연한 증권 그리드 */}
                <div className={cn(
                    "grid gap-4 relative z-10 min-h-0 mb-6",
                    displaySecurities.length === 1 ? "grid-cols-1 max-w-sm mx-auto" :
                        displaySecurities.length === 2 ? "grid-cols-1 sm:grid-cols-2 gap-x-6" :
                            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6"
                )}>

                    {displaySecurities.map((security: any, index: number) => (
                        <div
                            key={security.securityId}
                            className="relative min-h-0"
                        >
                            <div
                                className={cn(
                                    getCardStyle(security.type).className,
                                    "group/card relative h-full focus:outline-none focus:ring-0 rounded-lg"
                                )}
                                onClick={getCardStyle(security.type).isClickable ? () => handleCardClick(security) : undefined}
                                onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && getCardStyle(security.type).isClickable) {
                                        e.preventDefault();
                                        handleCardClick(security);
                                    }
                                }}
                                data-card-type={security.type}
                                role={getCardStyle(security.type).isClickable ? "button" : "presentation"}
                                tabIndex={getCardStyle(security.type).isClickable ? 0 : -1}
                                aria-label={`${security.type} - ${security.korName || security.name} 상세보기`}
                            >
                                <CardMarketcap
                                    security={security.data as any}
                                    market={market}
                                    isSelected={highlightActiveTicker && security.data?.ticker === currentTicker}
                                    isCompanyPage={true}
                                    currentMetric={currentMetric}
                                />
                            </div>
                        </div>
                    ))}

                </div>

                {/* 시가총액 구성 요약 */}
                {showSummaryCard && (
                    <div className="relative">
                        <div
                            className={cn(
                                getSummaryStyle().className,
                                "group/summary relative z-10 focus:outline-none focus:ring-0 rounded-lg"
                            )}
                            onClick={getSummaryStyle().isClickable ? handleSummaryClick : undefined}
                            onKeyDown={(e) => {
                                if ((e.key === 'Enter' || e.key === ' ') && getSummaryStyle().isClickable) {
                                    e.preventDefault();
                                    handleSummaryClick();
                                }
                            }}
                            role={getSummaryStyle().isClickable ? "button" : "presentation"}
                            tabIndex={getSummaryStyle().isClickable ? 0 : -1}
                            aria-label="시가총액 구성 요약 - 전체 종목 구성 확인"
                        >
                            <MarketcapSummaryExpandable
                                data={companyMarketcapData}
                                filterType={selectedFilter as any}
                                isSelected={selectedFilter === "시가총액 구성"}
                            />
                        </div>
                    </div>
                )}

            </div>

        </div>
    );
}

// 기본 내보내기도 추가
export default InteractiveSecuritiesSection;
