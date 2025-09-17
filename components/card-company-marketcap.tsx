"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { formatNumber, formatDate } from "@/lib/utils";
import Link from "next/link";
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
        <Card className="w-full h-fit">
            {/* 헤더 섹션 - 273px 높이에 맞게 조정 */}
            <CardHeader className="pb-2">
                <div className="space-y-2">
                    <CardTitle className="text-base font-semibold text-foreground leading-tight">
                        {displayName} 시가총액
                    </CardTitle>
                    <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-base px-3 py-1 font-bold">
                            {formatNumber(data.totalMarketcap)}원
                        </Badge>
                        <p className="text-sm text-muted-foreground">
                            {formatDate(data.totalMarketcapDate)}
                        </p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 pt-0">
                {/* 반응형 파이 차트 섹션 */}
                <div className="space-y-4">
                    {/* 파이 차트 - 조건부 렌더링으로 변경 */}
                    <div className="w-full">
                        {screenSize === 'mobile' && (
                            <div className="h-[220px] min-h-[220px]">
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

                        {screenSize === 'desktop' && (
                            <div className="h-[350px] min-h-[350px]">
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
                            <div className="h-[282px] min-h-[282px]">
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
