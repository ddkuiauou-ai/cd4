import Link from "next/link";
import { getRankNeighbors } from "@/lib/ranking-view";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { getSecurityMetricNeighbors } from "@/lib/data/security-ranking-detail";

interface SecurityPagerProps {
  rank: number;
  currentSecurityId?: string;
  rankDate?: string | null;
}

export async function SecMarketcapPager({ rank, currentSecurityId, rankDate }: SecurityPagerProps) {
  const data = (await getSecurityMetricNeighbors(rank, "marketcap", rankDate)).map(item => ({ ...item, marketcapRank: item.currentRank }));
  const { prev, next } = getPagerSecMarketcaps(data.filter(item => item.securityId !== currentSecurityId && item.exchange && item.ticker), rank);

  if (!prev && !next) {
    return null;
  }

  const createPageURL = (exchange: string, ticker: string) => {
    return `/security/${exchange}.${ticker}/marketcap`;
  };

  return (
    <div className="mt-8 flex flex-row items-center justify-between">
      {prev && (
        <Link
          href={createPageURL(prev.exchange, prev.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "h-14 px-4 py-3")}
        >
          <ChevronLeftIcon className="mr-3 h-5 w-5" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">이전 종목</span>
            <span className="text-sm font-medium">{prev.korName || prev.name}</span>
            {prev.type && (
              <span className="text-xs text-muted-foreground">{prev.type}</span>
            )}
          </div>
        </Link>
      )}
      {next && (
        <Link
          href={createPageURL(next.exchange, next.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "ml-auto h-14 px-4 py-3")}
        >
          <div className="flex flex-col items-end gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">다음 종목</span>
            <span className="text-sm font-medium">{next.korName || next.name}</span>
            {next.type && (
              <span className="text-xs text-muted-foreground">{next.type}</span>
            )}
          </div>
          <ChevronRightIcon className="ml-3 h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

interface SecMarketcapItem {
  securityId: string;
  name: string;
  korName: string | null;
  exchange: string;
  ticker: string;
  type: string | null;
  companyId: string | null;
  marketcapRank: number | null;
}

function getPagerSecMarketcaps(items: SecMarketcapItem[], rank: number) {
    return getRankNeighbors(items, rank, item => item.marketcapRank);
}

export async function SecPerPager({ rank, currentSecurityId, rankDate }: SecurityPagerProps) {
  const data = (await getSecurityMetricNeighbors(rank, "per", rankDate)).map(item => ({ ...item, perRank: item.currentRank }));
  const { prev, next } = getPagerSecPers(data.filter(item => item.securityId !== currentSecurityId && item.exchange && item.ticker), rank);

  if (!prev && !next) {
    return null;
  }

  const createPageURL = (exchange: string, ticker: string) => {
    return `/security/${exchange}.${ticker}/per`;
  };

  return (
    <div className="mt-8 flex flex-row items-center justify-between">
      {prev && (
        <Link
          href={createPageURL(prev.exchange, prev.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "h-14 px-4 py-3")}
        >
          <ChevronLeftIcon className="mr-3 h-5 w-5" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">이전 종목</span>
            <span className="text-sm font-medium">{prev.korName || prev.name}</span>
            {prev.type && (
              <span className="text-xs text-muted-foreground">{prev.type}</span>
            )}
          </div>
        </Link>
      )}
      {next && (
        <Link
          href={createPageURL(next.exchange, next.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "ml-auto h-14 px-4 py-3")}
        >
          <div className="flex flex-col items-end gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">다음 종목</span>
            <span className="text-sm font-medium">{next.korName || next.name}</span>
            {next.type && (
              <span className="text-xs text-muted-foreground">{next.type}</span>
            )}
          </div>
          <ChevronRightIcon className="ml-3 h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

interface SecPerItem {
  securityId: string;
  name: string;
  korName: string | null;
  exchange: string;
  ticker: string;
  type: string | null;
  companyId: string | null;
  perRank: number | null;
}

function getPagerSecPers(items: SecPerItem[], rank: number) {
    return getRankNeighbors(items, rank, item => item.perRank);
}

export async function SecPbrPager({ rank, currentSecurityId, rankDate }: SecurityPagerProps) {
  const data = (await getSecurityMetricNeighbors(rank, "pbr", rankDate)).map(item => ({ ...item, pbrRank: item.currentRank }));
  const { prev, next } = getPagerSecPbrs(data.filter(item => item.securityId !== currentSecurityId && item.exchange && item.ticker), rank);

  if (!prev && !next) {
    return null;
  }

  const createPageURL = (exchange: string, ticker: string) => {
    return `/security/${exchange}.${ticker}/pbr`;
  };

  return (
    <div className="mt-8 flex flex-row items-center justify-between">
      {prev && (
        <Link
          href={createPageURL(prev.exchange, prev.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "h-14 px-4 py-3")}
        >
          <ChevronLeftIcon className="mr-3 h-5 w-5" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">이전 종목</span>
            <span className="text-sm font-medium">{prev.korName || prev.name}</span>
            {prev.type && (
              <span className="text-xs text-muted-foreground">{prev.type}</span>
            )}
          </div>
        </Link>
      )}
      {next && (
        <Link
          href={createPageURL(next.exchange, next.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "ml-auto h-14 px-4 py-3")}
        >
          <div className="flex flex-col items-end gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">다음 종목</span>
            <span className="text-sm font-medium">{next.korName || next.name}</span>
            {next.type && (
              <span className="text-xs text-muted-foreground">{next.type}</span>
            )}
          </div>
          <ChevronRightIcon className="ml-3 h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

export async function SecDivPager({ rank, currentSecurityId, rankDate }: SecurityPagerProps) {
  const data = (await getSecurityMetricNeighbors(rank, "div", rankDate)).map(item => ({ ...item, divRank: item.currentRank }));
  const { prev, next } = getPagerSecDivs(data.filter(item => item.securityId !== currentSecurityId && item.exchange && item.ticker), rank);

  if (!prev && !next) {
    return null;
  }

  const createPageURL = (exchange: string, ticker: string) => {
    return `/security/${exchange}.${ticker}/div`;
  };

  return (
    <div className="mt-8 flex flex-row items-center justify-between">
      {prev && (
        <Link
          href={createPageURL(prev.exchange, prev.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "h-14 px-4 py-3")}
        >
          <ChevronLeftIcon className="mr-3 h-5 w-5" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">이전 종목</span>
            <span className="text-sm font-medium">{prev.korName || prev.name}</span>
            {prev.type && (
              <span className="text-xs text-muted-foreground">{prev.type}</span>
            )}
          </div>
        </Link>
      )}
      {next && (
        <Link
          href={createPageURL(next.exchange, next.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "ml-auto h-14 px-4 py-3")}
        >
          <div className="flex flex-col items-end gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">다음 종목</span>
            <span className="text-sm font-medium">{next.korName || next.name}</span>
            {next.type && (
              <span className="text-xs text-muted-foreground">{next.type}</span>
            )}
          </div>
          <ChevronRightIcon className="ml-3 h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

export async function SecEpsPager({ rank, currentSecurityId, rankDate }: SecurityPagerProps) {
  const data = (await getSecurityMetricNeighbors(rank, "eps", rankDate)).map(item => ({ ...item, epsRank: item.currentRank }));
  const { prev, next } = getPagerSecEpss(data.filter(item => item.securityId !== currentSecurityId && item.exchange && item.ticker), rank);

  if (!prev && !next) {
    return null;
  }

  const createPageURL = (exchange: string, ticker: string) => {
    return `/security/${exchange}.${ticker}/eps`;
  };

  return (
    <div className="mt-8 flex flex-row items-center justify-between">
      {prev && (
        <Link
          href={createPageURL(prev.exchange, prev.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "h-14 px-4 py-3")}
        >
          <ChevronLeftIcon className="mr-3 h-5 w-5" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">이전 종목</span>
            <span className="text-sm font-medium">{prev.korName || prev.name}</span>
            {prev.type && (
              <span className="text-xs text-muted-foreground">{prev.type}</span>
            )}
          </div>
        </Link>
      )}
      {next && (
        <Link
          href={createPageURL(next.exchange, next.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "ml-auto h-14 px-4 py-3")}
        >
          <div className="flex flex-col items-end gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">다음 종목</span>
            <span className="text-sm font-medium">{next.korName || next.name}</span>
            {next.type && (
              <span className="text-xs text-muted-foreground">{next.type}</span>
            )}
          </div>
          <ChevronRightIcon className="ml-3 h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

export async function SecDpsPager({ rank, currentSecurityId, rankDate }: SecurityPagerProps) {
  const data = (await getSecurityMetricNeighbors(rank, "dps", rankDate)).map(item => ({ ...item, dpsRank: item.currentRank }));
  const { prev, next } = getPagerSecDpss(data.filter(item => item.securityId !== currentSecurityId && item.exchange && item.ticker), rank);

  if (!prev && !next) {
    return null;
  }

  const createPageURL = (exchange: string, ticker: string) => {
    return `/security/${exchange}.${ticker}/dps`;
  };

  return (
    <div className="mt-8 flex flex-row items-center justify-between">
      {prev && (
        <Link
          href={createPageURL(prev.exchange, prev.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "h-14 px-4 py-3")}
        >
          <ChevronLeftIcon className="mr-3 h-5 w-5" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">이전 종목</span>
            <span className="text-sm font-medium">{prev.korName || prev.name}</span>
            {prev.type && (
              <span className="text-xs text-muted-foreground">{prev.type}</span>
            )}
          </div>
        </Link>
      )}
      {next && (
        <Link
          href={createPageURL(next.exchange, next.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "ml-auto h-14 px-4 py-3")}
        >
          <div className="flex flex-col items-end gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">다음 종목</span>
            <span className="text-sm font-medium">{next.korName || next.name}</span>
            {next.type && (
              <span className="text-xs text-muted-foreground">{next.type}</span>
            )}
          </div>
          <ChevronRightIcon className="ml-3 h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

export async function SecBpsPager({ rank, currentSecurityId, rankDate }: SecurityPagerProps) {
  const data = (await getSecurityMetricNeighbors(rank, "bps", rankDate)).map(item => ({ ...item, bpsRank: item.currentRank }));
  const { prev, next } = getPagerSecBpss(data.filter(item => item.securityId !== currentSecurityId && item.exchange && item.ticker), rank);

  if (!prev && !next) {
    return null;
  }

  const createPageURL = (exchange: string, ticker: string) => {
    return `/security/${exchange}.${ticker}/bps`;
  };

  return (
    <div className="mt-8 flex flex-row items-center justify-between">
      {prev && (
        <Link
          href={createPageURL(prev.exchange, prev.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "h-14 px-4 py-3")}
        >
          <ChevronLeftIcon className="mr-3 h-5 w-5" />
          <div className="flex flex-col items-start gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">이전 종목</span>
            <span className="text-sm font-medium">{prev.korName || prev.name}</span>
            {prev.type && (
              <span className="text-xs text-muted-foreground">{prev.type}</span>
            )}
          </div>
        </Link>
      )}
      {next && (
        <Link
          href={createPageURL(next.exchange, next.ticker)}
          className={cn(buttonVariants({ variant: "outline" }), "ml-auto h-14 px-4 py-3")}
        >
          <div className="flex flex-col items-end gap-0.5">
            <span className="hidden sm:flex text-xs text-muted-foreground">다음 종목</span>
            <span className="text-sm font-medium">{next.korName || next.name}</span>
            {next.type && (
              <span className="text-xs text-muted-foreground">{next.type}</span>
            )}
          </div>
          <ChevronRightIcon className="ml-3 h-5 w-5" />
        </Link>
      )}
    </div>
  );
}

interface SecPbrItem {
  securityId: string;
  name: string;
  korName: string | null;
  exchange: string;
  ticker: string;
  type: string | null;
  companyId: string | null;
  pbrRank: number | null;
}

interface SecDivItem {
  securityId: string;
  name: string;
  korName: string | null;
  exchange: string;
  ticker: string;
  type: string | null;
  companyId: string | null;
  divRank: number | null;
}

interface SecEpsItem {
  securityId: string;
  name: string;
  korName: string | null;
  exchange: string;
  ticker: string;
  type: string | null;
  companyId: string | null;
  epsRank: number | null;
}

interface SecDpsItem {
  securityId: string;
  name: string;
  korName: string | null;
  exchange: string;
  ticker: string;
  type: string | null;
  companyId: string | null;
  dpsRank: number | null;
}

interface SecBpsItem {
  securityId: string;
  name: string;
  korName: string | null;
  exchange: string;
  ticker: string;
  type: string | null;
  companyId: string | null;
  bpsRank: number | null;
}

function getPagerSecPbrs(items: SecPbrItem[], rank: number) {
    return getRankNeighbors(items, rank, item => item.pbrRank);
}

function getPagerSecDivs(items: SecDivItem[], rank: number) {
    return getRankNeighbors(items, rank, item => item.divRank);
}

function getPagerSecEpss(items: SecEpsItem[], rank: number) {
    return getRankNeighbors(items, rank, item => item.epsRank);
}

function getPagerSecDpss(items: SecDpsItem[], rank: number) {
    return getRankNeighbors(items, rank, item => item.dpsRank);
}

function getPagerSecBpss(items: SecBpsItem[], rank: number) {
    return getRankNeighbors(items, rank, item => item.bpsRank);
}
