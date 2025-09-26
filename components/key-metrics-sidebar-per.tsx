"use client";

interface KeyMetricsSidebarPERProps {
    perRank: number | null;
    latestPER: number | null;
    per12Month: number | null;
    per3Year: number | null;
    per5Year: number | null;
    per10Year: number | null;
    per20Year: number | null;
    rangeMin: number;
    rangeMax: number;
    currentPrice: number | null;
}

export function KeyMetricsSidebarPER({
    perRank,
    latestPER,
    per12Month,
    per3Year,
    per5Year,
    per10Year,
    per20Year,
    rangeMin,
    rangeMax,
    currentPrice,
}: KeyMetricsSidebarPERProps) {
    return (
        <div className="rounded-xl border bg-background p-4">
            <h3 className="text-sm font-semibold mb-3">핵심 지표</h3>
            <div className="space-y-3">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">PER 랭킹</span>
                    <span className="font-medium">{perRank ? `${perRank}위` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">현재 PER</span>
                    <span className="font-medium">{latestPER ? `${latestPER.toFixed(2)}배` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">현재 주가</span>
                    <span className="font-medium">{currentPrice ? `${currentPrice.toLocaleString()}원` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">12개월 평균</span>
                    <span className="font-medium">{per12Month ? `${per12Month.toFixed(2)}배` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">3년 평균</span>
                    <span className="font-medium">{per3Year ? `${per3Year.toFixed(2)}배` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">최저 PER</span>
                    <span className="font-medium">{rangeMin ? `${rangeMin.toFixed(2)}배` : "—"}</span>
                </div>

                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">최고 PER</span>
                    <span className="font-medium">{rangeMax ? `${rangeMax.toFixed(2)}배` : "—"}</span>
                </div>
            </div>
        </div>
    );
}