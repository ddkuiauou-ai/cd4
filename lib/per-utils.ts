/**
 * Utility functions for PER (Price-to-Earnings Ratio) calculations and data processing
 */

export interface PERData {
  date: string;
  value: number;
  eps: number;
}

export interface PERPeriodAnalysis {
  periods: Array<{
    label: string;
    value: number;
    desc: string;
  }>;
  minMax: { min: number; max: number };
  currentSecurity: string;
  market: string;
  latestPER: number | null;
}

/**
 * Calculate period analysis for PER data
 */
export function calculatePERPeriodAnalysis(
  result: PERData[],
  displayName: string,
  market: string
): PERPeriodAnalysis | null {
  if (!result || result.length === 0) return null;

  const latestPER = result.length > 0 ? result[result.length - 1].value : null;

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
    { label: '최근 PER', months: 0, desc: '현재 기준' },
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
        value: latestPER || 0,
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
    latestPER
  };
}

/**
 * Process PER data for charts and analysis
 */
export function processPERData(data: Array<{ date: Date; per: number | null; eps: number | null }>): PERData[] {
  return data
    .filter((item) => item.per !== null && item.per !== undefined)
    .map((item) => ({
      date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0],
      value: Number(item.per),
      eps: Number(item.eps || 0),
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