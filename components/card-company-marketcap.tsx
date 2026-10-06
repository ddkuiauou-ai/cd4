"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatDate } from "@/lib/utils";
import ChartPieMarketcap from "@/components/chart-pie-marketcap";
import type { CompanyMarketcapAggregated } from "@/lib/data/company";

interface CardCompanyMarketcapProps {
    data: CompanyMarketcapAggregated;
    market?: string;
    selectedType?: string; // 🎯 파이 차트 어노테이션을 위한 선택 타입
    selectedSecurityId?: string;
}

export default function CardCompanyMarketcap({ data, selectedType = "시가총액 구성", selectedSecurityId }: CardCompanyMarketcapProps) {
    const displayName = data.companyKorName || data.companyName;

    // 파이 차트용 데이터 준비
    const chartData = data.securities
        .filter(sec => (sec.marketcap || 0) > 0)
        .sort((a, b) => (b.marketcap || 0) - (a.marketcap || 0))
        .map((security) => ({
            securityId: security.securityId,
            ticker: security.ticker,
            name: security.korName || security.name || security.ticker || '알 수 없음',
            value: security.marketcap || 0,
            percentage: security.percentage,
            type: security.type || '보통주'
        }));

    return (
        <Card className="flex h-full min-w-0 w-full flex-col rounded-none border-border bg-background shadow-none">
            <CardHeader className="space-y-2 px-5 pt-5 pb-3">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold leading-tight text-foreground">
                        {displayName} 시가총액 구성
                    </CardTitle>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span className="text-sm font-semibold tabular-nums">
                            {formatNumber(data.totalMarketcap)}원
                        </span>
                        <p>{formatDate(data.totalMarketcapDate)}</p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-0">
                <div className="flex-1 space-y-3">
                    <div className="w-full">
                        <div className="h-[320px] min-h-[320px] w-full min-w-0">
                            <ChartPieMarketcap
                                data={chartData}
                                centerText={{
                                    title: "총액",
                                    value: formatNumber(data.totalMarketcap)
                                }}
                                selectedType={selectedType}
                                selectedSecurityId={selectedSecurityId}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
