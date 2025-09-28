"use client";

interface KeyMetricsSidebarEPSProps {
    epsRank: number | null;
    latestEPS: number | null;
    eps12Month: number | null;
    eps3Year: number | null;
    eps5Year: number | null;
    eps10Year: number | null;
    eps20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    currentPrice: number | null;
}

export function KeyMetricsSidebarEPS({
    epsRank,
    latestEPS,
    eps12Month,
    eps3Year,
    eps5Year,
    eps10Year,
    eps20Year,
    rangeMin,
    rangeMax,
    currentPrice,
}: KeyMetricsSidebarEPSProps) {
    return (
        <div className="rounded-xl border bg-background p-4">
            <h3 className="text-sm font-semibold mb-3">핵심 지표</h3>
            <div className="space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">EPS 랭킹</span>
                    <span className="font-medium">{epsRank ? `${epsRank}위` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">현재 EPS</span>
                    <span className="font-medium">{latestEPS ? `${latestEPS.toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">현재 주가</span>
                    <span className="font-medium">{currentPrice ? `${currentPrice.toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">12개월 평균</span>
                    <span className="font-medium">{eps12Month ? `${eps12Month.toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">3년 평균</span>
                    <span className="font-medium">{eps3Year ? `${eps3Year.toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">최저 EPS</span>
                    <span className="font-medium">{rangeMin ? `${rangeMin.toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">최고 EPS</span>
                    <span className="font-medium">{rangeMax ? `${rangeMax.toLocaleString()}원` : "—"}</span>
                </div>
            </div>
        </div>
    );
}
