import { AppShell } from "@/components/app-shell";

export default function MarketLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AppShell footerContext="ranking">
            <div className="app-container">{children}</div>
        </AppShell>
    );
}
