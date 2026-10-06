import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { MarketNav } from "@/components/market-nav";
import { cn } from "@/lib/utils";
export function LayoutWrapper({children,showMarketNav=true,showCorpSecTabs=true,containerClassName,contentClassName}:{children:ReactNode;showMarketNav?:boolean;showCorpSecTabs?:boolean;containerClassName?:string;contentClassName?:string}){
  return <AppShell className={containerClassName} navigation={showMarketNav?<MarketNav showCorpSecTabs={showCorpSecTabs}/>:undefined}><div className={cn("app-container",contentClassName)}>{children}</div></AppShell>;
}
