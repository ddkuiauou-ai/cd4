/**
 * Utility functions for EPS (Earnings Per Share) calculations and data processing
 */

export interface EPSData {
    date: string;
    value: number;
}

export interface EPSPeriodAnalysis {
    periods: Array<{
        label: string;
        value: number;
        desc: string;
    }>;
    minMax: { min: number; max: number };
    currentSecurity: string;
    market: string;
    latestEPS: number | null;
}

/**
 * Calculate period analysis for EPS data
 */
export function calculateEPSPeriodAnalysis(
    result: EPSData[],
    displayName: string,
    market: string
): EPSPeriodAnalysis | null {
    if (!result || result.length === 0) return null;

    const latestEPS = result.length > 0 ? result[result.length - 1].value : null;

    // 기간별 데이터 필터링 함수
    const getDataForPeriod = (months: number) => {
        const cutoffDate = new Date();
        cutoffDate.setMonth(cutoffDate.getMonth() - months);
        return result.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= cutoffDate;
        });
    };

    // 기간별 평균 계산
    const periods = [
        { label: '최근 EPS', months: 0, desc: '현재 기준' },
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
                value: latestEPS || 0,
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
        latestEPS
    };
}

/**
 * Process EPS data for charts and analysis
 */
export function processEPSData(data: Array<{ date: Date; eps: number | null }>): EPSData[] {
    return data
        .filter((item) => item.eps !== null && item.eps !== undefined)
        .map((item) => ({
            date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0],
            value: Number(item.eps),
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

/**
 * Coerce volume value with fallback options
 */
export function coerceVolumeValue(primary: unknown, secondary?: unknown): number | null {
    const candidates = [primary, secondary];

    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined) {
            continue;
        }

        if (typeof candidate === "number" && Number.isFinite(candidate)) {
            return candidate;
        }

        if (typeof candidate === "bigint") {
            const numeric = Number(candidate);
            if (Number.isFinite(numeric)) {
                return numeric;
            }
        }

        if (typeof candidate === "string") {
            const numeric = Number.parseFloat(candidate.replace(/,/g, ""));
            if (Number.isFinite(numeric)) {
                return numeric;
            }
        }
    }

    return null;
}

/**
 * Period types for data aggregation
 */
export type PeriodType = '1D' | '1W' | '1M' | '1Y';

/**
 * Period data interface
 */
export interface PeriodData {
    time: string;
    value: number;
}

/**
 * Aggregate EPS data by different time periods
 */
export function aggregateEPSDataByPeriod(data: EPSData[], period: PeriodType): PeriodData[] {
    if (!data || data.length === 0) return [];

    const sortedData = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    switch (period) {
        case '1D':
            return aggregateDailyData(sortedData);
        case '1W':
            return aggregateWeeklyData(sortedData);
        case '1M':
            return aggregateMonthlyData(sortedData);
        case '1Y':
            return aggregateYearlyData(sortedData);
        default:
            return aggregateMonthlyData(sortedData);
    }
}

/**
 * Aggregate data as daily (no aggregation needed)
 */
function aggregateDailyData(data: EPSData[]): PeriodData[] {
    return data.map(item => ({
        time: item.date,
        value: item.value
    }));
}

/**
 * Aggregate data as weekly averages
 */
function aggregateWeeklyData(data: EPSData[]): PeriodData[] {
    const weeklyMap = new Map<string, { values: number[], dates: string[] }>();

    data.forEach(item => {
        const date = new Date(item.date);
        const year = date.getFullYear();
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
        const weekKey = `${year}-W${getWeekNumber(date)}`;

        if (!weeklyMap.has(weekKey)) {
            weeklyMap.set(weekKey, { values: [], dates: [] });
        }

        const weekData = weeklyMap.get(weekKey)!;
        weekData.values.push(item.value);
        weekData.dates.push(item.date);
    });

    return Array.from(weeklyMap.entries())
        .map(([weekKey, weekData]) => {
            const average = weekData.values.reduce((sum, val) => sum + val, 0) / weekData.values.length;
            const middleDate = weekData.dates[Math.floor(weekData.dates.length / 2)];
            return {
                time: middleDate,
                value: average
            };
        })
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

/**
 * Aggregate data as monthly averages
 */
function aggregateMonthlyData(data: EPSData[]): PeriodData[] {
    const monthlyMap = new Map<string, { values: number[], dates: string[] }>();

    data.forEach(item => {
        const date = new Date(item.date);
        const year = date.getFullYear();
        const month = date.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

        if (!monthlyMap.has(monthKey)) {
            monthlyMap.set(monthKey, { values: [], dates: [] });
        }

        const monthData = monthlyMap.get(monthKey)!;
        monthData.values.push(item.value);
        monthData.dates.push(item.date);
    });

    return Array.from(monthlyMap.entries())
        .map(([monthKey, monthData]) => {
            const average = monthData.values.reduce((sum, val) => sum + val, 0) / monthData.values.length;
            const middleDate = monthData.dates[Math.floor(monthData.dates.length / 2)];
            return {
                time: middleDate,
                value: average
            };
        })
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

/**
 * Aggregate data as yearly averages
 */
function aggregateYearlyData(data: EPSData[]): PeriodData[] {
    const sortedData = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const yearlyMap = new Map<string, { values: number[], dates: string[] }>();

    // 연도별로 데이터 그룹화
    data.forEach(item => {
        const date = new Date(item.date);
        const year = date.getFullYear().toString();
        const yearKey = year;

        if (!yearlyMap.has(yearKey)) {
            yearlyMap.set(yearKey, { values: [], dates: [] });
        }

        const yearData = yearlyMap.get(yearKey)!;
        yearData.values.push(item.value);
        yearData.dates.push(item.date);
    });

    // 연도별 평균 계산
    return Array.from(yearlyMap.entries())
        .map(([yearKey, yearData]) => {
            const average = yearData.values.reduce((sum, val) => sum + val, 0) / yearData.values.length;
            // 해당 연도의 중간 날짜를 사용 (예: 2023년이면 2023-06-15 같은 날짜)
            const middleDate = yearData.dates[Math.floor(yearData.dates.length / 2)];
            return {
                time: middleDate,
                value: average
            };
        })
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

/**
 * Get week number of the year
 */
function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
