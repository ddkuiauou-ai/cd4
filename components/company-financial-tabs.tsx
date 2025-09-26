"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface CompanyFinancialTabsProps {
    secCode: string;
    className?: string;
}

// CompanyCorpSecTabs component removed - 3D navigation handled by CardMarketcap

/**
 * Unified Financial Navigation System
 * Intelligently routes between company and security contexts based on user intent
 */
export function CompanyFinancialTabs({ secCode, className }: CompanyFinancialTabsProps) {
    const pathname = usePathname();

    // Determine current context: are we on a company page or security page?
    const isCompanyContext = pathname?.startsWith(`/company/${secCode}`);

    // Smart routing: company context for overview, security context for analysis
    const tabs = [
        {
            id: "marketcap",
            label: "시가총액",
            description: "Market Cap",
            href: `/company/${secCode}/marketcap`, // Always company context - shows all securities
            icon: "🏢",
            intent: "회사 전체 시가총액 비교"
        },
        {
            id: "per",
            label: "주가수익비율",
            description: "PER",
            href: `/security/${secCode}/per`, // Security analysis context
            icon: "📊",
            intent: "개별 종목 PER 분석"
        },
        {
            id: "div",
            label: "배당수익률",
            description: "Dividend Yield",
            href: `/security/${secCode}/div`,
            icon: "💰",
            intent: "배당 수익률 분석"
        },
        {
            id: "dps",
            label: "주당배당금",
            description: "DPS",
            href: `/security/${secCode}/dps`,
            icon: "💵",
            intent: "주당배당금 분석"
        },
        {
            id: "bps",
            label: "주당순자산가치",
            description: "BPS",
            href: `/security/${secCode}/bps`,
            icon: "📈",
            intent: "순자산가치 분석"
        },
        {
            id: "pbr",
            label: "주가순자산비율",
            description: "PBR",
            href: `/security/${secCode}/pbr`,
            icon: "📉",
            intent: "순자산비율 분석"
        },
        {
            id: "eps",
            label: "주당순이익",
            description: "EPS",
            href: `/security/${secCode}/eps`,
            icon: "💸",
            intent: "주당순이익 분석"
        },
    ];

    const getCurrentTab = () => {
        // Smart tab detection based on current path
        if (pathname === `/company/${secCode}/marketcap`) {
            return "marketcap";
        }

        // Extract metric from security pages
        const securityMatch = pathname?.match(`^/security/${secCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(.+)$`);
        if (securityMatch) {
            const metric = securityMatch[1];
            return tabs.find(tab => tab.id === metric)?.id || "marketcap";
        }

        return "marketcap";
    };

    const currentTab = getCurrentTab();

    return (
        <div className={cn("w-full", className)}>
            {/* Context indicator */}

            <Tabs value={currentTab} className="w-full">
                <ScrollArea className="w-full" orientation="horizontal">
                    <TabsList className="flex w-max gap-1 rounded-xl bg-muted/30 p-1 h-auto sm:grid sm:w-full sm:grid-cols-4 lg:grid-cols-7">
                        {tabs.map((tab) => (
                            <Link key={tab.id} href={tab.href} className="w-auto sm:w-full">
                                <TabsTrigger
                                    value={tab.id}
                                    className={cn(
                                        "flex-shrink-0 min-w-[6.5rem] text-xs sm:text-sm font-medium sm:min-w-0",
                                        "data-[state=active]:bg-background data-[state=active]:text-foreground",
                                        "data-[state=active]:border data-[state=active]:border-border",
                                        "flex flex-col items-center justify-center p-2 sm:p-3",
                                        "min-h-[3rem] sm:min-h-[3.5rem]",
                                        "data-[state=active]:shadow-sm transition-all duration-200",
                                        "hover:bg-muted/50 hover:text-foreground",
                                        "rounded-md group relative"
                                    )}
                                >
                                    {/* Icon with context indication */}
                                    <div className="flex items-center gap-1 mb-1">
                                        <span className="text-lg">{tab.icon}</span>
                                        {tab.id === "marketcap" && (
                                            <span className="text-xs opacity-60">🏢</span>
                                        )}
                                    </div>

                                    <span className="font-semibold leading-tight">{tab.label}</span>
                                    <span className="text-xs text-muted-foreground font-normal opacity-70 leading-tight">
                                        {tab.description}
                                    </span>

                                    {/* Hover tooltip */}
                                    <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                        {tab.intent}
                                    </div>
                                </TabsTrigger>
                            </Link>
                        ))}
                    </TabsList>
                    <ScrollBar orientation="horizontal" className="h-2 sm:hidden" />
                </ScrollArea>
            </Tabs>
        </div>
    );
}
