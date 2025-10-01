/**
 * Utility functions for DPS (Dividend Per Share) calculations and data processing
 */

export interface DPSData {
    date: string;
    value: number | null;
}

export interface DPSGrowthData extends DPSData {
    growthRate?: number | null;
}

export interface DPSPeriodAnalysis {
    periods: Array<{
        label: string;
        value: number;
        desc: string;
    }>;
    minMax: { min: number; max: number };
    currentSecurity: string;
    market: string;
    latestDPS: number | null;
}

export type PeriodType = '12M' | '3Y' | '5Y' | '10Y' | '20Y';

/**
 * Calculate period analysis for DPS data
 */
export function calculateDPSPeriodAnalysis(
    result: DPSData[],
    displayName: string,
    market: string
): DPSPeriodAnalysis | null {
    if (!result || result.length === 0) return null;

    const latestDPS = result.length > 0 ? result[result.length - 1].value : null;

    // 기간별 데이터 필터링 함수 (배당금이 0인 기간 제외)
    const getDataForPeriod = (months: number) => {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);
        return result.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= cutoffDate && item.value !== 0;
        });
    };

    // 기간별 평균 계산
    const periods = [
        { label: '최근 DPS', months: 0, desc: '현재 기준' },
        { label: '12개월 평균', months: 12, desc: '직전 1년' },
        { label: '3년 평균', months: 36, desc: '최근 3년' },
        { label: '5년 평균', months: 60, desc: '최근 5년' },
        { label: '10년 평균', months: 120, desc: '최근 10년' },
        { label: '20년 평균', months: 240, desc: '최근 20년' }
    ];

    const analysis = periods.map(period => {
        if (period.months === 0) {
            return {
                label: period.label,
                value: latestDPS || 0,
                desc: period.desc
            };
        }

        const periodData = getDataForPeriod(period.months);
        if (periodData.length === 0) return null;

        const validPeriodData = periodData.filter(item => item.value !== null);
        if (validPeriodData.length === 0) return null;
        const average = validPeriodData.reduce((sum, item) => sum + (item.value as number), 0) / validPeriodData.length;
        return {
            label: period.label,
            value: average,
            desc: period.desc
        };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    // 최저/최고 계산
    const allValues = result.map(item => item.value).filter(value => value !== null) as number[];
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    return {
        periods: analysis,
        minMax: { min: minValue, max: maxValue },
        currentSecurity: displayName,
        market,
        latestDPS
    };
}

/**
 * Process DPS data for charts and analysis
 */
export function processDPSData(data: Array<{ date: Date | string; dps: number | null }>): DPSData[] {
    if (!data || data.length === 0) {
        return [];
    }

    return data
        .map((item) => {
            let dateStr: string;
            const dateValue = item.date;

            if (dateValue instanceof Date) {
                dateStr = dateValue.toISOString().split('T')[0];
            } else if (typeof dateValue === 'string') {
                dateStr = dateValue.split('T')[0];
            } else {
                dateStr = String(dateValue).split('T')[0];
            }

            let value: number | null = null;
            if (item.dps !== null && item.dps !== undefined) {
                const numValue = Number(item.dps);
                if (!isNaN(numValue) && numValue > 0) {
                    value = numValue;
                }
            }

            return {
                date: dateStr,
                value: value,
            };
        })
        .filter(item => item.value !== null)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Process DPS data with growth rate calculation for charts and analysis
 * Growth rates are calculated for consecutive data points in chronological order
 */
export function processDPSDataWithGrowth(data: Array<{ date: Date | string; dps: number | null }>): DPSGrowthData[] {
    if (!data || !Array.isArray(data) || data.length === 0) {
        return [];
    }

    const dpsData = processDPSData(data);

    if (dpsData.length === 0) {
        return [];
    }

    // 데이터를 날짜순으로 정렬
    const sortedData = dpsData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 전체 데이터를 대상으로 성장률 계산 (연속된 데이터 포인트 간 비교)
    return sortedData.map((item, index) => {
        if (index === 0) {
            // 첫 번째 데이터는 성장률 계산 불가
            return { ...item, growthRate: null };
        }

        const previousValue = sortedData[index - 1].value;
        const currentValue = item.value;

        // 값 검증
        if (previousValue === null || previousValue === undefined || currentValue === null || currentValue === undefined) {
            return { ...item, growthRate: null };
        }

        if (typeof previousValue !== 'number' || typeof currentValue !== 'number') {
            return { ...item, growthRate: null };
        }

        if (previousValue <= 0 || currentValue <= 0) {
            return { ...item, growthRate: null };
        }

        const growthRate = ((currentValue - previousValue) / previousValue) * 100;
        const finalGrowthRate = Math.abs(growthRate) < 0.01 ? 0 : Number(growthRate.toFixed(2));

        return { ...item, growthRate: finalGrowthRate };
    });
}

/**
 * Volume coercion utility - reused from other utilities
 */
export function coerceVolumeValue(volume: unknown, fvolume: unknown): number | null {
    // Handle null/undefined cases
    if (volume === null || volume === undefined) {
        if (fvolume === null || fvolume === undefined) {
            return null;
        }
        volume = fvolume;
    }

    // Convert to number
    const numVolume = typeof volume === 'number' ? volume : Number(volume);

    // Return null for invalid numbers
    if (!Number.isFinite(numVolume) || numVolume < 0) {
        return null;
    }

    return numVolume;
}
