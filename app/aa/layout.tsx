import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { MarketNav } from "@/components/market-nav";
import { BottomNavigation } from "@/components/bottom-navigation";
import { getSecuritySearchNames } from "@/lib/getSearch";

export default async function MarketLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const searchData = await getSecuritySearchNames();

    return (
        <>
            <SiteHeader searchData={searchData} />
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
