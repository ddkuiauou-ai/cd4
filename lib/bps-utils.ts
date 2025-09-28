/**
 * Utility functions for BPS (Book Value Per Share) calculations and data processing
 */

export interface BPSData {
    date: string;
    value: number;
}

export interface BPSPeriodAnalysis {
    periods: Array<{
        label: string;
        value: number;
        desc: string;
    }>;
    minMax: { min: number; max: number };
    currentSecurity: string;
    market: string;
    latestBPS: number | null;
}

/**
 * Calculate period analysis for BPS data
 */
export function calculateBPSPeriodAnalysis(
    result: BPSData[],
    displayName: string,
    market: string
): BPSPeriodAnalysis | null {
    if (!result || result.length === 0) return null;

    const latestBPS = result.length > 0 ? result[result.length - 1].value : null;

    // 기간별 데이터 필터링 함수
    const getDataForPeriod = (years: number) => {
        const cutoffDate = new Date();
        cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
        return result.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= cutoffDate;
        });
    };

    // 기간별 평균 계산
    const periods = [
        { label: '현재 BPS', years: 0, desc: '최신 데이터' },
        { label: '12개월 평균', years: 1, desc: '직전 1년' },
        { label: '3년 평균', years: 3, desc: '최근 3년' },
        { label: '5년 평균', years: 5, desc: '최근 5년' },
        { label: '10년 평균', years: 10, desc: '최근 10년' },
        { label: '20년 평균', years: 20, desc: '최근 20년' },
    ].map(({ label, years, desc }) => {
        let value: number;
        let periodData: BPSData[];

        if (years === 0) {
            // 현재 BPS
            value = latestBPS || 0;
            periodData = result.slice(-1);
        } else {
            // 기간별 평균
            periodData = getDataForPeriod(years);
            value = periodData.length > 0
                ? periodData.reduce((sum, item) => sum + item.value, 0) / periodData.length
                : 0;
        }

        return {
            label,
            value: Math.round(value * 100) / 100, // 소수점 2자리까지
            desc,
        };
    });

    // Min/Max 계산
    const allValues = result.map(item => item.value);
    const minMax = {
        min: Math.min(...allValues),
        max: Math.max(...allValues),
    };

    return {
        periods,
        minMax,
        currentSecurity: displayName,
        market,
        latestBPS,
    };
}

/**
 * Process BPS data from database format to display format
 */
export function processBPSData(data: any[]): BPSData[] {
    if (!data || !Array.isArray(data)) return [];

    // BPS 데이터 필터링 및 변환
    const rawResult = data
        .map((item) => ({
            date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date),
            value: item.bps,
        }))
        .filter((item) => item.value !== null && !isNaN(item.value));

    // 같은 날짜의 중복 데이터 제거 (최신 데이터 우선)
    const uniqueDataMap = new Map();
    rawResult.forEach((item) => {
        const key = item.date;
        if (!uniqueDataMap.has(key) || uniqueDataMap.get(key).value < item.value) {
            uniqueDataMap.set(key, item);
        }
    });

    const result = Array.from(uniqueDataMap.values())
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return result;
}
