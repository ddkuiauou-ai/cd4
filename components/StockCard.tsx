'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface StockCardProps {
    security: {
        securityId: string;
        name: string;
        korName: string;
        exchange: string;
        type?: string | null;
    };
    price: {
        close: number;
        rate: number | null;
        date?: Date;
    };
    marketcap?: number | null;
    rank?: number | null;
    className?: string;
    href?: string;
}

/**
 * StockCard component displays a summary of a stock in a compact card format
 * Following CD3 mobile-first and minimalist design principles
 */
function StockCard({
    security,
    price,
    marketcap,
    rank,
    className,
    href,
}: StockCardProps) {
    // Determine CSS classes based on price change direction
    const priceChangeClass = price.rate
        ? price.rate > 0
            ? "text-success"
            : price.rate < 0
                ? "text-danger"
                : ""
        : "";

    // Choose icon based on price change direction
    const PriceIcon = price.rate
        ? price.rate > 0
            ? TrendingUp
            : price.rate < 0
                ? TrendingDown
                : Minus
        : Minus;

    return (
        <Link
            href={href || `/securities/${security.securityId}`}
            className="block transition-transform hover:scale-[1.02]"
        >
            <Card className={cn("overflow-hidden", className)}>
                <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h3 className="font-semibold line-clamp-1">{security.korName}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Badge
                                    variant="outline"
                                    className="h-5 px-1.5 text-[10px] font-normal"
                                >
                                    {security.exchange}
                                </Badge>
                                <span className="line-clamp-1">{security.name}</span>
                            </div>
                        </div>
                        {rank && (
                            <Badge variant="secondary" className="text-xs">
                                #{rank}
                            </Badge>
                        )}
                    </div>

                    <hr className="my-3 border-border/40" />

                    <div className="flex items-end justify-between">
                        <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">현재가</p>
                            <p className="text-xl font-bold">{formatNumber(price.close, "원")}</p>
                        </div>
                        <div className="flex flex-col items-end">
                            <div className={cn("flex items-center gap-1", priceChangeClass)}>
                                <PriceIcon className="h-3.5 w-3.5" />
                                <span className="font-medium">
                                    {price.rate
                                        ? price.rate > 0
                                            ? `+${formatNumber(price.rate, "%")}`
                                            : formatNumber(price.rate, "%")
                                        : "0%"}
                                </span>
                            </div>
                            {marketcap && (
                                <span className="text-xs text-muted-foreground">
                                    {formatNumber(marketcap, "억원")}
                                </span>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

export default StockCard;
