import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { getCompanyMarketCapPageData } from "@/lib/data/company";

export async function CompanyMarketcapPager({
    rank,
    currentMarket = "KOSPI"
}: {
    rank: number;
    currentMarket?: string;
}) {
    const data = await getCompanyMarketCapPageData(rank);
    const { prev, next } = getPagerCompanies(data, rank);

    if (!prev && !next) {
        return null;
    }

    const createPageURL = (ticker: string, exchange: string) => {
        // Use the exchange from data, fallback to currentMarket
        const market = exchange || currentMarket;
        return `/company/${market}.${ticker}/marketcap`;
    };

    return (
        <div className="mt-8 flex flex-row items-center justify-between">
            {prev && (
                <Link
                    href={createPageURL(prev.primaryTicker, prev.exchange)}
                    className={buttonVariants({ variant: "outline" })}
                >
                    <ChevronLeftIcon className="mr-2 h-4 w-4" />
                    <div className="flex flex-col items-start">
                        <span className="hidden sm:flex text-xs text-muted-foreground">이전 기업</span>
                        <span className="text-sm font-medium">{prev.korName || prev.name}</span>
                    </div>
                </Link>
            )}
            {next && (
                <Link
                    href={createPageURL(next.primaryTicker, next.exchange)}
                    className={cn(buttonVariants({ variant: "outline" }), "ml-auto")}
                >
                    <div className="flex flex-col items-end">
                        <span className="hidden sm:flex text-xs text-muted-foreground">다음 기업</span>
                        <span className="text-sm font-medium">{next.korName || next.name}</span>
                    </div>
                    <ChevronRightIcon className="ml-2 h-4 w-4" />
                </Link>
            )}
        </div>
    );
}

interface CompanyMarketcapItem {
    companyId: string;
    name: string;
    korName: string | null;
    marketcapRank: number | null;
    primaryTicker: string;
    exchange: string;
}

function getPagerCompanies(items: CompanyMarketcapItem[], rank: number) {
    const sortedItems = items
        .filter((item) => item.marketcapRank !== rank)
        .sort((a, b) => (a.marketcapRank || 0) - (b.marketcapRank || 0));

    const currentIndex = sortedItems.findIndex(
        (item) => (item.marketcapRank || 0) > rank
    );

    const prev = currentIndex > 0 ? sortedItems[currentIndex - 1] : null;
    const next = currentIndex >= 0 ? sortedItems[currentIndex] : null;

    return { prev, next };
}
