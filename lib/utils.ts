import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatBusinessValue, formatCompactBusinessValue, type BusinessValue } from "./business-analysis";
import { businessDate } from "./data/dto";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumberRaw(num: BusinessValue | undefined): string {
  return formatBusinessValue(num);
}

export function formatNumberRatio(num: BusinessValue | undefined): string {
  const value = formatBusinessValue(num);
  return value === "—" ? value : `${value}배`;
}

export function formatNumberPercent(num: BusinessValue | undefined): string {
  const value = formatBusinessValue(num);
  return value === "—" ? value : `${value}%`;
}

export function formatNumber(num: BusinessValue | undefined, unit?: string, digits?: number): string {
  const value = formatCompactBusinessValue(num, digits);
  return value === "—" ? value : `${value}${unit || ""}`;
}

export function formatNumberBPS(num: BusinessValue | undefined): string {
  return formatCompactBusinessValue(num);
}

export function formatNumberTooltip(num: BusinessValue | undefined): string {
  const value = formatBusinessValue(num);
  return value === "—" ? value : `${value}원`;
}

/**
 * Safely convert any date input to a Date object
 * Handles string dates, Date objects, and null/undefined values
 *
 * @param dateInput - Date string, Date object, or null/undefined
 * @returns Date object or null if invalid
 */
export function safeDateConvert(
  dateInput: Date | string | null | undefined
): Date | null {
  if (!dateInput) return null;

  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  if (typeof dateInput === "string") {
    const date = new Date(dateInput);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Format date for display with fallback for invalid dates
 *
 * @param dateInput - Date string, Date object, or null/undefined
 * @param locale - Locale string (default: 'ko-KR')
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string or fallback
 */
export function formatDate(
  dateInput: Date | string | null | undefined,
  locale: string = "ko-KR",
  options?: Intl.DateTimeFormatOptions
): string {
  const date = safeDateConvert(dateInput);
  if (!date) return "-";

  try {
    return date.toLocaleDateString(locale, { timeZone: "Asia/Seoul", ...options });
  } catch {
    return businessDate(date) ?? "—"; // Fallback to ISO date
  }
}

/**
 * Get ISO date string from any date input
 *
 * @param dateInput - Date string, Date object, or null/undefined
 * @returns ISO date string (YYYY-MM-DD) or null
 */
export function getISODateString(
  dateInput: Date | string | null | undefined
): string | null {
  try { return businessDate(dateInput); } catch { return null; }
}

/**
 * Format date with proper Korean month names
 * Handles the issue where toLocaleDateString('ko-KR', { month: 'short' }) returns English abbreviations
 *
 * @param dateInput - Date string, Date object, or null/undefined
 * @param options - Date formatting options
 * @returns Formatted date string with Korean month names
 */
export function formatDateKorean(
  dateInput: Date | string | null | undefined,
  options: {
    year?: 'numeric' | '2-digit';
    month?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit';
    day?: 'numeric' | '2-digit';
    includeDay?: boolean;
  } = {}
): string {
  const date = safeDateConvert(dateInput);
  if (!date) return "-";

  try {
    const { month = 'short', includeDay = true } = options;

    // Korean month names
    const koreanMonths = {
      long: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
      short: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
      narrow: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    };

    const day = businessDate(date)!;
    const [businessYear, businessMonth, businessDay] = day.split('-').map(Number);
    const monthIndex = businessMonth - 1;
    let monthName: string;

    if (month === 'numeric') {
      monthName = `${monthIndex + 1}월`;
    } else {
      monthName = koreanMonths[month as keyof typeof koreanMonths]?.[monthIndex] || koreanMonths.short[monthIndex];
    }

    const yearStr = businessYear;
    const dayStr = includeDay ? `${businessDay}일` : '';

    return `${yearStr}년 ${monthName}${dayStr}`.trim();
  } catch {
    return businessDate(date) ?? "—";
  }
}

// Date processing utilities for market data
export function getLatestDateFromMarketData(data: readonly { marketcapDate?: Date | string | null }[]): string {
  return data.flatMap(row => { const date = getISODateString(row.marketcapDate); return date ? [date] : []; }).sort().at(-1) ?? "N/A";
}

export function getUpdatedDateFromMarketData(data: readonly { updatedAt?: Date | string | null }[]): string {
  let latestUpdate: Date | null = null;
  for (const item of data) {
    const date = safeDateConvert(item.updatedAt);
    if (date && (!latestUpdate || date > latestUpdate)) latestUpdate = date;
  }
  if (!latestUpdate) return "N/A";

  return latestUpdate.toLocaleString("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// 🔥 CD3 Recharts 전용 Formatter 함수들
// Recharts tickFormatter 시그니처: (value: any, index: number) => string

/**
 * Recharts용 숫자 formatter (Korean format)
 * @param value - Chart value (usually number)
 * @param index - Tick index (ignored)
 * @returns Formatted string
 */
export function formatNumberForChart(value: number): string {
  if (typeof value !== "number") return String(value);
  return formatNumber(value);
}

/**
 * Recharts용 Raw 숫자 formatter
 * @param value - Chart value (usually number)
 * @param index - Tick index (ignored)
 * @returns Raw number string
 */
export function formatNumberRawForChart(value: number): string {
  if (typeof value !== "number") return String(value);
  return formatNumberRaw(value);
}

/**
 * Recharts용 퍼센트 formatter
 * @param value - Chart value (usually number)
 * @returns Formatted percentage string
 */
export function formatNumberPercentForChart(value: number): string {
  if (typeof value !== "number") return String(value);
  return formatNumberPercent(value);
}

/**
 * Recharts용 비율 formatter
 * @param value - Chart value (usually number)
 * @returns Formatted ratio string
 */
export function formatNumberRatioForChart(value: number): string {
  if (typeof value !== "number") return String(value);
  return formatNumberRatio(value);
}

/**
 * Recharts 전용 formatter 함수 맵
 * 모든 차트 컴포넌트에서 일관성 있게 사용
 */
export const formatFunctionMapForChart = {
  formatNumber: formatNumberForChart,
  formatNumberRaw: formatNumberRawForChart,
  formatNumberPercent: formatNumberPercentForChart,
  formatNumberRatio: formatNumberRatioForChart,
};

/**
 * 시가총액 전용 포맷 함수 - 큰 금액에 대해 조, 백조 단위 표시
 */
export function formatMarketcapWithUnit(num: BusinessValue | undefined): { main: string; unit: string; detail: string } {
  const formatted = formatNumberWithSeparateUnit(num);
  return { main: formatted.number, unit: formatted.number === "—" ? "" : `${formatted.unit}원`, detail: formatted.number === "—" ? "" : `${formatBusinessValue(num)}원` };
}

export function formatNumberWithSeparateUnit(num: BusinessValue | undefined): { number: string; unit: string } {
  const value = formatCompactBusinessValue(num);
  const match = value.match(/^(.*?)(백만|조|억|만|천)$/);
  return match ? { number: match[1], unit: match[2] } : { number: value, unit: "" };
}

/**
 * Format change rate with appropriate color coding
 */
export function formatChangeRate(rate: number | null | undefined): { value: string; color: string } {
  if (rate === null || rate === undefined || Number.isNaN(rate)) {
    return { value: "—", color: "text-gray-500" };
  }

  const sign = rate > 0 ? "+" : "";
  const value = `${sign}${rate.toFixed(1)}%`;

  if (rate > 0) return { value, color: "text-red-600" };
  if (rate < 0) return { value, color: "text-blue-600" };
  return { value, color: "text-gray-500" };
}

/**
 * Format difference with appropriate color coding
 */
export function formatDifference(diff: number | null | undefined): { value: string; color: string } {
  if (diff === null || diff === undefined || Number.isNaN(diff)) {
    return { value: "—", color: "text-gray-500" };
  }

  const formatted = formatNumberWithSeparateUnit(Math.abs(diff));
  const sign = diff > 0 ? "+" : diff < 0 ? "-" : "";
  const value = `${sign}${formatted.number}${formatted.unit}`;

  if (diff > 0) return { value, color: "text-red-600" };
  if (diff < 0) return { value, color: "text-blue-600" };
  return { value, color: "text-gray-500" };
}

/**
 * Recharts Y축용 초간단 formatter (공간 절약)
 * @param value - Chart value (usually number)
 * @returns Very short formatted string
 */
export function formatNumberCompactForChart(value: number): string {
  if (typeof value !== "number") return String(value);
  if (value === 0) return "0";

  // 음수 처리
  const isNegative = value < 0;
  const absValue = Math.abs(value);

  // 조 (Trillion)
  if (absValue >= 1_000_000_000_000) {
    const trillion = absValue / 1_000_000_000_000;
    return `${isNegative ? '-' : ''}${trillion >= 10 ? trillion.toFixed(0) : trillion.toFixed(1)}조`;
  }

  // 억 (Hundred Million)  
  if (absValue >= 100_000_000) {
    const hundredMillion = absValue / 100_000_000;
    return `${isNegative ? '-' : ''}${hundredMillion >= 10 ? hundredMillion.toFixed(0) : hundredMillion.toFixed(1)}억`;
  }

  // 만 (Ten Thousand)
  if (absValue >= 10_000) {
    const tenThousand = absValue / 10_000;
    return `${isNegative ? '-' : ''}${tenThousand >= 10 ? tenThousand.toFixed(0) : tenThousand.toFixed(1)}만`;
  }

  // 천 (Thousand)
  if (absValue >= 1_000) {
    const thousand = absValue / 1_000;
    return `${isNegative ? '-' : ''}${thousand >= 10 ? thousand.toFixed(0) : thousand.toFixed(1)}천`;
  }

  return `${isNegative ? '-' : ''}${absValue}`;
}
