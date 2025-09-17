'use client';

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface StockInfoProps {
    security: {
        securityId: string;
        name: string;
        korName: string;
        exchange: string;
        type?: string | null;
        price?: number;
        priceDate?: Date | null;
        marketcap?: number | null;
        marketcapRank?: number | null;
        per?: number | null;
        pbr?: number | null;
        eps?: number | null;
        bps?: number | null;
        div?: number | null;
        dps?: number | null;
        shares?: number | null;
    };
    latestPrice?: {
        open: number;
        high?: number;
        low?: number;
        close: number;
        rate?: number | null;
        volume?: number | null;
        date: Date;
    } | null;
    className?: string;
}

/**
 * StockInfo component displays detailed information about a stock
 * Following CD3 design philosophy for mobile-first, dark-mode optimized display
 */
function StockInfo({ security, latestPrice, className }: StockInfoProps) {
    return (
        <Card className={cn("w-full", className)}>
            <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <CardTitle className="text-xl font-bold">
                            {security.korName}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                            <span>{security.name}</span>
                            <Badge variant="outline">{security.exchange}</Badge>
                            {security.type && <Badge variant="secondary">{security.type}</Badge>}
                        </CardDescription>
                    </div>

                    {latestPrice && (
                        <div className="text-right">
                            <div className="text-2xl font-bold">
                                {formatNumber(latestPrice.close, '원')}
                            </div>
                            {latestPrice.rate && (
                                <div className={cn(
                                    "text-sm font-medium",
                                    latestPrice.rate > 0 ? "text-success" :
                                        latestPrice.rate < 0 ? "text-danger" : ""
                                )}>
                                    {latestPrice.rate > 0 && '+'}
                                    {formatNumber(latestPrice.rate, '%')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </CardHeader>

            <CardContent>
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell className="font-medium py-2">시가총액</TableCell>
                            <TableCell className="text-right py-2">
                                {security.marketcap ? formatNumber(security.marketcap, '억원') : '-'}
                            </TableCell>
                            <TableCell className="font-medium py-2">순위</TableCell>
                            <TableCell className="text-right py-2">
                                {security.marketcapRank || '-'}
                            </TableCell>
                        </TableRow>

                        <TableRow>
                            <TableCell className="font-medium py-2">PER</TableCell>
                            <TableCell className="text-right py-2">
                                {security.per ? formatNumber(security.per, '배') : '-'}
                            </TableCell>
                            <TableCell className="font-medium py-2">PBR</TableCell>
                            <TableCell className="text-right py-2">
                                {security.pbr ? formatNumber(security.pbr, '배') : '-'}
                            </TableCell>
                        </TableRow>

                        <TableRow>
                            <TableCell className="font-medium py-2">EPS</TableCell>
                            <TableCell className="text-right py-2">
                                {security.eps ? formatNumber(security.eps, '원') : '-'}
                            </TableCell>
                            <TableCell className="font-medium py-2">BPS</TableCell>
                            <TableCell className="text-right py-2">
                                {security.bps ? formatNumber(security.bps, '원') : '-'}
                            </TableCell>
                        </TableRow>

                        <TableRow>
                            <TableCell className="font-medium py-2">배당금</TableCell>
                            <TableCell className="text-right py-2">
                                {security.dps ? formatNumber(security.dps, '원') : '-'}
                            </TableCell>
                            <TableCell className="font-medium py-2">배당률</TableCell>
                            <TableCell className="text-right py-2">
                                {security.div ? formatNumber(security.div, '%') : '-'}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>

            {latestPrice && (
                <CardFooter className="border-t pt-3">
                    <div className="grid w-full grid-cols-4 gap-2 text-center text-sm">
                        <div>
                            <p className="text-muted-foreground">시가</p>
                            <p className="font-medium">{formatNumber(latestPrice.open, '원')}</p>
                        </div>
                        {latestPrice.high !== undefined && (
                            <div>
                                <p className="text-muted-foreground">고가</p>
                                <p className="font-medium">{formatNumber(latestPrice.high, '원')}</p>
                            </div>
                        )}
                        {latestPrice.low !== undefined && (
                            <div>
                                <p className="text-muted-foreground">저가</p>
                                <p className="font-medium">{formatNumber(latestPrice.low, '원')}</p>
                            </div>
                        )}
                        {latestPrice.volume !== undefined && (
                            <div>
                                <p className="text-muted-foreground">거래량</p>
                                <p className="font-medium">{formatNumber(latestPrice.volume)}</p>
                            </div>
                        )}
                    </div>
                </CardFooter>
            )}
        </Card>
    );
}

export default StockInfo;
