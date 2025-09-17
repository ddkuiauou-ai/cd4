'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import { TrendingDown, TrendingUp, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface MarketData {
    name: string;  // e.g. "KOSPI", "KOSDAQ", etc.
    currentValue: number;
    previousClose: number;
    change: number;
    changePercent: number;
    volume?: number;  // Optional trading volume
    date?: string;    // Date of the data
}

interface MarketSummaryProps {
    markets: MarketData[];
    className?: string;
}

/**
 * MarketSummary component displaying key market indices
 * Mobile-first layout with responsive design
 */
function MarketSummary({ markets, className }: MarketSummaryProps) {
    if (!markets || markets.length === 0) {
        return null;
    }

    // Get the date from the first market (assuming all markets have the same date)
    const summaryDate = markets[0]?.date || new Date().toISOString().split('T')[0];

    return (
        <section className={cn("space-y-3", className)}>
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">시장 현황</h2>
                <Badge variant="outline" className="text-xs font-normal">
                    {summaryDate}
                </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {markets.map((market) => {
                    const isPositive = market.changePercent > 0;
                    const isNeutral = market.changePercent === 0;
                    const statusColor = isPositive ? "text-success" : isNeutral ? "text-muted-foreground" : "text-danger";
                    const Icon = isPositive ? TrendingUp : isNeutral ? ArrowRight : TrendingDown;

                    return (
                        <Link
                            key={market.name}
                            href={`/market/${market.name.toLowerCase()}`}
                            className="block transition-transform hover:scale-[1.01]"
                        >
                            <Card className="overflow-hidden border-border/30 hover:border-border/70 transition-colors duration-300">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">{market.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-end justify-between">
                                        <div className="space-y-1">
                                            <p className="text-3xl font-bold">
                                                {formatNumber(market.currentValue, "", 2)}
                                            </p>
                                            <div className={cn("flex items-center gap-1.5", statusColor)}>
                                                <Icon className="h-4 w-4" />
                                                <span className="font-medium">
                                                    {isPositive ? "+" : ""}
                                                    {formatNumber(market.change, "", 2)}
                                                </span>
                                                <span className="font-medium">
                                                    ({isPositive ? "+" : ""}
                                                    {formatNumber(market.changePercent, "%")})
                                                </span>
                                            </div>
                                        </div>

                                        {market.volume && (
                                            <div className="text-right text-sm text-muted-foreground">
                                                <p>거래량</p>
                                                <p className="font-medium">{formatNumber(market.volume, "백만")}</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}

export default MarketSummary;
