"use client";

import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import Exchange from "@/components/exchange";
import RankChange from "@/components/rank-change";
import Rate from "@/components/rate";
import CompanyLogo from "@/components/CompanyLogo";
import SpikeChart from "@/components/spike-chart";
import Link from "next/link";
import { formatNumber, formatNumberWithSeparateUnit } from "@/lib/utils";
import { Price } from "@/typings";
import { CHART_DIMENSIONS } from "@/config/constants";
import React from "react";

interface ServerTableProps {
    data: any[];
    latestDate: string;
    updatedDate: string;
    title?: string;
    subTitle?: string;
    infoColumnHeader?: string;
    headerActions?: React.ReactNode;
    metric?: 'marketcap' | 'per' | 'div' | 'dps' | 'bps' | 'pbr' | 'eps';
}

export function ServerTable({ 
    data, 
    latestDate, 
    updatedDate, 
    title = "시가총액 기업 랭킹", 
    subTitle = "코스피 · 코스닥 · 코넥스 상장 기업",
    infoColumnHeader = "기업 정보",
    headerActions,
    metric = 'marketcap'
}: ServerTableProps) {
    const pathname = usePathname();
    const linkType = pathname.includes('/marketcaps') ? 'company' : 'security';

    return (
        <div className="border rounded-lg overflow-hidden bg-card mx-auto max-w-none">
            {/* Table Header Info */}
            <div className="px-8 py-6 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold">{title}</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {subTitle} ({latestDate} 기준)
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-xs text-muted-foreground">최신 업데이트</p>
                            <p className="text-sm font-medium">{updatedDate}</p>
                        </div>
                        {React.Children.toArray(headerActions)}
                    </div>
                </div>
            </div>

            {/* Enhanced Table */}
            <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px]">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr>
                            <th className="text-left px-6 py-4 font-semibold w-[10%] whitespace-nowrap">순위</th>
                            <th className="text-left px-6 py-4 font-semibold w-[30%]">{infoColumnHeader}</th>
                            <th className="text-right px-6 py-4 font-semibold w-[18%]">
                                {metric === 'per' ? 'PER' : metric === 'div' ? '배당수익률' : metric === 'dps' ? 'DPS' : metric === 'bps' ? 'BPS' : metric === 'pbr' ? 'PBR' : metric === 'eps' ? 'EPS' : '시가총액'}
                            </th>
                            <th className="text-center px-6 py-4 font-semibold w-[12%]">변동률</th>
                            <th className="text-right px-6 py-4 font-semibold w-[15%]">주가</th>
                            <th className="text-center px-6 py-4 font-semibold w-[15%]">
                                <div className="flex items-center justify-center space-x-1">
                                    <span>📈</span>
                                    <span>30일 변화</span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((company, index) => {
                            if (!company.securities || company.securities.length === 0) return null;
                            const security = company.securities[0];
                            if (!security.prices || security.prices.length === 0) return null;

                            const { close, rate } = security.prices[security.prices.length - 1] || {};

                            const rank = metric === 'per' ? company.perRank : metric === 'div' ? company.divRank : metric === 'dps' ? company.dpsRank : metric === 'bps' ? company.bpsRank : metric === 'pbr' ? company.pbrRank : metric === 'eps' ? company.epsRank : company.marketcapRank;
                            const priorRank = metric === 'per' ? company.perPriorRank : metric === 'div' ? company.divPriorRank : metric === 'dps' ? company.dpsPriorRank : metric === 'bps' ? company.bpsPriorRank : metric === 'pbr' ? company.pbrPriorRank : metric === 'eps' ? company.epsPriorRank : company.marketcapPriorRank;

                            // 순위별 특별 스타일링
                            const isTopRank = rank <= 3;
                            const isTopTen = rank <= 10;

                            return (
                                <tr
                                    key={company.securityId ?? company.companyId}
                                    className={`
                                        border-b border-border/50 
                                        hover:bg-gradient-to-r hover:from-primary/5 hover:to-transparent 
                                        hover:shadow-lg hover:scale-[1.01]
                                        transition-all duration-300 group cursor-pointer
                                        ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                                        ${isTopRank ? 'bg-gradient-to-r from-yellow-50 to-transparent dark:from-yellow-900/20' : ''}
                                        ${isTopTen && !isTopRank ? 'bg-gradient-to-r from-blue-50 to-transparent dark:from-blue-900/20' : ''}
                                    `}
                                >
                                    {/* Rank Column with Enhanced Styling */}
                                    <td className="px-6 py-6 whitespace-nowrap">
                                        <div className="flex items-center space-x-3 min-w-[72px]">
                                            {/* Enhanced rank badge with conditional styling */}
                                            <Badge
                                                variant={isTopRank ? "default" : isTopTen ? "secondary" : "outline"}
                                                className={`
                                                    px-3 py-1 font-bold text-sm whitespace-nowrap
                                                    ${isTopRank ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-md' : ''}
                                                    ${isTopTen && !isTopRank ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white' : ''}
                                                    transition-all duration-200 group-hover:scale-110
                                                `}
                                            >
                                                {isTopRank && '👑 '}
                                                {rank}위
                                            </Badge>
                                            <RankChange
                                                priorRank={priorRank as number}
                                                currentRank={rank as number}
                                                size="md"
                                                variant="default"
                                            />
                                        </div>
                                    </td>

                                    {/* Company Info Column */}
                                    <td className="px-6 py-6">
                                        <Link href={`/${linkType}/${security.exchange}.${security.ticker}/${metric}`}
                                            className="group block hover:bg-muted/30 rounded-lg p-3 -m-3 transition-colors">
                                            <div className="flex items-center space-x-4">
                                                <div className="flex-shrink-0">
                                                    <CompanyLogo
                                                        companyName={company.name}
                                                        logoUrl={company.logo}
                                                        size={48}
                                                    />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-bold text-lg md:text-xl text-foreground group-hover:text-primary transition-colors leading-tight mb-2">
                                                        {company.name}
                                                    </div>
                                                    <div className="flex items-center space-x-3">
                                                        <Exchange exchange={security.exchange as string} />
                                                        <span className="text-sm text-muted-foreground">·</span>
                                                        <span className="text-sm text-muted-foreground font-mono font-medium">
                                                            {security.ticker}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    </td>

                                    {/* Metric Column */}
                                    <td className="px-6 py-6 text-right">
                                        <div className="font-bold text-lg md:text-xl tabular-nums text-primary">
                                            {metric === 'per' ? (
                                                company.per != null ? `${company.per.toFixed(2)}배` : "—"
                                            ) : metric === 'div' ? (
                                                company.div != null ? `${company.div.toFixed(2)}%` : "—"
                                            ) : metric === 'dps' ? (
                                                company.dps != null ? `${company.dps.toLocaleString()}원` : "—"
                                            ) : metric === 'bps' ? (
                                                company.bps != null ? `${company.bps.toLocaleString()}원` : "—"
                                            ) : metric === 'pbr' ? (
                                                company.pbr != null ? `${company.pbr.toFixed(2)}배` : "—"
                                            ) : metric === 'eps' ? (
                                                company.eps != null ? `${company.eps.toLocaleString()}원` : "—"
                                            ) : (
                                                company.marketcap != null ? (
                                                    (() => {
                                                        const formatted = formatNumberWithSeparateUnit(company.marketcap);
                                                        return (
                                                            <>
                                                                {formatted.number}
                                                                <span className="text-sm text-muted-foreground font-normal ml-1">
                                                                    {formatted.unit}원
                                                                </span>
                                                            </>
                                                        );
                                                    })()
                                                ) : (
                                                    "—"
                                                )
                                            )}
                                        </div>
                                    </td>

                                    {/* Rate Column - extracted for better visual hierarchy */}
                                    <td className="px-6 py-6 text-center">
                                        <div className="flex justify-center">
                                            <Rate rate={rate as number} size="lg" showIcon />
                                        </div>
                                    </td>

                                    {/* Stock Price Column - simplified */}
                                    <td className="px-6 py-6 text-right">
                                        <div className="font-bold text-lg md:text-xl tabular-nums">
                                            {close?.toLocaleString()}
                                            <span className="text-sm text-muted-foreground font-normal ml-1">원</span>
                                        </div>
                                    </td>

                                    {/* Enhanced Chart Column with Tooltip */}
                                    <td className="px-6 py-6">
                                        <div className="flex justify-center">
                                            <div className="group relative cursor-pointer">
                                                {/* Enhanced chart container */}
                                                <div className="rounded-xl overflow-hidden border-2 border-muted/30 bg-gradient-to-br from-background to-muted/20 p-3 transition-all duration-300 group-hover:border-primary/40 group-hover:shadow-lg group-hover:scale-105 group-hover:bg-gradient-to-br group-hover:from-background group-hover:to-primary/5">
                                                    <SpikeChart
                                                        prices={security.prices as Price[]}
                                                        rate={rate as number}
                                                        width={CHART_DIMENSIONS.SPIKE_CHART.DESKTOP.width}
                                                        height={CHART_DIMENSIONS.SPIKE_CHART.DESKTOP.height}
                                                    />
                                                </div>
                                                {/* Enhanced Tooltip */}
                                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-3 bg-popover text-popover-foreground text-sm rounded-lg shadow-xl border-2 border-border/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-nowrap z-20 backdrop-blur-sm bg-background/95">
                                                    <div className="text-center space-y-1">
                                                        <div className="font-bold text-primary">현재가: {close?.toLocaleString()}원</div>
                                                        <div className="text-xs text-muted-foreground">30일 가격 추이</div>
                                                        <div className="text-xs text-muted-foreground">마우스오버로 상세 확인</div>
                                                    </div>
                                                    {/* Enhanced Arrow */}
                                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-popover"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
