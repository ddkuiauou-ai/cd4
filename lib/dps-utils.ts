/**
 * Utility functions for DPS (Dividend Per Share) calculations and data processing
 */

export interface DPSData {
    date: string;
    value: number;
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

        const average = periodData.reduce((sum, item) => sum + item.value, 0) / periodData.length;
        return {
            label: period.label,
            value: average,
            desc: period.desc
        };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    // 최저/최고 계산
    const allValues = result.map(item => item.value);
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
export function processDPSData(data: Array<{ date: Date; dps: number | null }>): DPSData[] {
    return data
        .filter((item) => item.dps !== null && item.dps !== undefined && item.dps !== 0)
        .map((item) => ({
            date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0],
            value: Number(item.dps),
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Process DPS data with growth rate calculation for charts and analysis
 */
export function processDPSDataWithGrowth(data: Array<{ date: Date; dps: number | null }>): DPSGrowthData[] {
    const dpsData = processDPSData(data);

    // 12월 데이터만 필터링 (차트에서 사용하는 데이터와 동일)
    const decemberData = dpsData.filter(item => item.date.endsWith('-12'));

    if (decemberData.length === 0) {
        console.log('No December data found, returning original data');
        return dpsData;
    }

    // 12월 데이터를 연도순으로 정렬
    const sortedDecemberData = decemberData.sort((a, b) => {
        const yearA = parseInt(a.date.split('-')[0]);
        const yearB = parseInt(b.date.split('-')[0]);
        return yearA - yearB;
    });

    // 12월 데이터에 대해서만 성장률 계산
    const decemberDataWithGrowth = sortedDecemberData.map((item, index) => {
        if (index === 0) {
            // 첫 번째 데이터는 성장률 계산 불가
            return { ...item, growthRate: null };
        }

        const previousValue = sortedDecemberData[index - 1].value;
        const currentValue = item.value;

        if (previousValue === 0 || previousValue === null || currentValue === null) {
            return { ...item, growthRate: null };
        }

        const growthRate = ((currentValue - previousValue) / previousValue) * 100;

        // DPS 값이 같으면 0%, 다르면 계산된 값
        const finalGrowthRate = Math.abs(growthRate) < 0.01 ? 0 : Number(growthRate.toFixed(2));

        return { ...item, growthRate: finalGrowthRate };
    });

    // 원본 데이터에 성장률 정보를 추가
    return dpsData.map(item => {
        const decemberItem = decemberDataWithGrowth.find(dec => dec.date === item.date);
        return decemberItem || { ...item, growthRate: null };
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
