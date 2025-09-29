"use client";

import { useState } from "react";
import { DPSData, PeriodType } from "@/lib/dps-utils";
import ChartDPSGrowth from "@/components/chart-dps-growth";
import { EDGE_TO_EDGE_CARD_BASE } from "@/components/marketcap/layout";

interface DPSChartWithPeriodSwitcherProps {
    initialData: DPSData[];
}

export default function DPSChartWithPeriodSwitcher({ initialData }: DPSChartWithPeriodSwitcherProps) {
    const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('12M');

    const periods: { key: PeriodType; label: string; description: string }[] = [
        { key: '12M', label: '12개월', description: '최근 1년' },
        { key: '3Y', label: '3년', description: '최근 3년' },
        { key: '5Y', label: '5년', description: '최근 5년' },
        { key: '10Y', label: '10년', description: '최근 10년' },
        { key: '20Y', label: '20년', description: '최근 20년' },
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
                <ChartDPSGrowth
                    data={initialData}
                />
            </div>
        </div>
    );
}
