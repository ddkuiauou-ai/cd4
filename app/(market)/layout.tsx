import { AppShell } from "@/components/app-shell";
import { MarketNav } from "@/components/market-nav";

export default function MarketLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AppShell navigation={<MarketNav showCorpSecTabs={false} />}>
            <div className="app-container">{children}</div>
        </AppShell>
    );
}
