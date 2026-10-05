import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MarketNav } from "@/components/market-nav";
import { BottomNavigation } from "@/components/bottom-navigation";

export default function MarketLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <SiteHeader />
            <div className="container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
                {/* The `showCorpSecTabs` prop can be managed here based on path or other logic if needed */}
                <MarketNav showCorpSecTabs={true} />
            </div>
            <main className="flex-1 pb-20 md:pb-0">
                <div className="container mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8">
                    {children}
                </div>
            </main>
            <SiteFooter />
            <BottomNavigation />
        </>
    );
}
