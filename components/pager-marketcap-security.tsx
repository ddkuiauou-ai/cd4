import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  getSecurityMarketCapPageData,
  getSecurityPerPageData,
  getSecurityPbrPageData,
  getSecurityDivPageData,
  getSecurityEpsPageData,
  getSecurityDpsPageData,
  getSecurityBpsPageData,
} from "@/lib/data/security";

export async function SecMarketcapPager({ rank }: { rank: number }) {
  const data = await getSecurityMarketCapPageData(rank);
  const { prev, next } = getPagerSecMarketcaps(data, rank);

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

export async function SecPerPager({ rank }: { rank: number }) {
  const data = await getSecurityPerPageData(rank);
  const { prev, next } = getPagerSecPers(data, rank);

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
  perRank: number;
}

function getPagerSecPers(items: SecPerItem[], rank: number) {
  const sortedItems = items
    .filter((item) => item.perRank !== rank)
    .sort((a, b) => a.perRank - b.perRank);

  const currentIndex = sortedItems.findIndex(
    (item) => item.perRank > rank
  );

  const prev = currentIndex > 0 ? sortedItems[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? sortedItems[currentIndex] : null;

  return { prev, next };
}

export async function SecPbrPager({ rank }: { rank: number }) {
  const data = await getSecurityPbrPageData(rank);
  const { prev, next } = getPagerSecPbrs(data, rank);

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

export async function SecDivPager({ rank }: { rank: number }) {
  const data = await getSecurityDivPageData(rank);
  const { prev, next } = getPagerSecDivs(data, rank);

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

export async function SecEpsPager({ rank }: { rank: number }) {
  const data = await getSecurityEpsPageData(rank);
  const { prev, next } = getPagerSecEpss(data, rank);

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

export async function SecDpsPager({ rank }: { rank: number }) {
  const data = await getSecurityDpsPageData(rank);
  const { prev, next } = getPagerSecDpss(data, rank);

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

export async function SecBpsPager({ rank }: { rank: number }) {
  const data = await getSecurityBpsPageData(rank);
  const { prev, next } = getPagerSecBpss(data, rank);

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
  pbrRank: number;
}

interface SecDivItem {
  securityId: string;
  name: string;
  korName: string | null;
  exchange: string;
  ticker: string;
  type: string | null;
  companyId: string | null;
  divRank: number;
}

interface SecEpsItem {
  securityId: string;
  name: string;
  korName: string | null;
  exchange: string;
  ticker: string;
  type: string | null;
  companyId: string | null;
  epsRank: number;
}

interface SecDpsItem {
  securityId: string;
  name: string;
  korName: string | null;
  exchange: string;
  ticker: string;
  type: string | null;
  companyId: string | null;
  dpsRank: number;
}

interface SecBpsItem {
  securityId: string;
  name: string;
  korName: string | null;
  exchange: string;
  ticker: string;
  type: string | null;
  companyId: string | null;
  bpsRank: number;
}

function getPagerSecPbrs(items: SecPbrItem[], rank: number) {
  const sortedItems = items
    .filter((item) => item.pbrRank !== rank)
    .sort((a, b) => a.pbrRank - b.pbrRank);

  const currentIndex = sortedItems.findIndex(
    (item) => item.pbrRank > rank
  );

  const prev = currentIndex > 0 ? sortedItems[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? sortedItems[currentIndex] : null;

  return { prev, next };
}

function getPagerSecDivs(items: SecDivItem[], rank: number) {
  const sortedItems = items
    .filter((item) => item.divRank !== rank)
    .sort((a, b) => a.divRank - b.divRank);

  const currentIndex = sortedItems.findIndex(
    (item) => item.divRank > rank
  );

  const prev = currentIndex > 0 ? sortedItems[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? sortedItems[currentIndex] : null;

  return { prev, next };
}

function getPagerSecEpss(items: SecEpsItem[], rank: number) {
  const sortedItems = items
    .filter((item) => item.epsRank !== rank)
    .sort((a, b) => a.epsRank - b.epsRank);

  const currentIndex = sortedItems.findIndex(
    (item) => item.epsRank > rank
  );

  const prev = currentIndex > 0 ? sortedItems[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? sortedItems[currentIndex] : null;

  return { prev, next };
}

function getPagerSecDpss(items: SecDpsItem[], rank: number) {
  const sortedItems = items
    .filter((item) => item.dpsRank !== rank)
    .sort((a, b) => a.dpsRank - b.dpsRank);

  const currentIndex = sortedItems.findIndex(
    (item) => item.dpsRank > rank
  );

  const prev = currentIndex > 0 ? sortedItems[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? sortedItems[currentIndex] : null;

  return { prev, next };
}

function getPagerSecBpss(items: SecBpsItem[], rank: number) {
  const sortedItems = items
    .filter((item) => item.bpsRank !== rank)
    .sort((a, b) => a.bpsRank - b.bpsRank);

  const currentIndex = sortedItems.findIndex(
    (item) => item.bpsRank > rank
  );

  const prev = currentIndex > 0 ? sortedItems[currentIndex - 1] : null;
  const next = currentIndex >= 0 ? sortedItems[currentIndex] : null;

  return { prev, next };
}
