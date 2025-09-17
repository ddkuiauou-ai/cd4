import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { getSecurityMarketCapPageData } from "@/lib/data/security";

export async function SecMarketcapPager({ rank }: { rank: number }) {
  const data = await getSecurityMarketCapPageData(rank);
  const { prev, next } = getPagerSecMarketcaps(data, rank);

  if (!prev && !next) {
    return null;
  }

  const createPageURL = (name: string) => `/sec/marketcap/${name}`;

  return (
    <div className="mt-8 flex flex-row items-center justify-between">
      {prev && (
        <Link
          href={createPageURL(prev.korName)}
          className={buttonVariants({ variant: "outline" })}
        >
          <span className="mr-2 text-muted-foreground">{prev.korName}</span>
          <ChevronLeftIcon className="mr-2 h-4 w-4" />
          <span className="hidden sm:flex">이전 종목</span>
        </Link>
      )}
      {next && (
        <Link
          href={createPageURL(next.korName)}
          className={cn(buttonVariants({ variant: "outline" }), "ml-auto")}
        >
          <span className="hidden sm:flex">다음 종목</span>
          <ChevronRightIcon className="ml-2 h-4 w-4" />
          <span className="ml-2 text-muted-foreground">{next.korName}</span>
        </Link>
      )}
    </div>
  );
}

interface SecMarketcapItem {
  name: string;
  korName: string;
  marketcapRank: number | null;
  [key: string]: string | number | boolean | null | undefined;
}

function getPagerSecMarketcaps(items: SecMarketcapItem[], rank: number) {
  const sortedItems = items
    .filter((item) => item.marketcapRank !== null && item.marketcapRank !== rank)
    .sort((a, b) => (a.marketcapRank || 0) - (b.marketcapRank || 0));
  const currentIndex = sortedItems.findIndex(
    (item) => (item.marketcapRank || 0) > rank
  );

  const prev = sortedItems[currentIndex - 1] || null;
  const next = sortedItems[currentIndex] || null;

  return { prev, next };
}
