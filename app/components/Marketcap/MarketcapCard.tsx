import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import { Security } from "@/typings";
import Rate from "@/app/components/Rate";
import Link from "next/link";
import { cn } from "@/lib/utils";

function MarketcapCard({
    security,
    name,
    href,
}: {
    security: Security;
    name?: string;
    href?: string;
}) {
    return (
        <Card
            key={security.securityId}
            className={cn("sm:hover:scale-110 sm:transform sm:transition", {
                "bg-primary-foreground dark:bg-secondary text-primary-background":
                    security.name === name,
            })}
        >
            <Link
                href={
                    href ? `${href}${security.name}` : `/sec/marketcap/${security.name}`
                }
                passHref
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        {security.type}
                        <span className="text-muted-foreground"> {security.korName}</span>
                    </CardTitle>
                    {security.prices && security.prices[0] && (
                        <div className="flex items-center space-x-1">
                            <span className="text-sm">
                                {security.prices[0].close.toLocaleString()}원
                                <span className="text-sm">
                                    <Rate
                                        rate={security.prices[0].rate ?? 0}
                                    />
                                </span>
                            </span>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {formatNumber(security.marketcap)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {formatNumber(security.shares)}주
                    </p>
                </CardContent>
            </Link>
        </Card>
    );
}

export default MarketcapCard;
