/*
█████████████████████████████████████████████████████████████████████████████████████████████████████
██ PER SECURITIES SECTION - PER 전용 종목별 비교 컴포넌트                                              ██
██                                                                                                 ██
██ 목적: PER 페이지에서 보통주/우선주 간 PER 비교                                                      ██
██ 기능: 종목 선택 → PER 페이지 이동 → 종목별 PER 하이라이트                                          ██
██ 스타일: CD3 흑백 디자인 시스템 (black/white/gray only)                                           ██
██                                                                                                 ██
██ PER 전용 Layout (최대 3종목/줄):                                                                  ██
██ ┌─────────┬─────────┬─────────┐                                                                 ██
██ │   보통주  │ 우선주1  │ 우선주2  │  (예시: 보통주 + 우선주 여러 개 - PER 데이터)                  ██
██ └─────────┴─────────┴─────────┘                                                                 ██
█████████████████████████████████████████████████████████████████████████████████████████████████████
*/

"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import CardMarketcap from "@/components/card-marketcap";

type FilterType = "all" | "보통주" | "우선주" | string;

interface SecurityData {
    securityId: string;
    type: string;
    ticker: string;
    name: string;
    korName?: string;
    exchange: string;
}

interface InteractiveSecuritiesPERSectionProps {
    companyMarketcapData: any;
    companySecs: any[];
    currentTicker: string;
    market: string;
    onTickerChange?: (newTicker: string) => void;
}

/**
 * PER SECURITIES SECTION - PER 전용 종목별 비교 컴포넌트
 * 
 * PER 페이지에서 보통주/우선주 간 PER 비교
 */
export function InteractiveSecuritiesPERSection({
    companyMarketcapData,
    companySecs,
    currentTicker,
    market,
    onTickerChange
}: InteractiveSecuritiesPERSectionProps) {

    const [mounted, setMounted] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState<FilterType>("all");
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

    // 최대 3개까지만 표시
    const displaySecurities = securitiesWithData.slice(0, 3);

    // PER 페이지 카드 클릭 핸들러
    const handleCardClick = (security: any) => {
        if (!mounted || !hasValidData || isTransitioning || !security.data?.ticker) return;

        setIsTransitioning(true);
        setSelectedFilter(security.type);
        setClickedButton(security.type);
        setTimeout(() => setClickedButton(null), 200);

        // 올바른 URL 형식으로 네비게이션
        const secCode = `${security.data.exchange}.${security.data.ticker}`;
        const newUrl = `/security/${secCode}/per`;

        // Next.js router 사용 (client-side navigation)
        router.push(newUrl, { scroll: false });

        if (onTickerChange) {
            onTickerChange(security.data.ticker);
        }

        setTimeout(() => setIsTransitioning(false), 300);
    };

    const getCardStyle = (secType: string) => {
        const isClicked = clickedButton === secType;

        return {
            isClickable: !isTransitioning,
            className: cn(
                "select-none transition-all duration-200 group/card relative h-full focus:outline-none focus:ring-0 rounded-lg",
                !isTransitioning ? "cursor-pointer hover:shadow-md" : "cursor-default",
                isTransitioning && "pointer-events-none",
                isClicked && "scale-[0.98] shadow-lg"
            )
        };
    };

    // 마운트 처리
    useEffect(() => {
        setMounted(true);
    }, []);

    // 초기 필터 설정
    useEffect(() => {
        if (!mounted || !hasValidData) {
            setSelectedFilter("all");
            return;
        }

        const currentSecurity = companySecs.find((sec: any) => sec.ticker === currentTicker);
        if (!currentSecurity) {
            setSelectedFilter("all");
            return;
        }

        // 현재 티커에 해당하는 증권 타입으로 필터 설정
        setSelectedFilter(currentSecurity.type || "all");
    }, [mounted, currentTicker, companySecs, hasValidData]);

    if (!hasValidData) {
        return (
            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-200 shadow-sm text-center">
                <p className="text-gray-600 font-medium mb-2">종목별 PER 데이터 없음</p>
                <p className="text-sm text-gray-500">
                    해당 기업의 종목별 PER 데이터를 불러올 수 없습니다.
                </p>
            </div>
        );
    }

    if (displaySecurities.length === 0) {
        return (
            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-200 shadow-sm text-center">
                <p className="text-gray-600 font-medium mb-2">표시할 종목 없음</p>
                <p className="text-sm text-gray-500">
                    보통주 또는 우선주 데이터가 없습니다.
                </p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className={cn(
            "relative w-full",
            "transition-all duration-500 ease-out",
            isTransitioning && "opacity-95"
        )}>

            {/* 스크린 리더용 설명 */}
            <div className="sr-only">
                PER 종목 비교 인터페이스입니다.
                {`현재 ${selectedFilter === "all" ? "전체 뷰" : `${selectedFilter} 선택`} 상태입니다.`}
            </div>

            {/* 그리드 컨테이너 */}
            <div className="relative">

                {/* PER 종목별 카드 그리드 - 보통주/우선주만 */}
                <div className={cn(
                    "grid gap-4 relative z-10 min-h-0",
                    displaySecurities.length === 1 ? "grid-cols-1 max-w-sm mx-auto" :
                        displaySecurities.length === 2 ? "grid-cols-1 sm:grid-cols-2 gap-x-6" :
                            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6"
                )}>
                    {displaySecurities.map((security: any, index: number) => {
                        const cardStyle = getCardStyle(security.type);
                        const isCurrentSecurity = security.data?.ticker === currentTicker;

                        return (
                            <div
                                key={security.securityId}
                                className="relative min-h-0"
                            >
                                <div
                                    className={cardStyle.className}
                                    onClick={() => handleCardClick(security)}
                                    role="button"
                                    tabIndex={cardStyle.isClickable ? 0 : -1}
                                    onKeyDown={(e) => {
                                        if (cardStyle.isClickable && (e.key === 'Enter' || e.key === ' ')) {
                                            e.preventDefault();
                                            handleCardClick(security);
                                        }
                                    }}
                                    data-card-type={security.type}
                                    aria-label={`${security.type} - ${security.data?.korName || security.data?.name} PER 상세보기`}
                                >
                                    <CardMarketcap
                                        security={security.data}
                                        currentMetric="per"
                                        isCompanyPage={false}
                                        isSelected={isCurrentSecurity}
                                        market={market}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
}
