"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { TrendingUp } from "lucide-react";
import { formatNumberWithSeparateUnit, formatChangeRate, formatDifference } from "@/lib/utils";

interface KeyMetricsSectionProps {
    companyMarketcapData: any;
    companySecs: any[];
    security: any;
    periodAnalysis: any;
    marketCapRanking: {
        currentRank: number;
        priorRank: number | null;
        rankChange: number;
        value: number | null;
    } | null;
}

export function KeyMetricsSection({
    companyMarketcapData,
    companySecs,
    security,
    periodAnalysis,
    marketCapRanking,
}: KeyMetricsSectionProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // 스크롤 컨테이너 ref
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 자동 스크롤 상태 (사용자 상호작용 후 3초 뒤 재시작)
    const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
    const autoScrollAnimationRef = useRef<number | null>(null);
    const lastScrollTimeRef = useRef<number>(0);
    const restartTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 드래그 상태
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 });

    // 개선된 무한 스크롤을 위한 카드 복제
    useEffect(() => {
        if (!scrollContainerRef.current) return;

        const container = scrollContainerRef.current;
        const cardContainer = container.querySelector('.flex') as HTMLElement;

        if (!cardContainer) return;

        // 이미 복제된 카드가 있는지 확인
        if (cardContainer.dataset.cloned === 'true') return;

        // 원본 카드들 복제 (끝이 보이지 않도록 2세트 복제)
        const originalCards = Array.from(cardContainer.children);

        // 첫 번째 복제본 추가
        originalCards.forEach(card => {
            const clonedCard = card.cloneNode(true) as HTMLElement;
            cardContainer.appendChild(clonedCard);
        });

        // 두 번째 복제본도 추가 (더 부드러운 무한 스크롤을 위해)
        originalCards.forEach(card => {
            const clonedCard = card.cloneNode(true) as HTMLElement;
            cardContainer.appendChild(clonedCard);
        });

        // 복제 완료 마크
        cardContainer.dataset.cloned = 'true';

        // 초기 스크롤 위치를 두 번째 세트 시작점으로 설정 (더 자연스러운 순환을 위해)
        const singleSetWidth = cardContainer.scrollWidth / 3; // 이제 3세트가 있으므로
        container.scrollLeft = singleSetWidth;
    }, []);

    // 부드러운 무한 스크롤 함수 (3세트 구조에 최적화)
    const smoothAutoScroll = useCallback(() => {
        if (!scrollContainerRef.current || !isAutoScrollEnabled) return;

        const container = scrollContainerRef.current;
        const now = Date.now();

        // 30ms마다 1px씩 스크롤 (약 33fps로 더 부드럽게)
        if (now - lastScrollTimeRef.current >= 30) {
            const cardContainer = container.querySelector('.flex') as HTMLElement;

            if (cardContainer && cardContainer.dataset.cloned === 'true') {
                // 각 세트의 너비 (전체 너비의 1/3)
                const singleSetWidth = cardContainer.scrollWidth / 3;
                const currentScrollLeft = container.scrollLeft;

                // 마지막 세트에 도달하면 두 번째 세트로 리셋 (무한 루프)
                if (currentScrollLeft >= singleSetWidth * 2.8) { // 약간의 여유
                    container.style.scrollBehavior = 'auto';
                    container.scrollLeft = singleSetWidth + (currentScrollLeft - singleSetWidth * 2);
                    requestAnimationFrame(() => {
                        container.style.scrollBehavior = 'smooth';
                    });
                }
                // 첫 번째 세트의 시작 부분에 도달하면 두 번째 세트로 이동
                else if (currentScrollLeft <= singleSetWidth * 0.2) {
                    container.style.scrollBehavior = 'auto';
                    container.scrollLeft = singleSetWidth + currentScrollLeft;
                    requestAnimationFrame(() => {
                        container.style.scrollBehavior = 'smooth';
                    });
                } else {
                    // 1px씩 부드럽게 스크롤
                    container.scrollLeft += 1;
                }
            } else {
                // 복제가 아직 안되었으면 기존 방식
                container.scrollLeft += 1;
            }

            lastScrollTimeRef.current = now;
        }

        autoScrollAnimationRef.current = requestAnimationFrame(smoothAutoScroll);
    }, [isAutoScrollEnabled]);

    // 자동 스크롤 시작/정지
    useEffect(() => {
        if (isAutoScrollEnabled) {
            lastScrollTimeRef.current = Date.now();
            autoScrollAnimationRef.current = requestAnimationFrame(smoothAutoScroll);
        } else if (autoScrollAnimationRef.current) {
            cancelAnimationFrame(autoScrollAnimationRef.current);
            autoScrollAnimationRef.current = null;
        }

        return () => {
            if (autoScrollAnimationRef.current) {
                cancelAnimationFrame(autoScrollAnimationRef.current);
            }
        };
    }, [isAutoScrollEnabled, smoothAutoScroll]);

    // 마우스 상호작용 시 자동 스크롤 일시정지 (3초 후 재시작) - 개선된 버전
    const pauseAutoScroll = useCallback(() => {
        // 기존 타이머가 있으면 취소
        if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
        }

        // 자동 스크롤 일시정지
        setIsAutoScrollEnabled(false);

        // 3초 후 자동 스크롤 재시작
        restartTimerRef.current = setTimeout(() => {
            // 자동 스크롤 재시작 시 현재 위치 확인 및 조정 (3세트 구조)
            if (scrollContainerRef.current) {
                const container = scrollContainerRef.current;
                const cardContainer = container.querySelector('.flex') as HTMLElement;

                if (cardContainer && cardContainer.dataset.cloned === 'true') {
                    const singleSetWidth = cardContainer.scrollWidth / 3;
                    const currentScrollLeft = container.scrollLeft;

                    // 현재 위치가 첫 번째 세트나 마지막 세트에 있다면 두 번째 세트로 조정
                    if (currentScrollLeft < singleSetWidth * 0.3 || currentScrollLeft > singleSetWidth * 2.7) {
                        container.style.scrollBehavior = 'auto';
                        // 현재 위치를 두 번째 세트의 해당 위치로 매핑
                        const relativePosition = currentScrollLeft % singleSetWidth;
                        container.scrollLeft = singleSetWidth + relativePosition;

                        requestAnimationFrame(() => {
                            container.style.scrollBehavior = 'smooth';
                            setIsAutoScrollEnabled(true);
                        });
                    } else {
                        // 이미 두 번째 세트에 있으면 바로 재시작
                        setIsAutoScrollEnabled(true);
                    }
                } else {
                    setIsAutoScrollEnabled(true);
                }
            } else {
                setIsAutoScrollEnabled(true);
            }
        }, 3000);
    }, []);

    // 컴포넌트 언마운트 시 타이머 정리
    useEffect(() => {
        return () => {
            if (restartTimerRef.current) {
                clearTimeout(restartTimerRef.current);
            }
        };
    }, []);

    // 마우스 드래그 이벤트 핸들러들
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;

        // 마우스 클릭/드래그 시작 시 자동 스크롤 일시정지
        pauseAutoScroll();

        setIsDragging(true);
        setDragStart({
            x: e.pageX,
            scrollLeft: scrollContainerRef.current.scrollLeft
        });

        // 드래그 중 텍스트 선택 방지
        e.preventDefault();
    }, [pauseAutoScroll]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;

        e.preventDefault();
        const x = e.pageX;
        const walk = (x - dragStart.x) * 2; // 드래그 감도 조절
        scrollContainerRef.current.scrollLeft = dragStart.scrollLeft - walk;
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    // 터치 이벤트도 자동 스크롤 일시정지
    const handleTouchStart = useCallback(() => {
        pauseAutoScroll();
    }, [pauseAutoScroll]);

    // 현재 선택된 종목 타입 실시간 감지
    const selectedSecurityType = useMemo(() => {
        if (!companyMarketcapData || !companySecs.length) return "시가총액 구성";

        const pathParts = pathname.split('/');
        const secCodePart = pathParts.find(part => part.includes('.'));
        if (!secCodePart) return "시가총액 구성";

        const currentTicker = secCodePart.split('.')[1];
        if (!currentTicker) return "시가총액 구성";

        // 현재 종목 정보 조회
        const currentSecurity = companySecs.find(sec => sec.ticker === currentTicker);
        if (!currentSecurity) return "시가총액 구성";

        // 보통주인지 확인
        const isCommonStock = currentSecurity.type?.includes("보통주");

        if (isCommonStock) {
            // 보통주의 경우: focus=stock 여부로 결정
            const focusStock = searchParams.get('focus') === 'stock';
            return focusStock ? "보통주" : "시가총액 구성";
        } else {
            // 우선주 등: 항상 개별 종목 어노테이션
            if (currentSecurity.type?.includes("우선주")) return "우선주";
            return "시가총액 구성";
        }
    }, [pathname, searchParams, companyMarketcapData, companySecs]);

    // 날짜 기반 데이터 필터링 헬퍼
    const getDataByPeriod = (months: number) => {
        if (!companyMarketcapData?.aggregatedHistory) return [];

        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);

        return companyMarketcapData.aggregatedHistory.filter((item: any) => {
            const itemDate = new Date(item.date);
            return itemDate >= cutoffDate;
        });
    };

    // 선택된 타입에 따른 데이터 필터링 (개선된 버전)
    const getMetricValue = (type: 'current' | 'avg12m' | 'avg3y' | 'avg5y' | 'avg10y' | 'avgAll' | 'min' | 'max') => {
        if (!companyMarketcapData?.aggregatedHistory) return null;

        if (selectedSecurityType === "시가총액 구성") {
            // 시가총액 구성: 전체 시가총액 기준
            switch (type) {
                case 'current': return periodAnalysis?.periods[0]?.value || 0;
                case 'avg12m': {
                    const data = getDataByPeriod(12);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'avg3y': {
                    const data = getDataByPeriod(36);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'avg5y': {
                    const data = getDataByPeriod(60);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'avg10y': {
                    const data = getDataByPeriod(120);
                    if (data.length === 0) return null;
                    const average = data.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / data.length;
                    return average;
                }
                case 'avgAll': {
                    if (!companyMarketcapData?.aggregatedHistory) return null;
                    const allValues = companyMarketcapData.aggregatedHistory.map((item: any) => item.totalMarketcap);
                    return allValues.length > 0 ? allValues.reduce((sum: number, val: number) => sum + val, 0) / allValues.length : null;
                }
                case 'min': return periodAnalysis?.minMax.min;
                case 'max': return periodAnalysis?.minMax.max;
            }
        } else {
            // 개별 종목: 해당 종목의 시가총액만
            const pathParts = pathname.split('/');
            const secCodePart = pathParts.find(part => part.includes('.'));
            const currentTicker = secCodePart?.split('.')[1];
            const currentSecurity = companySecs.find(sec => sec.ticker === currentTicker);

            if (!currentSecurity) return null;

            const history = companyMarketcapData.aggregatedHistory;
            const securityValues = history
                .map((item: any) => item.securitiesBreakdown?.[currentSecurity.securityId] || 0)
                .filter((value: number) => value > 0);

            if (securityValues.length === 0) return null; switch (type) {
                case 'current': return securityValues[securityValues.length - 1];
                case 'avg12m': {
                    const data = getDataByPeriod(12);
                    const values = data.map((item: any) => item.securitiesBreakdown?.[currentSecurity.securityId] || 0).filter((v: number) => v > 0);
                    return values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : null;
                }
                case 'avg3y': {
                    const data = getDataByPeriod(36);
                    const values = data.map((item: any) => item.securitiesBreakdown?.[currentSecurity.securityId] || 0).filter((v: number) => v > 0);
                    return values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : null;
                }
                case 'avg5y': {
                    const data = getDataByPeriod(60);
                    const values = data.map((item: any) => item.securitiesBreakdown?.[currentSecurity.securityId] || 0).filter((v: number) => v > 0);
                    return values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : null;
                }
                case 'avg10y': {
                    const data = getDataByPeriod(120);
                    const values = data.map((item: any) => item.securitiesBreakdown?.[currentSecurity.securityId] || 0).filter((v: number) => v > 0);
                    return values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : null;
                }
                case 'avgAll': {
                    return securityValues.reduce((sum: number, val: number) => sum + val, 0) / securityValues.length;
                }
                case 'min': return Math.min(...securityValues);
                case 'max': return Math.max(...securityValues);
            }
        }
        return null;
    };

    // 보통주 비중 계산 함수
    const getCommonStockRatio = (type: 'min' | 'max') => {
        if (!companyMarketcapData?.aggregatedHistory) return 0;

        let ratios: number[] = [];
        companyMarketcapData.aggregatedHistory.forEach((historyItem: any) => {
            if (historyItem.securitiesBreakdown) {
                const commonStockSecurities = companyMarketcapData.securities.filter((sec: any) => sec.type === '보통주');
                const commonStockValue = commonStockSecurities.reduce((sum: number, sec: any) => {
                    return sum + (historyItem.securitiesBreakdown[sec.securityId] || 0);
                }, 0);
                const ratio = (commonStockValue / historyItem.totalMarketcap) * 100;
                if (ratio > 0) {
                    ratios.push(ratio);
                }
            }
        });

        if (ratios.length === 0) return 0;
        return type === 'max' ? Math.max(...ratios) : Math.min(...ratios);
    };

    // 변화율 계산 함수
    const getChangeRate = (current: number | null, comparison: number | null) => {
        if (!current || !comparison || current === comparison) {
            return { value: "—", color: "text-gray-500 dark:text-gray-400" };
        }
        const rate = ((current - comparison) / comparison) * 100;
        const formatted = formatChangeRate(rate);

        // 다크모드 색상 추가
        let darkModeColor = formatted.color;
        if (formatted.color.includes('red')) {
            darkModeColor = formatted.color + ' dark:text-red-400';
        } else if (formatted.color.includes('blue')) {
            darkModeColor = formatted.color + ' dark:text-blue-400';
        } else {
            darkModeColor = formatted.color + ' dark:text-gray-400';
        }

        return { value: formatted.value, color: darkModeColor };
    };

    // 이전 기간 평균과의 변화율 계산
    const getPreviousPeriodAverage = (type: 'avg12m' | 'avg3y' | 'avg5y' | 'avg10y') => {
        if (!companyMarketcapData?.aggregatedHistory) return null;

        let currentMonths: number, previousMonths: number;
        switch (type) {
            case 'avg12m': currentMonths = 12; previousMonths = 24; break;
            case 'avg3y': currentMonths = 36; previousMonths = 72; break;
            case 'avg5y': currentMonths = 60; previousMonths = 120; break;
            case 'avg10y': currentMonths = 120; previousMonths = 240; break;
        }

        const currentPeriodData = getDataByPeriod(currentMonths);
        const previousPeriodData = getDataByPeriod(previousMonths).filter((item: any) => {
            const itemDate = new Date(item.date);
            const cutoffDate = new Date();
            cutoffDate.setMonth(cutoffDate.getMonth() - currentMonths);
            return itemDate < cutoffDate;
        });

        if (selectedSecurityType === "시가총액 구성") {
            if (currentPeriodData.length === 0 || previousPeriodData.length === 0) return null;
            const currentAvg = currentPeriodData.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / currentPeriodData.length;
            const previousAvg = previousPeriodData.reduce((sum: number, item: any) => sum + item.totalMarketcap, 0) / previousPeriodData.length;
            return { current: currentAvg, previous: previousAvg };
        } else {
            const pathParts = pathname.split('/');
            const secCodePart = pathParts.find(part => part.includes('.'));
            const currentTicker = secCodePart?.split('.')[1];
            const currentSecurity = companySecs.find(sec => sec.ticker === currentTicker);

            if (!currentSecurity) return null;

            const currentValues = currentPeriodData.map((item: any) => item.securitiesBreakdown?.[currentSecurity.securityId] || 0).filter((v: number) => v > 0);
            const previousValues = previousPeriodData.map((item: any) => item.securitiesBreakdown?.[currentSecurity.securityId] || 0).filter((v: number) => v > 0);

            if (currentValues.length === 0 || previousValues.length === 0) return null;

            const currentAvg = currentValues.reduce((sum: number, val: number) => sum + val, 0) / currentValues.length;
            const previousAvg = previousValues.reduce((sum: number, val: number) => sum + val, 0) / previousValues.length;
            return { current: currentAvg, previous: previousAvg };
        }
    };

    // 전일 대비 변화율 계산
    const getYesterdayChange = () => {
        if (!companyMarketcapData?.aggregatedHistory || companyMarketcapData.aggregatedHistory.length < 2) return null;

        const sortedData = [...companyMarketcapData.aggregatedHistory].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const today = sortedData[0];
        const yesterday = sortedData[1];

        if (selectedSecurityType === "시가총액 구성") {
            return { current: today.totalMarketcap, previous: yesterday.totalMarketcap };
        } else {
            const pathParts = pathname.split('/');
            const secCodePart = pathParts.find(part => part.includes('.'));
            const currentTicker = secCodePart?.split('.')[1];
            const currentSecurity = companySecs.find(sec => sec.ticker === currentTicker);

            if (!currentSecurity) return null;

            const todayValue = today.securitiesBreakdown?.[currentSecurity.securityId] || 0;
            const yesterdayValue = yesterday.securitiesBreakdown?.[currentSecurity.securityId] || 0;

            return { current: todayValue, previous: yesterdayValue };
        }
    };

    // 전일 대비 주가 변화율 계산
    const getYesterdayPriceChange = () => {
        if (selectedSecurityType === "시가총액 구성") {
            // 시가총액 구성인 경우 대표 종목의 주가 변화율
            if (!security.prices || security.prices.length < 2) return null;
            const today = security.prices[0];
            const yesterday = security.prices[1];
            return { current: today.close, previous: yesterday.close };
        } else {
            // 개별 종목의 경우 해당 종목의 주가 변화율
            const pathParts = pathname.split('/');
            const secCodePart = pathParts.find(part => part.includes('.'));
            const currentTicker = secCodePart?.split('.')[1];
            const currentSecurity = companySecs.find(sec => sec.ticker === currentTicker);

            if (!currentSecurity?.prices || currentSecurity.prices.length < 2) return null;
            const today = currentSecurity.prices[0];
            const yesterday = currentSecurity.prices[1];
            return { current: today.close, previous: yesterday.close };
        }
    };

    // 현재 보통주 비중 계산
    const getCurrentCommonStockRatio = () => {
        if (!companyMarketcapData?.aggregatedHistory || companyMarketcapData.aggregatedHistory.length === 0) return 0;

        const latestData = [...companyMarketcapData.aggregatedHistory].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (latestData.securitiesBreakdown) {
            const commonStockSecurities = companyMarketcapData.securities.filter((sec: any) => sec.type === '보통주');
            const commonStockValue = commonStockSecurities.reduce((sum: number, sec: any) => {
                return sum + (latestData.securitiesBreakdown[sec.securityId] || 0);
            }, 0);
            return (commonStockValue / latestData.totalMarketcap) * 100;
        }
        return 0;
    };

    const getCurrentPrice = () => {
        if (selectedSecurityType === "시가총액 구성") {
            return security.prices?.[0]?.close ? `${security.prices[0].close.toLocaleString()}` : "—";
        } else {
            // 개별 종목의 경우 해당 종목 주가 표시
            const pathParts = pathname.split('/');
            const secCodePart = pathParts.find(part => part.includes('.'));
            const currentTicker = secCodePart?.split('.')[1];
            const currentSecurity = companySecs.find(sec => sec.ticker === currentTicker);

            if (currentSecurity?.prices?.[0]?.close) {
                return currentSecurity.prices[0].close.toLocaleString();
            }
            return security.prices?.[0]?.close ? `${security.prices[0].close.toLocaleString()}` : "—";
        }
    };

    if (!periodAnalysis) return null;

    return (
        <div id="indicators" className="py-8 -mx-4 px-4 bg-orange-50/20 dark:bg-orange-950/20 rounded-xl border-t border-orange-100 dark:border-orange-800/30">
            <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/50">
                    <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">핵심 지표</h2>
                    <p className="text-base text-gray-600 dark:text-gray-300 mt-1">
                        {selectedSecurityType === "시가총액 구성"
                            ? "시가총액 주요 지표와 변화율 현황"
                            : `${selectedSecurityType} 주요 지표와 변화율 현황`
                        }
                    </p>
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                className={`overflow-x-auto scroll-smooth hide-scrollbar ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                style={{
                    WebkitOverflowScrolling: 'touch',
                    userSelect: 'none' // 드래그 중 텍스트 선택 방지
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onTouchStart={handleTouchStart}
            >
                {/* 무한 스크롤을 위한 카드 세트 - 원본 */}
                <div className="flex gap-1 pb-2" style={{ minWidth: 'fit-content' }}>
                    {/* 시총 랭킹 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                if (selectedSecurityType === "시가총액 구성") {
                                    // 시가총액 구성 모드: 회사 랭킹 사용
                                    const companyRank = security.company?.marketcapRank;
                                    if (companyRank) {
                                        return (
                                            <>
                                                <span className="text-xl sm:text-2xl md:text-3xl">{companyRank}</span>
                                                <span className="text-sm sm:text-base ml-1">위</span>
                                            </>
                                        );
                                    }
                                } else {
                                    // 개별 종목 모드: 종목 랭킹 사용
                                    if (marketCapRanking) {
                                        return (
                                            <>
                                                <span className="text-xl sm:text-2xl md:text-3xl">{marketCapRanking.currentRank}</span>
                                                <span className="text-sm sm:text-base ml-1">위</span>
                                            </>
                                        );
                                    }
                                }
                                return <span className="text-xl sm:text-2xl md:text-3xl">—</span>;
                            })()}
                        </div>
                        {/* 랭킹 변화 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                if (selectedSecurityType === "시가총액 구성") {
                                    // 시가총액 구성 모드: 회사 랭킹 변화 사용
                                    const currentRank = security.company?.marketcapRank;
                                    const priorRank = security.company?.marketcapPriorRank;
                                    if (currentRank && priorRank) {
                                        const rankChange = currentRank - priorRank;
                                        return (
                                            <span className={rankChange < 0 ? "text-red-600 dark:text-red-400" : rankChange > 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}>
                                                {rankChange === 0 ? "—" :
                                                    rankChange < 0 ? `▲${Math.abs(rankChange)}` :
                                                        `▼${rankChange}`}
                                            </span>
                                        );
                                    }
                                } else {
                                    // 개별 종목 모드: 종목 랭킹 변화 사용
                                    if (marketCapRanking && marketCapRanking.priorRank) {
                                        return (
                                            <span className={marketCapRanking.rankChange < 0 ? "text-red-600 dark:text-red-400" : marketCapRanking.rankChange > 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}>
                                                {marketCapRanking.rankChange === 0 ? "—" :
                                                    marketCapRanking.rankChange < 0 ? `▲${Math.abs(marketCapRanking.rankChange)}` :
                                                        `▼${marketCapRanking.rankChange}`}
                                            </span>
                                        );
                                    }
                                }
                                return <span className="text-gray-500 dark:text-gray-400">—</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                            {selectedSecurityType === "시가총액 구성" ? "시총 랭킹" : `${selectedSecurityType} 랭킹`}
                        </div>
                    </div>

                    {/* 현재 시가총액 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('current');
                                const formatted = formatNumberWithSeparateUnit(value || 0);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        {/* 전일 대비 변화율 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getYesterdayChange();
                                if (!change) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const rate = getChangeRate(change.current, change.previous);
                                return <span className={rate.color}>{rate.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                            {selectedSecurityType === "시가총액 구성" ? "현재 시총" : `현재 ${selectedSecurityType} 시총`}
                        </div>
                    </div>

                    {/* 현재 주가 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{getCurrentPrice()}</span>
                            <span className="text-sm sm:text-base ml-1">원</span>
                        </div>
                        {/* 전일 대비 주가 변화율 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getYesterdayPriceChange();
                                if (!change) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const rate = getChangeRate(change.current, change.previous);
                                return <span className={rate.color}>{rate.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">현재 주가</div>
                    </div>

                    {/* 12개월 평균 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('avg12m');
                                if (!value) return <span className="text-xl sm:text-2xl md:text-3xl">—</span>;
                                const formatted = formatNumberWithSeparateUnit(value);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        {/* 이전 12개월 대비 변화율 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPreviousPeriodAverage('avg12m');
                                if (!change) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const rate = getChangeRate(change.current, change.previous);
                                return <span className={rate.color}>{rate.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">12개월 평균</div>
                    </div>

                    {/* 3년 평균 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('avg3y');
                                if (!value) return <span className="text-xl sm:text-2xl md:text-3xl">—</span>;
                                const formatted = formatNumberWithSeparateUnit(value);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPreviousPeriodAverage('avg3y');
                                if (!change) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const rate = getChangeRate(change.current, change.previous);
                                return <span className={rate.color}>{rate.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">3년 평균</div>
                    </div>

                    {/* 5년 평균 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('avg5y');
                                if (!value) return <span className="text-xl sm:text-2xl md:text-3xl">—</span>;
                                const formatted = formatNumberWithSeparateUnit(value);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPreviousPeriodAverage('avg5y');
                                if (!change) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const rate = getChangeRate(change.current, change.previous);
                                return <span className={rate.color}>{rate.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">5년 평균</div>
                    </div>

                    {/* 10년 평균 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('avg10y');
                                if (!value) return <span className="text-xl sm:text-2xl md:text-3xl">—</span>;
                                const formatted = formatNumberWithSeparateUnit(value);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPreviousPeriodAverage('avg10y');
                                if (!change) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const rate = getChangeRate(change.current, change.previous);
                                return <span className={rate.color}>{rate.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">10년 평균</div>
                    </div>

                    {/* 전체 평균 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('avgAll');
                                if (!value) return <span className="text-xl sm:text-2xl md:text-3xl">—</span>;
                                const formatted = formatNumberWithSeparateUnit(value);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">전체 평균</div>
                    </div>

                    {/* 최저 시총 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('min');
                                const formatted = formatNumberWithSeparateUnit(value || 0);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최저 시총</div>
                    </div>

                    {/* 최고 시총 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            {(() => {
                                const value = getMetricValue('max');
                                const formatted = formatNumberWithSeparateUnit(value || 0);
                                return (
                                    <>
                                        <span className="text-xl sm:text-2xl md:text-3xl">{formatted.number}</span>
                                        <span className="text-sm sm:text-base ml-1">{formatted.unit}원</span>
                                    </>
                                );
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최고 시총</div>
                    </div>

                    {/* 최고 보통주 비중 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">
                                {(() => {
                                    const ratio = getCommonStockRatio('max');
                                    return ratio > 0 ? `${ratio.toFixed(1)}` : "—";
                                })()}
                            </span>
                            <span className="text-sm sm:text-base ml-1">%</span>
                        </div>
                        {/* 현재 비중과의 차이 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const currentRatio = getCurrentCommonStockRatio();
                                const maxRatio = getCommonStockRatio('max');
                                if (maxRatio === 0 || currentRatio === 0) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const diff = maxRatio - currentRatio;
                                const color = diff > 0 ? "text-red-600 dark:text-red-400" : diff < 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400";
                                return <span className={color}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%p</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최고 보통주 비중</div>
                    </div>

                    {/* 최저 보통주 비중 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">
                                {(() => {
                                    const ratio = getCommonStockRatio('min');
                                    return ratio < 100 ? `${ratio.toFixed(1)}` : "—";
                                })()}
                            </span>
                            <span className="text-sm sm:text-base ml-1">%</span>
                        </div>
                        {/* 현재 비중과의 차이 */}
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const currentRatio = getCurrentCommonStockRatio();
                                const minRatio = getCommonStockRatio('min');
                                if (minRatio >= 100 || currentRatio === 0) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const diff = minRatio - currentRatio;
                                const color = diff > 0 ? "text-red-600 dark:text-red-400" : diff < 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400";
                                return <span className={color}>{diff > 0 ? '+' : ''}{diff.toFixed(1)}%p</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최저 보통주 비중</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
