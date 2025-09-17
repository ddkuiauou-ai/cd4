'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from 'react';
import SearchBar from './SearchBar';
import MarketSummary from './MarketSummary';
import MarketTrends from './MarketTrends';
import NetworkStatus from './NetworkStatus';
import StockCard from './StockCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface DashboardProps {
    marketData: any[];
    trendingStocks: {
        gainers: any[];
        losers: any[];
        volume: any[];
    };
    watchlist?: any[];
    recommendations?: any[];
    className?: string;
}

/**
 * Dashboard component showcasing market overview and key stocks
 * Built according to CD3 design philosophy (mobile-first, dark mode)
 */
function Dashboard({
    marketData = [],
    trendingStocks,
    watchlist = [],
    recommendations = [],
    className
}: DashboardProps) {
    // Get current date/time in Korean format
    const now = new Date();
    const formattedDateTime = new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(now);

    return (
        <div className={cn("space-y-8", className)}>
            {/* Search and welcome section */}
            <section className="text-center space-y-6 py-4">
                <div className="flex items-center justify-center">
                    <NetworkStatus
                        status="connected"
                        lastUpdated={formattedDateTime}
                    />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                    실시간 주식 정보 서비스
                </h1>
                <p className="text-muted-foreground max-w-md mx-auto">
                    한국 및 전세계 주식 시장 정보를 실시간으로 확인하세요
                </p>
                <div className="flex justify-center">
                    <SearchBar className="max-w-md w-full" />
                </div>
            </section>

            {/* Market summary */}
            <MarketSummary markets={marketData} />

            {/* Main content grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Market trends */}
                <div className="lg:col-span-1">
                    <MarketTrends
                        gainers={trendingStocks.gainers}
                        losers={trendingStocks.losers}
                        volume={trendingStocks.volume}
                        date="24시간"
                    />
                </div>

                {/* Watchlist and recommendations */}
                <div className="lg:col-span-2">
                    <Card className="border-border/30">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl flex items-center justify-between">
                                <span>관심 종목 & 추천</span>
                                <Button variant="ghost" size="sm" asChild className="h-8 gap-1">
                                    <Link href="/screener">
                                        더보기
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    </Link>
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="watchlist">
                                <TabsList className="w-full grid grid-cols-2 mb-4">
                                    <TabsTrigger value="watchlist">관심 종목</TabsTrigger>
                                    <TabsTrigger value="recommendations">추천 주식</TabsTrigger>
                                </TabsList>

                                <TabsContent value="watchlist" className="mt-0 space-y-4">
                                    {watchlist.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {watchlist.slice(0, 4).map((stock) => (
                                                <StockCard
                                                    key={stock.security.securityId}
                                                    security={stock.security}
                                                    price={stock.price}
                                                    marketcap={stock.marketcap}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <p className="text-muted-foreground mb-3">관심 종목이 없습니다</p>
                                            <Button asChild>
                                                <Link href="/screener">종목 추가하기</Link>
                                            </Button>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="recommendations" className="mt-0 space-y-4">
                                    {recommendations.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {recommendations.slice(0, 4).map((stock) => (
                                                <StockCard
                                                    key={stock.security.securityId}
                                                    security={stock.security}
                                                    price={stock.price}
                                                    marketcap={stock.marketcap}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <p className="text-muted-foreground">추천 종목을 로드하는 중...</p>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
