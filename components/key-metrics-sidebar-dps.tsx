"use client";

interface KeyMetricsSidebarDPSProps {
    dpsRank: number | null;
    latestDPS: number | null;
    dps12Month: number | null;
    dps3Year: number | null;
    dps5Year: number | null;
    dps10Year: number | null;
    dps20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    currentPrice: number | null;
}

export function KeyMetricsSidebarDPS({
    dpsRank,
    latestDPS,
    dps12Month,
    dps3Year,
    dps5Year,
    dps10Year,
    dps20Year,
    rangeMin,
    rangeMax,
    currentPrice,
}: KeyMetricsSidebarDPSProps) {
    return (
        <div className="rounded-xl border bg-background p-4">
            <h3 className="text-sm font-semibold mb-3">핵심 지표</h3>
            <div className="space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">DPS 랭킹</span>
                    <span className="font-medium">{dpsRank ? `${dpsRank}위` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">현재 DPS</span>
                    <span className="font-medium">{latestDPS ? `${latestDPS.toFixed(0)}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">현재 주가</span>
                    <span className="font-medium">{currentPrice ? `${currentPrice.toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">12개월 평균</span>
                    <span className="font-medium">{dps12Month ? `${dps12Month.toFixed(0)}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">3년 평균</span>
                    <span className="font-medium">{dps3Year ? `${dps3Year.toFixed(0)}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">5년 평균</span>
                    <span className="font-medium">{dps5Year ? `${dps5Year.toFixed(0)}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">10년 평균</span>
                    <span className="font-medium">{dps10Year ? `${dps10Year.toFixed(0)}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">20년 평균</span>
                    <span className="font-medium">{dps20Year ? `${dps20Year.toFixed(0)}원` : "—"}</span>
                </div>

                <hr className="my-3" />

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">DPS 범위</span>
                    <span className="font-medium text-xs">
                        {rangeMin && rangeMax ? `${rangeMin.toFixed(0)}원 ~ ${rangeMax.toFixed(0)}원` : "—"}
                    </span>
                </div>
            </div>
        </div>
    );
}
