'use client';

import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface SecurityCompareData {
    securityId: string;
    name: string;
    korName: string;
    exchange: string;
    type?: string | null;
    price?: number | null;
    marketcap?: number | null;
    marketcapRank?: number | null;
    per?: number | null;
    pbr?: number | null;
    eps?: number | null;
    bps?: number | null;
    div?: number | null;
    dps?: number | null;
    rate?: number | null;
}

interface SecurityCompareTableProps {
    title?: string;
    caption?: string;
    securities: SecurityCompareData[];
    sortBy?: keyof SecurityCompareData;
    sortOrder?: 'asc' | 'desc';
    onRowClick?: (securityId: string) => void;
    className?: string;
}

/**
 * SecurityCompareTable component displays a comparison of multiple securities
 * Following CD3 mobile-first design principles with customized sorting
 */
function SecurityCompareTable({
    title,
    caption,
    securities,
    sortBy = 'marketcapRank',
    sortOrder = 'asc',
    onRowClick,
    className,
}: SecurityCompareTableProps) {
    const router = useRouter();

    // Sort securities based on the provided sort field and direction
    const sortedSecurities = [...securities].sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];

        // Handle null/undefined values
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        // Sort numbers
        if (typeof aValue === 'number' && typeof bValue === 'number') {
            return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        }

        // Sort strings
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortOrder === 'asc' ?
                aValue.localeCompare(bValue) :
                bValue.localeCompare(aValue);
        }

        return 0;
    });

    // Handle row click - either use provided handler or navigate to security detail page
    const handleRowClick = (securityId: string) => {
        if (onRowClick) {
            onRowClick(securityId);
        } else {
            router.push(`/securities/${securityId}`);
        }
    };

    return (
        <div className={cn("w-full overflow-auto", className)}>
            {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
            <Table>
                {caption && <TableCaption>{caption}</TableCaption>}
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-12 text-center">순위</TableHead>
                        <TableHead>종목</TableHead>
                        <TableHead className="text-right">현재가</TableHead>
                        <TableHead className="text-right">등락률</TableHead>
                        <TableHead className="text-right">시가총액</TableHead>
                        <TableHead className="text-right">PER</TableHead>
                        <TableHead className="text-right">PBR</TableHead>
                        <TableHead className="text-right">배당률</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedSecurities.map((security) => (
                        <TableRow
                            key={security.securityId}
                            className="cursor-pointer transition-colors hover:bg-muted/50"
                            onClick={() => handleRowClick(security.securityId)}
                        >
                            <TableCell className="text-center font-medium">
                                {security.marketcapRank || '-'}
                            </TableCell>
                            <TableCell>
                                <div className="font-medium">{security.korName}</div>
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Badge variant="outline" className="h-5 text-xs">
                                        {security.exchange}
                                    </Badge>
                                    {security.type && (
                                        <span className="text-xs">{security.type}</span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                                {security.price ? formatNumber(security.price) : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                                {security.rate !== null && security.rate !== undefined ? (
                                    <span className={cn(
                                        security.rate > 0 ? "text-success" :
                                            security.rate < 0 ? "text-danger" : ""
                                    )}>
                                        {security.rate > 0 && '+'}
                                        {formatNumber(security.rate, '%')}
                                    </span>
                                ) : (
                                    '-'
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                {security.marketcap ? formatNumber(security.marketcap, '억원') : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                                {security.per ? formatNumber(security.per, '배') : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                                {security.pbr ? formatNumber(security.pbr, '배') : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                                {security.div ? formatNumber(security.div, '%') : '-'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export default SecurityCompareTable;
