"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { formatNumberWithSeparateUnit, formatChangeRate, formatDifference } from "@/lib/utils";

interface KeyMetricsSectionProps {
    companyMarketcapData: any;
    companySecs: any[];
    security: any;
    periodAnalysis: any;
}

export function KeyMetricsSection({
    companyMarketcapData,
    companySecs,
    security,
    periodAnalysis,
}: KeyMetricsSectionProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

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

    // 선택된 타입에 따른 데이터 필터링
    const getMetricValue = (type: 'current' | 'avg12m' | 'avg3y' | 'avg5y' | 'avg10y' | 'avgAll' | 'min' | 'max') => {
        if (!companyMarketcapData?.aggregatedHistory) return null;

        if (selectedSecurityType === "시가총액 구성") {
            // 시가총액 구성: 전체 시가총액 기준
            switch (type) {
                case 'current': return periodAnalysis?.periods[0]?.value || 0;
                case 'avg12m': return periodAnalysis?.periods.find((p: any) => p.label === '12개월 평균')?.value;
                case 'avg3y': return periodAnalysis?.periods.find((p: any) => p.label === '3년 평균')?.value;
                case 'avg5y': return periodAnalysis?.periods.find((p: any) => p.label === '5년 평균')?.value;
                case 'avg10y': return periodAnalysis?.periods.find((p: any) => p.label === '10년 평균')?.value;
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

            if (securityValues.length === 0) return null;

            switch (type) {
                case 'current': return securityValues[securityValues.length - 1];
                case 'avg12m': {
                    const recent12m = securityValues.slice(-365);
                    return recent12m.length > 0 ? recent12m.reduce((sum: number, val: number) => sum + val, 0) / recent12m.length : null;
                }
                case 'avg3y': {
                    const recent3y = securityValues.slice(-1095);
                    return recent3y.length > 0 ? recent3y.reduce((sum: number, val: number) => sum + val, 0) / recent3y.length : null;
                }
                case 'avg5y': {
                    const recent5y = securityValues.slice(-1825);
                    return recent5y.length > 0 ? recent5y.reduce((sum: number, val: number) => sum + val, 0) / recent5y.length : null;
                }
                case 'avg10y': {
                    return securityValues.length > 0 ? securityValues.reduce((sum: number, val: number) => sum + val, 0) / securityValues.length : null;
                }
                case 'avgAll': {
                    return securityValues.length > 0 ? securityValues.reduce((sum: number, val: number) => sum + val, 0) / securityValues.length : null;
                }
                case 'min': return securityValues.length > 0 ? Math.min(...securityValues) : null;
                case 'max': return securityValues.length > 0 ? Math.max(...securityValues) : null;
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
            return { value: "—", color: "text-gray-500" };
        }
        const rate = ((current - comparison) / comparison) * 100;
        return formatChangeRate(rate);
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
        <div id="indicators" className="py-8 -mx-4 px-4 bg-orange-50/20 dark:bg-orange-900/20 rounded-xl border-t-2 border-orange-100 dark:border-orange-800">
            <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-800/50">
                    <TrendingUp className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">핵심 지표</h2>
                    <p className="text-base text-gray-600 dark:text-gray-400 mt-1">
                        {selectedSecurityType === "시가총액 구성"
                            ? "시가총액 주요 지표와 변화율 현황"
                            : `${selectedSecurityType} 주요 지표와 변화율 현황`
                        }
                    </p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="flex gap-1 pb-2" style={{ minWidth: 'fit-content' }}>
                    {/* 시총 랭킹 */}
                    <div className="rounded-lg border bg-card p-1 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200 cursor-pointer flex-shrink-0" style={{ width: 'calc((100vw - 32px - 6px) / 7)', minWidth: '80px', height: 'calc((100vw - 32px - 6px) / 7)', minHeight: '80px', maxWidth: '120px', maxHeight: '120px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">1</span>
                            <span className="text-sm sm:text-base ml-1">위</span>
                        </div>
                        <div className="text-xs text-muted-foreground leading-tight px-1">
                            {selectedSecurityType === "시가총액 구성" ? "시총 랭킹" : `${selectedSecurityType} 랭킹`}
                        </div>
                    </div>

                    {/* 현재 시가총액 */}
                    <div className="rounded-lg border bg-card p-1 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200 cursor-pointer flex-shrink-0" style={{ width: 'calc((100vw - 32px - 6px) / 7)', minWidth: '80px', height: 'calc((100vw - 32px - 6px) / 7)', minHeight: '80px', maxWidth: '120px', maxHeight: '120px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary mb-1 leading-none">
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
                        <div className="text-xs text-muted-foreground leading-tight px-1">
                            {selectedSecurityType === "시가총액 구성" ? "현재 시총" : `현재 ${selectedSecurityType} 시총`}
                        </div>
                    </div>

                    {/* 현재 주가 */}
                    <div className="rounded-lg border bg-card p-1 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200 cursor-pointer flex-shrink-0" style={{ width: 'calc((100vw - 32px - 6px) / 7)', minWidth: '80px', height: 'calc((100vw - 32px - 6px) / 7)', minHeight: '80px', maxWidth: '120px', maxHeight: '120px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">{getCurrentPrice()}</span>
                            <span className="text-sm sm:text-base ml-1">원</span>
                        </div>
                        <div className="text-xs text-muted-foreground leading-tight px-1">현재 주가</div>
                    </div>

                    {/* 12개월 평균 */}
                    <div className="rounded-lg border bg-card p-1 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200 cursor-pointer flex-shrink-0" style={{ width: 'calc((100vw - 32px - 6px) / 7)', minWidth: '80px', height: 'calc((100vw - 32px - 6px) / 7)', minHeight: '80px', maxWidth: '120px', maxHeight: '120px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary mb-1 leading-none">
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
                        <div className="text-xs text-muted-foreground leading-tight px-1">12개월 평균</div>
                    </div>

                    {/* 3년 평균 */}
                    <div className="rounded-lg border bg-card p-1 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200 cursor-pointer flex-shrink-0" style={{ width: 'calc((100vw - 32px - 6px) / 7)', minWidth: '80px', height: 'calc((100vw - 32px - 6px) / 7)', minHeight: '80px', maxWidth: '120px', maxHeight: '120px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary mb-1 leading-none">
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
                        <div className="text-xs text-muted-foreground leading-tight px-1">3년 평균</div>
                    </div>

                    {/* 5년 평균 */}
                    <div className="rounded-lg border bg-card p-1 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200 cursor-pointer flex-shrink-0" style={{ width: 'calc((100vw - 32px - 6px) / 7)', minWidth: '80px', height: 'calc((100vw - 32px - 6px) / 7)', minHeight: '80px', maxWidth: '120px', maxHeight: '120px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary mb-1 leading-none">
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
                        <div className="text-xs text-muted-foreground leading-tight px-1">5년 평균</div>
                    </div>

                    {/* 10년 평균 */}
                    <div className="rounded-lg border bg-card p-1 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200 cursor-pointer flex-shrink-0" style={{ width: 'calc((100vw - 32px - 6px) / 7)', minWidth: '80px', height: 'calc((100vw - 32px - 6px) / 7)', minHeight: '80px', maxWidth: '120px', maxHeight: '120px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary mb-1 leading-none">
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
                        <div className="text-xs text-muted-foreground leading-tight px-1">10년 평균</div>
                    </div>

                    {/* 전체 평균 */}
                    <div className="rounded-lg border bg-card p-1 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200 cursor-pointer flex-shrink-0" style={{ width: 'calc((100vw - 32px - 6px) / 7)', minWidth: '80px', height: 'calc((100vw - 32px - 6px) / 7)', minHeight: '80px', maxWidth: '120px', maxHeight: '120px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary mb-1 leading-none">
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
                        <div className="text-xs text-muted-foreground leading-tight px-1">전체 평균</div>
                    </div>

                    {/* 최저 시총 */}
                    <div className="rounded-lg border bg-card p-1 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200 cursor-pointer flex-shrink-0" style={{ width: 'calc((100vw - 32px - 6px) / 7)', minWidth: '80px', height: 'calc((100vw - 32px - 6px) / 7)', minHeight: '80px', maxWidth: '120px', maxHeight: '120px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary mb-1 leading-none">
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
                        <div className="text-xs text-muted-foreground leading-tight px-1">최저 시총</div>
                    </div>

                    {/* 최고 시총 */}
                    <div className="rounded-lg border bg-card p-1 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200 cursor-pointer flex-shrink-0" style={{ width: 'calc((100vw - 32px - 6px) / 7)', minWidth: '80px', height: 'calc((100vw - 32px - 6px) / 7)', minHeight: '80px', maxWidth: '120px', maxHeight: '120px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary mb-1 leading-none">
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
                        <div className="text-xs text-muted-foreground leading-tight px-1">최고 시총</div>
                    </div>

                    {/* 최고 보통주 비중 */}
                    <div className="rounded-lg border bg-card p-1 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200 cursor-pointer flex-shrink-0" style={{ width: 'calc((100vw - 32px - 6px) / 7)', minWidth: '80px', height: 'calc((100vw - 32px - 6px) / 7)', minHeight: '80px', maxWidth: '120px', maxHeight: '120px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">
                                {(() => {
                                    const ratio = getCommonStockRatio('max');
                                    return ratio > 0 ? `${ratio.toFixed(1)}` : "—";
                                })()}
                            </span>
                            <span className="text-sm sm:text-base ml-1">%</span>
                        </div>
                        <div className="text-xs text-muted-foreground leading-tight px-1">최고 보통주 비중</div>
                    </div>

                    {/* 최저 보통주 비중 */}
                    <div className="rounded-lg border bg-card p-1 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow duration-200 cursor-pointer flex-shrink-0" style={{ width: 'calc((100vw - 32px - 6px) / 7)', minWidth: '80px', height: 'calc((100vw - 32px - 6px) / 7)', minHeight: '80px', maxWidth: '120px', maxHeight: '120px' }}>
                        <div className="flex items-baseline justify-center font-bold text-primary mb-1 leading-none">
                            <span className="text-xl sm:text-2xl md:text-3xl">
                                {(() => {
                                    const ratio = getCommonStockRatio('min');
                                    return ratio < 100 ? `${ratio.toFixed(1)}` : "—";
                                })()}
                            </span>
                            <span className="text-sm sm:text-base ml-1">%</span>
                        </div>
                        <div className="text-xs text-muted-foreground leading-tight px-1">최저 보통주 비중</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
