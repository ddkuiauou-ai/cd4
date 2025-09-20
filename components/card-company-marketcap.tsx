"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDate } from "@/lib/utils";
import ChartPieMarketcap from "@/components/chart-pie-marketcap";
import type { CompanyMarketcapAggregated } from "@/lib/data/company";

interface CardCompanyMarketcapProps {
    data: CompanyMarketcapAggregated;
    market?: string;
    selectedType?: string; // 🎯 파이 차트 어노테이션을 위한 선택 타입
}

export default function CardCompanyMarketcap({ data, market = "KOSPI", selectedType = "시가총액 구성" }: CardCompanyMarketcapProps) {
    const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop' | 'desktop-sidebar'>('mobile');

    useEffect(() => {
        const checkScreenSize = () => {
            const width = window.innerWidth;
            if (width < 640) setScreenSize('mobile');
            else if (width < 1024) setScreenSize('tablet');
            else if (width < 1280) setScreenSize('desktop');
            else setScreenSize('desktop-sidebar');
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    const displayName = data.companyKorName || data.companyName;

    // 파이 차트용 데이터 준비
    const chartData = data.securities
        .filter(sec => (sec.marketcap || 0) > 0)
        .sort((a, b) => (b.marketcap || 0) - (a.marketcap || 0))
        .map((security) => ({
            name: security.korName || security.name || security.ticker || '알 수 없음',
            value: security.marketcap || 0,
            percentage: security.percentage,
            type: security.type || '보통주'
        }));

    return (
        <Card className="flex h-full w-full flex-col">
            <CardHeader className="space-y-2 px-5 pt-5 pb-3">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold leading-tight text-foreground">
                        {displayName} 시가총액 구성
                    </CardTitle>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <Badge variant="secondary" className="px-3 py-1 text-sm font-semibold">
                            {formatNumber(data.totalMarketcap)}원
                        </Badge>
                        <p>{formatDate(data.totalMarketcapDate)}</p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-0">
                <div className="flex-1 space-y-3">
                    <div className="w-full">
                        {screenSize === 'mobile' && (
                            <div className="h-[200px] min-h-[200px]">
                                <ChartPieMarketcap
                                    data={chartData}
                                    centerText={{
                                        title: "총액",
                                        value: formatNumber(data.totalMarketcap)
                                    }}
                                    selectedType={selectedType}
                                />
                            </div>
                        )}

                        {screenSize === 'tablet' && (
                            <div className="h-[240px] min-h-[240px]">
                                <ChartPieMarketcap
                                    data={chartData}
                                    centerText={{
                                        title: "총액",
                                        value: formatNumber(data.totalMarketcap)
                                    }}
                                    selectedType={selectedType}
                                />
                            </div>
                        )}

                        {screenSize === 'desktop' && (
                            <div className="h-[280px] min-h-[280px]">
                                <ChartPieMarketcap
                                    data={chartData}
                                    centerText={{
                                        title: "총액",
                                        value: formatNumber(data.totalMarketcap)
                                    }}
                                    selectedType={selectedType}
                                />
                            </div>
                        )}

                        {screenSize === 'desktop-sidebar' && (
                            <div className="h-[260px] min-h-[260px]">
                                <ChartPieMarketcap
                                    data={chartData}
                                    centerText={{
                                        title: "총액",
                                        value: formatNumber(data.totalMarketcap)
                                    }}
                                    selectedType={selectedType}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
