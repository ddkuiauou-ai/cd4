"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRightIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MetricItem {
  name: string;
  width: string;
  corpHref?: string;  // 기업 페이지 URL
  secHref?: string;   // 종목 페이지 URL
  href: string;       // 기본 URL (종목 우선)
  code?: string;      // GitHub 코드 링크
  showCorpSecToggle?: boolean; // 기업/종목 토글 표시 여부
}

const metrics: MetricItem[] = [
  {
    name: "시가총액",
    width: "w-[4rem]",
    corpHref: "/marketcaps",
    secHref: "/marketcap",
    href: "/marketcaps",
    showCorpSecToggle: true,
    code: "https://github.com/",
  },
  {
    name: "주가수익비율",
    width: "w-[6rem]",
    href: "/per",
    code: "https://github.com/",
  },
  {
    name: "배당수익률",  // 오타 수정: "배당금수익율" → "배당수익률"
    width: "w-[5rem]",
    href: "/div",
    code: "https://github.com/",
  },
  {
    name: "주당배당금",
    width: "w-[5rem]",
    href: "/dps",
    code: "https://github.com/",
  },
  {
    name: "주당순자산가치",
    width: "w-[7rem]",
    href: "/bps",
    code: "https://github.com/",
  },
  {
    name: "주가순자산비율",
    width: "w-[7rem]",
    href: "/pbr",
    code: "https://github.com/",
  },
  {
    name: "주당순이익",
    width: "w-[5rem]",
    href: "/eps",
    code: "https://github.com/",
  },
];

interface MarketNavProps extends React.HTMLAttributes<HTMLDivElement> {
  showCorpSecTabs?: boolean; // 기업/종목 탭 표시 여부
}

// 기업/종목 토글 컴포넌트
export function CorpSecTabs({ path }: { path: string }) {
  const router = useRouter();

  const getFlag = (pathname: string): string => {
    if (pathname === "/" || pathname.startsWith("/marketcaps")) {
      return "corp";
    }
    if (pathname.startsWith("/marketcap")) {
      return "sec";
    }
    return "sec";
  };

  const flag = getFlag(path);

  const goCorp = () => router.push("/marketcaps");
  const goSec = () => router.push("/marketcap");

  return (
    <div className="mt-3 flex justify-center">
      <Tabs defaultValue={flag} className="w-auto">
        <TabsList className="p-1 h-auto rounded-md bg-muted/80">
          <TabsTrigger
            value="corp"
            onClick={goCorp}
            className="px-4 py-1.5 text-sm"
          >
            <span className="mr-2">🏢</span>
            <span>기업</span>
          </TabsTrigger>
          <TabsTrigger
            value="sec"
            onClick={goSec}
            className="px-4 py-1.5 text-sm"
          >
            <span className="mr-2">📈</span>
            <span>종목</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}

// 메인 마켓 네비게이션 컴포넌트
export function MarketNav({ className, showCorpSecTabs = false, ...props }: MarketNavProps) {
  const pathname = usePathname();

  const shouldShowCorpSecTabs = showCorpSecTabs && (
    pathname === "/" ||
    pathname?.startsWith("/marketcap") ||
    pathname?.startsWith("/marketcaps")
  );

  return (
    <div className="relative pt-4 mb-6">
      <ScrollArea className="w-full max-w-none">
        <div
          className={cn(
            "flex items-center gap-2 sm:gap-3",
            "overflow-x-auto hide-scrollbar",
            "pb-2 sm:pb-0",
            "sm:justify-center",
            className
          )}
          {...props}
        >
          {metrics.map((metric, index) => {
            const getCurrentHref = () => {
              if (metric.name === "시가총액") {
                if (pathname?.startsWith("/marketcaps")) {
                  return metric.corpHref || metric.href;
                }
                return metric.secHref || metric.href;
              }
              return metric.href;
            };

            const isActive = pathname?.startsWith(getCurrentHref()) ||
              (index === 0 && pathname === "/") ||
              (pathname?.startsWith("/marketcap") && metric.name === "시가총액");

            return (
              <Link
                href={getCurrentHref()}
                key={metric.name}
                className={cn(
                  "transition-colors h-9 px-3 py-2 inline-flex items-center justify-center rounded-md text-sm font-normal whitespace-nowrap flex-shrink-0",
                  isActive
                    ? "text-foreground font-semibold bg-muted/80 shadow-sm"
                    : "text-muted-foreground hover:text-foreground/80 hover:bg-muted/50",
                )}
              >
                <div className={cn(metric.width.replace("w-", "min-w-"), "text-center")}>
                  {metric.name}
                </div>
              </Link>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>

      {shouldShowCorpSecTabs && <CorpSecTabs path={pathname || ""} />}
    </div>
  );
}

// 코드 링크 컴포넌트
interface MarketCodeLinkProps {
  pathname: string | null;
}

export function MarketCodeLink({ pathname }: MarketCodeLinkProps) {
  const metric = metrics.find((metric) =>
    pathname?.startsWith(metric.corpHref || "") ||
    pathname?.startsWith(metric.secHref || "") ||
    pathname?.startsWith(metric.href)
  );

  if (!metric?.code) {
    return null;
  }

  return (
    <Link
      href={metric.code}
      target="_blank"
      rel="nofollow"
      className="absolute right-0 top-0 hidden items-center rounded-[0.5rem] text-sm font-medium md:flex"
    >
      View code
      <ArrowRightIcon className="ml-1 h-4 w-4" />
    </Link>
  );
}

// 기존 컴포넌트와의 호환성을 위한 export
export { MarketNav as ExamplesNav, MarketCodeLink as ExampleCodeLink };
