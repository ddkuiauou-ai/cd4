"use client";

interface KeyMetricsSidebarPBRProps {
    pbrRank: number | null;
    latestPBR: number | null;
    pbr12Month: number | null;
    pbr3Year: number | null;
    pbr5Year: number | null;
    pbr10Year: number | null;
    pbr20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    currentPrice: number | null;
}

export function KeyMetricsSidebarPBR({
    pbrRank,
    latestPBR,
    pbr12Month,
    pbr3Year,
    pbr5Year,
    pbr10Year,
    pbr20Year,
    rangeMin,
    rangeMax,
    currentPrice,
}: KeyMetricsSidebarPBRProps) {
    return (
        <div className="rounded-xl border bg-background p-4">
            <h3 className="text-sm font-semibold mb-3">핵심 지표</h3>
            <div className="space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">PBR 랭킹</span>
                    <span className="font-medium">{pbrRank ? `${pbrRank}위` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">현재 PBR</span>
                    <span className="font-medium">{latestPBR ? `${latestPBR.toFixed(2)}배` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">현재 주가</span>
                    <span className="font-medium">{currentPrice ? `${currentPrice.toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">12개월 평균</span>
                    <span className="font-medium">{pbr12Month ? `${pbr12Month.toFixed(2)}배` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">3년 평균</span>
                    <span className="font-medium">{pbr3Year ? `${pbr3Year.toFixed(2)}배` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">최저 PBR</span>
                    <span className="font-medium">{rangeMin ? `${rangeMin.toFixed(2)}배` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">최고 PBR</span>
                    <span className="font-medium">{rangeMax ? `${rangeMax.toFixed(2)}배` : "—"}</span>
                </div>
            </div>
        </div>
    );
}
