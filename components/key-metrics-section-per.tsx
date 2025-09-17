"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { TrendingUp } from "lucide-react";
import { formatNumberWithSeparateUnit, formatChangeRate } from "@/lib/utils";

interface KeyMetricsSectionPERProps {
    security: any;
    perRank: number | null;
    latestPER: number | null;
    per12Month: number | null;
    per3Year: number | null;
    per5Year: number | null;
    per10Year: number | null;
    per20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    result: Array<{ date: string; value: number }>;
}

export function KeyMetricsSectionPER({
    security,
    perRank,
    latestPER,
    per12Month,
    per3Year,
    per5Year,
    per10Year,
    per20Year,
    rangeMin,
    rangeMax,
    result,
}: KeyMetricsSectionPERProps) {
    // 스크롤 컨테이너 ref
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 자동 스크롤 상태
    const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
    const autoScrollAnimationRef = useRef<number | null>(null);
    const lastScrollTimeRef = useRef<number>(0);
    const restartTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 드래그 상태
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 });

    // 카드 복제 (무한 스크롤)
    useEffect(() => {
        if (!scrollContainerRef.current) return;

        const container = scrollContainerRef.current;
        const cardContainer = container.querySelector('.flex') as HTMLElement;

        if (!cardContainer || cardContainer.dataset.cloned === 'true') return;

        const originalCards = Array.from(cardContainer.children);

        // 2세트 복제
        originalCards.forEach(card => {
            const clonedCard = card.cloneNode(true) as HTMLElement;
            cardContainer.appendChild(clonedCard);
        });

        originalCards.forEach(card => {
            const clonedCard = card.cloneNode(true) as HTMLElement;
            cardContainer.appendChild(clonedCard);
        });

        cardContainer.dataset.cloned = 'true';

        // 초기 스크롤 위치
        const singleSetWidth = cardContainer.scrollWidth / 3;
        container.scrollLeft = singleSetWidth;
    }, []);

    // 부드러운 무한 스크롤
    const smoothAutoScroll = useCallback(() => {
        if (!scrollContainerRef.current || !isAutoScrollEnabled) return;

        const container = scrollContainerRef.current;
        const now = Date.now();

        if (now - lastScrollTimeRef.current >= 30) {
            const cardContainer = container.querySelector('.flex') as HTMLElement;

            if (cardContainer && cardContainer.dataset.cloned === 'true') {
                const singleSetWidth = cardContainer.scrollWidth / 3;
                const currentScrollLeft = container.scrollLeft;

                if (currentScrollLeft >= singleSetWidth * 2.8) {
                    container.style.scrollBehavior = 'auto';
                    container.scrollLeft = singleSetWidth + (currentScrollLeft - singleSetWidth * 2);
                    requestAnimationFrame(() => {
                        container.style.scrollBehavior = 'smooth';
                    });
                } else if (currentScrollLeft <= singleSetWidth * 0.2) {
                    container.style.scrollBehavior = 'auto';
                    container.scrollLeft = singleSetWidth + currentScrollLeft;
                    requestAnimationFrame(() => {
                        container.style.scrollBehavior = 'smooth';
                    });
                } else {
                    container.scrollLeft += 1;
                }
            } else {
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

    // 자동 스크롤 일시정지 (3초 후 재시작)
    const pauseAutoScroll = useCallback(() => {
        if (restartTimerRef.current) {
            clearTimeout(restartTimerRef.current);
        }

        setIsAutoScrollEnabled(false);

        restartTimerRef.current = setTimeout(() => {
            setIsAutoScrollEnabled(true);
        }, 3000);
    }, []);

    // 마우스 이벤트 핸들러
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        pauseAutoScroll();
        setIsDragging(true);
        setDragStart({
            x: e.pageX,
            scrollLeft: scrollContainerRef.current?.scrollLeft || 0
        });
        e.preventDefault();
    }, [pauseAutoScroll]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX;
        const walk = (x - dragStart.x) * 2;
        scrollContainerRef.current.scrollLeft = dragStart.scrollLeft - walk;
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleTouchStart = useCallback(() => {
        pauseAutoScroll();
    }, [pauseAutoScroll]);

    // PER 변화율 계산 (간단 버전)
    const getPERChangeRate = (current: number | null, previous: number | null) => {
        if (!current || !previous) return { value: "—", color: "text-gray-500 dark:text-gray-400" };

        const changeRate = ((current - previous) / previous) * 100;
        const value = `${changeRate >= 0 ? '+' : ''}${changeRate.toFixed(1)}%`;
        const color = changeRate > 0 ? "text-red-600 dark:text-red-400" :
            changeRate < 0 ? "text-blue-600 dark:text-blue-400" :
                "text-gray-500 dark:text-gray-400";

        return { value, color };
    };

    return (
        <div id="key-metrics" className="space-y-8 relative border-t border-blue-100 dark:border-blue-800/50 pt-8 pb-8 bg-blue-50/20 dark:bg-blue-900/20 rounded-xl -mx-4 px-4">
            <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-800/50">
                    <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">핵심 지표</h2>
                    <p className="text-base text-gray-600 dark:text-gray-400 mt-1">PER 분석과 주요 투자 지표</p>
                </div>
            </div>

            {/* 스크롤 가능한 지표 컨테이너 */}
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

                    {/* PER 랭킹 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{perRank || "—"}</span>
                            {perRank && <span className="text-sm sm:text-base ml-1">위</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            <span className="text-gray-500 dark:text-gray-400">—</span>
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">PER 랭킹</div>
                    </div>

                    {/* 현재 PER */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{latestPER ? latestPER.toFixed(1) : "—"}</span>
                            {latestPER && <span className="text-sm sm:text-base ml-1">배</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPERChangeRate(latestPER, per12Month);
                                return <span className={change.color}>{change.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">현재 PER</div>
                    </div>

                    {/* 현재 주가 */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{security.prices?.[0]?.close ? security.prices[0].close.toLocaleString() : "—"}</span>
                            {security.prices?.[0]?.close && <span className="text-sm sm:text-base ml-1">원</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                if (!security.prices || security.prices.length < 2) return <span className="text-gray-500 dark:text-gray-400">—</span>;
                                const today = security.prices[0].close;
                                const yesterday = security.prices[1].close;
                                const change = getPERChangeRate(today, yesterday);
                                return <span className={change.color}>{change.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">현재 주가</div>
                    </div>

                    {/* 12개월 평균 PER */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{per12Month ? per12Month.toFixed(1) : "—"}</span>
                            {per12Month && <span className="text-sm sm:text-base ml-1">배</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPERChangeRate(per12Month, per3Year);
                                return <span className={change.color}>{change.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">12개월 평균</div>
                    </div>

                    {/* 3년 평균 PER */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{per3Year ? per3Year.toFixed(1) : "—"}</span>
                            {per3Year && <span className="text-sm sm:text-base ml-1">배</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPERChangeRate(per3Year, per5Year);
                                return <span className={change.color}>{change.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">3년 평균</div>
                    </div>

                    {/* 5년 평균 PER */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{per5Year ? per5Year.toFixed(1) : "—"}</span>
                            {per5Year && <span className="text-sm sm:text-base ml-1">배</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPERChangeRate(per5Year, per10Year);
                                return <span className={change.color}>{change.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">5년 평균</div>
                    </div>

                    {/* 10년 평균 PER */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{per10Year ? per10Year.toFixed(1) : "—"}</span>
                            {per10Year && <span className="text-sm sm:text-base ml-1">배</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            {(() => {
                                const change = getPERChangeRate(per10Year, per20Year);
                                return <span className={change.color}>{change.value}</span>;
                            })()}
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">10년 평균</div>
                    </div>

                    {/* 20년 평균 PER */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{per20Year ? per20Year.toFixed(1) : "—"}</span>
                            {per20Year && <span className="text-sm sm:text-base ml-1">배</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            <span className="text-gray-500 dark:text-gray-400">전체 평균</span>
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">20년 평균</div>
                    </div>

                    {/* 최저 PER */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{rangeMin ? rangeMin.toFixed(1) : "—"}</span>
                            {rangeMin && <span className="text-sm sm:text-base ml-1">배</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            <span className="text-gray-500 dark:text-gray-400">최저점</span>
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최저 PER</div>
                    </div>

                    {/* 최고 PER */}
                    <div className="rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200 cursor-pointer flex-shrink-0 snap-center" style={{ width: 'calc((100vw - 32px - 5px) / 6)', minWidth: '100px', height: 'calc((100vw - 32px - 5px) / 6)', minHeight: '100px', maxWidth: '140px', maxHeight: '140px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{rangeMax ? rangeMax.toFixed(1) : "—"}</span>
                            {rangeMax && <span className="text-sm sm:text-base ml-1">배</span>}
                        </div>
                        <div className="text-xs leading-none mb-1">
                            <span className="text-gray-500 dark:text-gray-400">최고점</span>
                        </div>
                        <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">최고 PER</div>
                    </div>

                </div>
            </div>
        </div>
    );
}
