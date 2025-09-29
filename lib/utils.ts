import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumberRaw(num: number) {
  if (num === 0) return "";
  return `${num}`;
}

export function formatNumberRatio(num: number) {
  if (num === 0) return "";

  if (num > 1000) {
    return `${num.toFixed(0)}배`;
  }

  return `${num}배`;
}

export function formatNumberPercent(num: number) {
  if (num === 0) return "";

  if (num > 1000) {
    return `${num.toFixed(0)}%`;
  }

  return `${num}%`;
}

/**
 * Format a number with customizable output including optional units
 * Follows CD3 formatting standards for Korean audience
 *
 * @param num - Number to format
 * @param unit - Optional unit to append (e.g., '%', '원', '억원')
 * @param digits - Number of decimal digits (default: determined automatically)
 * @returns Formatted string
 */
export function formatNumber(
  num: number | null | undefined,
  unit?: string,
  digits?: number
): string {
  if (num === null || num === undefined || Number.isNaN(num)) return "-";
  if (num === 0) return unit ? `0${unit}` : "0";

  if (Math.abs(num) < 1) {
    const d = digits !== undefined ? digits : 2;
    return `${num.toFixed(d)}${unit || ""}`;
  }

  if (Math.abs(num) < 100_000) {
    const d = digits !== undefined ? digits : (Math.abs(num) >= 10_000 ? 0 : 1);
    return `${(num / 1000).toFixed(d)}천${unit || ""}`;
  }

  if (Math.abs(num) < 1_000_000) {
    const d = digits !== undefined ? digits : (Math.abs(num) >= 100_000 ? 0 : 1);
    return `${(num / 10_000).toFixed(d)}만${unit || ""}`;
  }

  // 백만 (Million)
  if (Math.abs(num) < 100_000_000) {
    const d = digits !== undefined ? digits : (Math.abs(num) >= 10_000_000 ? 0 : 1);
    return `${(num / 1_000_000).toFixed(d)}백만${unit || ""}`;
  }

  // 억 (Hundred Million)
  if (Math.abs(num) < 1_000_000_000_000) {
    const d = digits !== undefined ? digits : (Math.abs(num) >= 10_000_000_000 ? 0 : 1);
    return `${(num / 100_000_000).toFixed(d)}억${unit || ""}`;
  }

  // 조 (Trillion)
  const d = digits !== undefined ? digits : (Math.abs(num) >= 10_000_000_000_000 ? 0 : 1);
  return `${(num / 1_000_000_000_000).toFixed(d)}조${unit || ""}`;
}

export function formatNumberBPS(num: number) {
  if (num === 0) return "";

  if (num < 1) {
    return `0`;
  }

  if (num < 1_000_000) {
    return `${num.toLocaleString()}`;
  }

  if (num < 100_000_000) {
    return `${(num / 10_000).toFixed(num >= 100_000 ? 0 : 1)}만`;
  }
}

export function formatNumberTooltip(num: number) {
  if (num === 0) return "";

  if (num < 100_000) {
    return `${num.toLocaleString()}원`;
  }

  if (num < 1_000_000) {
    return `${(num / 10_000).toFixed(num >= 100_000 ? 0 : 1)}만원`;
  }

  // 백만 (Million)
  if (num < 100_000_000) {
    return `${(num / 1_000_000).toFixed(num >= 10_000_000 ? 0 : 1)}백만원`;
  }

  // 억 (Hundred Million)
  if (num < 1_000_000_000_000) {
    return `${(num / 100_000_000).toFixed(num >= 100_000_000 ? 0 : 1)}억원`;
  }

  // 조 (Trillion)
  return `${(num / 1_000_000_000_000).toFixed(
    num > 10_000_000_000_000 ? 0 : 1
  )}조원`;
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
    return date.toLocaleDateString(locale, options);
  } catch {
    return date.toISOString().split("T")[0]; // Fallback to ISO date
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
  const date = safeDateConvert(dateInput);
  if (!date) return null;

  try {
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
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
    const { year = 'numeric', month = 'short', includeDay = true } = options;

    // Korean month names
    const koreanMonths = {
      long: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
      short: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
      narrow: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
    };

    const monthIndex = date.getMonth();
    let monthName: string;

    if (month === 'numeric') {
      monthName = `${monthIndex + 1}월`;
    } else {
      monthName = koreanMonths[month as keyof typeof koreanMonths]?.[monthIndex] || koreanMonths.short[monthIndex];
    }

    const yearStr = date.getFullYear();
    const dayStr = includeDay ? `${date.getDate()}일` : '';

    return `${yearStr}년 ${monthName}${dayStr}`.trim();
  } catch {
    return date.toISOString().split("T")[0];
  }
}

// Date processing utilities for market data
export function getLatestDateFromMarketData(data: any[]): string {
  if (
    data.length > 0 &&
    data[0].securities?.length > 0 &&
    data[0].securities[0].prices?.length > 0
  ) {
    const latestPrice =
      data[0].securities[0].prices[
      data[0].securities[0].prices.length - 1
      ];
    return new Date(latestPrice.date).toISOString().split("T")[0];
  }
  return "N/A";
}

export function getUpdatedDateFromMarketData(data: any[]): string {
  if (
    data.length > 0 &&
    data[0].securities?.length > 0 &&
    data[0].securities[0].prices?.length > 0
  ) {
    const latestPrice =
      data[0].securities[0].prices[
      data[0].securities[0].prices.length - 1
      ];
    const date = new Date(latestPrice.updatedAt);
    date.setHours(date.getHours() + 9); // KST timezone adjustment
    return date.toISOString().replace(/T/, " ").replace(/\.\d{3}Z$/, "");
  }
  return "N/A";
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
export function formatMarketcapWithUnit(
  num: number | null | undefined
): { main: string; unit: string; detail: string } {
  if (num === null || num === undefined || Number.isNaN(num))
    return { main: "-", unit: "", detail: "" };
  if (num === 0)
    return { main: "0", unit: "원", detail: "" };

  // 조 (Trillion) 단위
  if (Math.abs(num) >= 1_000_000_000_000) {
    const trillion = num / 1_000_000_000_000;
    if (Math.abs(trillion) >= 100) {
      // 백조 이상
      const hundredTrillion = trillion / 100;
      return {
        main: hundredTrillion.toFixed(hundredTrillion >= 10 ? 0 : 1),
        unit: "백조원",
        detail: `(${trillion.toFixed(0)}조원)`
      };
    } else {
      // 조 단위
      return {
        main: trillion.toFixed(trillion >= 10 ? 0 : 1),
        unit: "조원",
        detail: num.toLocaleString() + "원"
      };
    }
  }

  // 억 (Hundred Million) 단위
  if (Math.abs(num) >= 100_000_000) {
    const hundredMillion = num / 100_000_000;
    return {
      main: hundredMillion.toFixed(hundredMillion >= 10 ? 0 : 1),
      unit: "억원",
      detail: num.toLocaleString() + "원"
    };
  }

  // 그 외는 기본 포맷
  return {
    main: num.toLocaleString(),
    unit: "원",
    detail: ""
  };
}

/**
 * Format number with separate unit for compact display in cards
 */
export function formatNumberWithSeparateUnit(num: number | null | undefined): { number: string; unit: string } {
  if (num === null || num === undefined || Number.isNaN(num)) return { number: "—", unit: "" };
  if (num === 0) return { number: "0", unit: "" };

  if (Math.abs(num) < 1) {
    return { number: num.toFixed(2), unit: "" };
  }

  if (Math.abs(num) < 100_000) {
    const d = Math.abs(num) >= 10_000 ? 0 : 1;
    return { number: (num / 1000).toFixed(d), unit: "천" };
  }

  if (Math.abs(num) < 1_000_000) {
    const d = Math.abs(num) >= 100_000 ? 0 : 1;
    return { number: (num / 10_000).toFixed(d), unit: "만" };
  }

  // 백만 (Million)
  if (Math.abs(num) < 100_000_000) {
    const d = Math.abs(num) >= 10_000_000 ? 0 : 1;
    return { number: (num / 1_000_000).toFixed(d), unit: "백만" };
  }

  // 억 (Hundred Million)
  if (Math.abs(num) < 1_000_000_000_000) {
    const d = Math.abs(num) >= 10_000_000_000 ? 0 : 1;
    return { number: (num / 100_000_000).toFixed(d), unit: "억" };
  }

  // 조 (Trillion)
  const d = Math.abs(num) >= 10_000_000_000_000 ? 0 : 1;
  return { number: (num / 1_000_000_000_000).toFixed(d), unit: "조" };
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
  const sign = diff > 0 ? "+" : "-";
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
