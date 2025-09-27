"use client";

import { useState } from "react";
import { PERData, PeriodType } from "@/lib/per-utils";
import ChartPEREnhanced from "@/components/chart-PER-enhanced";
import { EDGE_TO_EDGE_CARD_BASE } from "@/components/marketcap/layout";

interface PERChartWithPeriodSwitcherProps {
    initialData: PERData[];
}

export default function PERChartWithPeriodSwitcher({ initialData }: PERChartWithPeriodSwitcherProps) {
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('1M');

    const periods: { key: PeriodType; label: string; description: string }[] = [
        { key: '1M', label: '월간', description: '월별 데이터' },
        { key: '1Y', label: '년간', description: '년별 평균' },
    ];

    return (
        <div className="space-y-4">
            {/* Period Switcher */}
            <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <span>기간 선택:</span>
                </div>
                <div className="flex gap-1">
                    {periods.map((period) => (
                        <button
                            key={period.key}
                            onClick={() => setSelectedPeriod(period.key)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${selectedPeriod === period.key
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground border border-border'
                                }`}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart with selected period */}
            <div className={`${EDGE_TO_EDGE_CARD_BASE} p-2 sm:p-4`}>
                <ChartPEREnhanced
                    data={initialData}
                    period={selectedPeriod}
                />
            </div>
        </div>
    );
}
