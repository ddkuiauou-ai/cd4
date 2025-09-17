import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import CompanyLogo from "@/components/CompanyLogo";
import Exchange from "@/components/exchange";
import Rate from "@/components/rate";
import SpikeChart from "@/components/spike-chart";
import { formatNumber } from "@/lib/utils";
import { Price } from "@/typings";

interface SecurityCardProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any;
    index: number;
    skip: number;
    type: "marketcap" | "bps" | "pbr" | "eps" | "per" | "dps" | "div";
    linkPrefix: string;
    valueFormatter?: (value: number) => string;
    valueLabel: string;
    rankChange?: React.ReactNode;
}

export function SecurityCard({
    item,
    index,
    skip,
    type,
    linkPrefix,
    valueFormatter = formatNumber,
    valueLabel,
    rankChange,
}: SecurityCardProps) {
    // Determine if this is a company or security based on the structure
    const isCompanyData = item.securities && item.securities.length > 0;

    let entity, security, prices, close, rate, rank, name, linkPath, mainValue;

    if (isCompanyData) {
        // Company data (like marketcap)
        entity = item;
        security = item.securities[0];
        prices = security.prices;
        const latestPrice = prices[prices.length - 1] || {};
        close = latestPrice.close;
        rate = latestPrice.rate;
        // isPositive = rate != null && rate > 0;
        rank = item.marketcapRank || index + skip + 1;
        name = item.name;
        linkPath = `${linkPrefix}/${encodeURIComponent(name)}?type=corp`;
        // imageName = name;
        mainValue = type === "marketcap" ? item.marketcap : item[type];
    } else {
        // Security data (like bps, eps, etc.)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        entity = item;
        security = item;
        prices = item.prices;
        const latestPrice = prices[prices.length - 1] || {};
        close = latestPrice.close;
        rate = latestPrice.rate;
        // isPositive = rate != null && rate > 0;
        rank = index + skip + 1;
        name = item.name;

        // Handle new company link format
        if (linkPrefix === "/company" && item.exchange && item.ticker) {
            linkPath = `${linkPrefix}/${item.exchange}.${item.ticker}`;
        } else {
            linkPath = `${linkPrefix}/${encodeURIComponent(item.name)}?type=corp`;
        }

        // imageName = item.type === "우선주" || item.type === "전환우선주"
        //     ? item.company?.name
        //     : item.name;
        mainValue = item[type];
    }

    return (
        <div className="bg-card rounded-xl border shadow-sm p-6 transition-all duration-300 hover:shadow-lg hover:border-primary/30 hover:bg-gradient-to-br hover:from-card hover:to-primary/5">
            {/* Header: Rank, Company Info, Main Value */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Link href={linkPath} className="flex-shrink-0">
                        <CompanyLogo
                            companyName={name}
                            logoUrl={item.company?.logo || item.logo}
                            size={48}
                            className="rounded-full ring-2 ring-primary/10"
                        />
                    </Link>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="text-xs font-semibold">
                                {rank}등
                            </Badge>
                            {rankChange}
                        </div>
                        <Link
                            href={linkPath}
                            className="font-bold text-xl md:text-2xl hover:underline truncate block text-foreground hover:text-primary transition-colors duration-200"
                        >
                            {name}
                        </Link>
                        {/* Enhanced secondary info with better hierarchy */}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground/80 mt-1">
                            <Exchange exchange={item.exchange} />
                            <span>•</span>
                            <span className="font-mono font-medium">{item.ticker}</span>
                        </div>
                    </div>
                </div>

                {/* Enhanced main value display */}
                <div className="text-right flex-shrink-0 ml-4">
                    <div className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wide">{valueLabel}</div>
                    <div className="font-bold text-2xl md:text-3xl mb-3 text-primary tabular-nums">
                        {mainValue != null ? valueFormatter(mainValue) : "—"}
                        {type === 'marketcap' && <span className="text-sm text-muted-foreground font-normal ml-1">억원</span>}
                    </div>
                    {/* Enhanced stock price display */}
                    <div className="text-sm text-muted-foreground mb-2 tabular-nums">
                        현재가: <span className="font-semibold text-foreground">{close?.toLocaleString()}원</span>
                    </div>
                    <Rate rate={rate as number} size="lg" showIcon />
                </div>
            </div>

            {/* Chart Section */}
            <div className="pt-4 border-t border-border/50">
                <div className="text-xs text-muted-foreground mb-3 font-semibold flex items-center justify-between">
                    <span>30일 가격 차트</span>
                    <span className="bg-muted/50 px-2 py-1 rounded-md">최근 30일</span>
                </div>
                <div className="rounded-lg overflow-hidden border-2 border-muted/30 bg-gradient-to-br from-background to-muted/20 p-2 transition-all duration-300 hover:border-primary/30 hover:shadow-md">
                    <SpikeChart
                        prices={prices as Price[]}
                        width={300}
                        height={70}
                    />
                </div>
            </div>
        </div>
    );
}
