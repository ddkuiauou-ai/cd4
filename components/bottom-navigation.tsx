"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, TrendingUp, Search, User, BarChart3 } from "lucide-react";

interface BottomNavItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    activePattern?: string[];
}

const navItems: BottomNavItem[] = [
    {
        name: "홈",
        href: "/",
        icon: Home,
        activePattern: ["/"],
    },
    {
        name: "순위",
        href: "/marketcaps",
        icon: TrendingUp,
        activePattern: ["/marketcaps", "/marketcap", "/per", "/pbr", "/eps", "/dps", "/bps", "/div"],
    },
    {
        name: "차트",
        href: "/dashboard",
        icon: BarChart3,
        activePattern: ["/dashboard"],
    },
    {
        name: "검색",
        href: "/screener",
        icon: Search,
        activePattern: ["/screener", "/company"],
    },
    {
        name: "내정보",
        href: "/dashboard",
        icon: User,
        activePattern: ["/profile", "/settings"],
    },
];

export function BottomNavigation() {
    const pathname = usePathname();

    const isActive = (item: BottomNavItem) => {
        if (!item.activePattern) return false;
        return item.activePattern.some(pattern => {
            if (pattern === "/" && pathname === "/") return true;
            if (pattern !== "/" && pathname?.startsWith(pattern)) return true;
            return false;
        });
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t-2 border-border/60 shadow-2xl z-50 md:hidden">
            <div className="flex items-center justify-around px-2 py-3 max-w-md mx-auto">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item);

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center min-h-[56px] min-w-[56px] px-2 py-1 rounded-2xl transition-all duration-300 touch-manipulation group",
                                active
                                    ? "bg-primary/15 text-primary shadow-lg border border-primary/30 scale-105"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60 hover:scale-105"
                            )}
                        >
                            <div className={cn(
                                "p-2 rounded-xl transition-all duration-300",
                                active
                                    ? "bg-primary/20 shadow-md"
                                    : "group-hover:bg-background/80 group-hover:shadow-sm"
                            )}>
                                <Icon
                                    className={cn(
                                        "h-5 w-5 transition-all duration-300",
                                        active ? "text-primary scale-110" : "text-current"
                                    )}
                                />
                            </div>
                            <span className={cn(
                                "text-xs font-medium mt-1 tracking-tight",
                                active ? "text-primary font-bold" : "text-current"
                            )}>
                                {item.name}
                            </span>

                            {/* Active indicator dot */}
                            {active && (
                                <div className="w-1 h-1 bg-primary rounded-full mt-1 animate-pulse" />
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* Bottom safe area for phones with home indicators */}
            <div className="h-safe-area-inset-bottom bg-background/50" />
        </nav>
    );
}
