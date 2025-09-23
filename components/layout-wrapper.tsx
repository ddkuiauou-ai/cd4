import type { ReactNode } from "react";

import type { SearchNameResult } from "@/lib/getSearch";

import { BottomNavigation } from "@/components/bottom-navigation";
import { MarketNav } from "@/components/market-nav";
import { MobileHeaderProvider } from "@/components/mobile-header-context";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";

interface LayoutWrapperProps {
  children: ReactNode;
  searchData: SearchNameResult[];
  showMarketNav?: boolean;
  showCorpSecTabs?: boolean;
  containerClassName?: string;
  contentClassName?: string;
}

export function LayoutWrapper({
  children,
  searchData,
  showMarketNav = true,
  showCorpSecTabs = true,
  containerClassName,
  contentClassName,
}: LayoutWrapperProps) {
  return (
    <MobileHeaderProvider>
      <div className="flex min-h-screen flex-col">
        <SiteHeader searchData={searchData} />
        <div className={cn("flex-1 pb-20 md:pb-0", containerClassName)}>
          <div
            className={cn(
              "container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8",
              contentClassName,
            )}
          >
            {showMarketNav ? (
              <div className="py-4 sm:py-6">
                <MarketNav showCorpSecTabs={showCorpSecTabs} />
              </div>
            ) : null}
            {children}
          </div>
        </div>
        <SiteFooter />
      </div>
      <BottomNavigation />
    </MobileHeaderProvider>
  );
}
