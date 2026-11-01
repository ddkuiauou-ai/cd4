import { AppShell } from "@/components/app-shell";
import { RankingDirectoryFooter } from "@/components/ranking-directory-footer";

export default function MarketLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AppShell footer={<RankingDirectoryFooter />}>
            <div className="app-container">{children}</div>
        </AppShell>
    );
}
