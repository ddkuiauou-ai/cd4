"use client";

interface KeyMetricsSidebarBPSProps {
    bpsRank: number | null;
    latestBPS: number | null;
    bps12Month: number | null;
    bps3Year: number | null;
    bps5Year: number | null;
    bps10Year: number | null;
    bps20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    currentPrice: number | null;
}

export function KeyMetricsSidebarBPS({
    bpsRank,
    latestBPS,
    bps12Month,
    bps3Year,
    bps5Year,
    bps10Year,
    bps20Year,
    rangeMin,
    rangeMax,
    currentPrice,
}: KeyMetricsSidebarBPSProps) {
    return (
        <div className="rounded-xl border bg-background p-4">
            <h3 className="text-sm font-semibold mb-3">핵심 지표</h3>
            <div className="space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">BPS 랭킹</span>
                    <span className="font-medium">{bpsRank ? `${bpsRank}위` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">현재 BPS</span>
                    <span className="font-medium">{latestBPS ? `${latestBPS.toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">현재 주가</span>
                    <span className="font-medium">{currentPrice ? `${currentPrice.toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">12개월 평균</span>
                    <span className="font-medium">{bps12Month ? `${Math.round(bps12Month).toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">3년 평균</span>
                    <span className="font-medium">{bps3Year ? `${Math.round(bps3Year).toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">최저 BPS</span>
                    <span className="font-medium">{rangeMin ? `${rangeMin.toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">최고 BPS</span>
                    <span className="font-medium">{rangeMax ? `${rangeMax.toLocaleString()}원` : "—"}</span>
                </div>
            </div>
        </div>
    );
}
