'use client';

/* eslint-disable @typescript-eslint/no-unused-vars */
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Link from 'next/link';

interface TrendItem {
    name: string;
    korName: string;
    securityId: string;
    price: number;
    change: number;
    changePercent: number;
}

interface MarketTrendsProps {
    gainers: TrendItem[];
    losers: TrendItem[];
    volume: TrendItem[];
    className?: string;
    date?: string;
}

/**
 * MarketTrends component showing top gainers, losers, and volume movers
 * Implementation follows CD3 design principles with mobile-first, dark mode support
 */
function MarketTrends({
    gainers = [],
    losers = [],
    volume = [],
    className,
    date
}: MarketTrendsProps) {
    // Use useState to store the active tab
    const [activeTab, setActiveTab] = React.useState('gainers');

    // Helper function to format change percentage
    const formatChangePercent = (value: number) => {
        const formatted = Math.abs(value).toFixed(2);
        return value > 0 ? `+${formatted}%` : value < 0 ? `-${formatted}%` : '0.00%';
    };

    // Generate rows for each tab
    const renderTrendRows = (items: TrendItem[], showPositive: boolean | null = null) => {
        return items.slice(0, 5).map((item, index) => {
            const isPositive = item.changePercent > 0;
            const displayPositive = showPositive === null ? isPositive : showPositive;
            const statusColor = displayPositive ? 'text-success' : 'text-danger';
            const Icon = displayPositive ? TrendingUp : TrendingDown;

            return (
                <Link
                    key={item.securityId}
                    href={`/securities/${item.securityId}`}
                    className="block hover:bg-muted/30 transition-colors rounded-md"
                >
                    <div className="flex items-center justify-between py-2 px-1">
                        <div className="flex-1">
                            <div className="line-clamp-1 font-medium">{item.korName}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">{item.name}</div>
                        </div>
                        <div className="text-right space-y-1 min-w-20">
                            <div className="font-semibold">{item.price?.toLocaleString()}원</div>
                            <div className={cn("flex items-center justify-end gap-1", statusColor)}>
                                <Icon className="h-3 w-3" />
                                <span className="text-xs">{formatChangePercent(item.changePercent)}</span>
                            </div>
                        </div>
                    </div>
                </Link>
            );
        });
    };

    return (
        <Card className={cn("border-border/30", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">시장 트렌드</CardTitle>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="rounded-full bg-muted/50 p-1.5 cursor-help">
                                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p className="text-xs">최근 {date || '오늘'} 기준</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Tabs defaultValue="gainers" value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-full mb-4 grid grid-cols-3">
                        <TabsTrigger value="gainers" className="text-sm">상승</TabsTrigger>
                        <TabsTrigger value="losers" className="text-sm">하락</TabsTrigger>
                        <TabsTrigger value="volume" className="text-sm">거래량</TabsTrigger>
                    </TabsList>

                    <div className="px-4 pb-4">
                        <TabsContent value="gainers" className="mt-0 space-y-1">
                            {renderTrendRows(gainers, true)}
                            <Link
                                href="/screener?sort=changeDesc"
                                className="block text-center text-xs text-primary hover:underline mt-4"
                            >
                                모든 상승 종목 보기
                            </Link>
                        </TabsContent>

                        <TabsContent value="losers" className="mt-0 space-y-1">
                            {renderTrendRows(losers, false)}
                            <Link
                                href="/screener?sort=changeAsc"
                                className="block text-center text-xs text-primary hover:underline mt-4"
                            >
                                모든 하락 종목 보기
                            </Link>
                        </TabsContent>

                        <TabsContent value="volume" className="mt-0 space-y-1">
                            {renderTrendRows(volume)}
                            <Link
                                href="/screener?sort=volumeDesc"
                                className="block text-center text-xs text-primary hover:underline mt-4"
                            >
                                모든 거래량 종목 보기
                            </Link>
                        </TabsContent>
                    </div>
                </Tabs>
            </CardContent>
        </Card>
    );
}

export default MarketTrends;
