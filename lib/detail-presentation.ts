import { businessChangePercent, compareBusinessValues, isBusinessDay, subtractBusinessValues, summarizeBusinessWindow, type BusinessObservation, type BusinessValue } from './business-analysis';

export type DetailMetric = 'marketcap' | 'per' | 'pbr' | 'bps' | 'eps' | 'div' | 'dps';
export const DETAIL_METRICS: Record<DetailMetric, { label: string; name: string; unit: string; formula: string }> = {
  marketcap: { label: '시가총액', name: '시가총액', unit: '원', formula: '시가총액 = 주가 × 발행주식 수' },
  per: { label: 'PER', name: '주가수익비율', unit: '배', formula: 'PER = 주가 ÷ 주당순이익(EPS)' },
  pbr: { label: 'PBR', name: '주가순자산비율', unit: '배', formula: 'PBR = 주가 ÷ 주당순자산(BPS)' },
  bps: { label: 'BPS', name: '주당순자산가치', unit: '원', formula: 'BPS = 순자산 ÷ 발행주식 수' },
  eps: { label: 'EPS', name: '주당순이익', unit: '원', formula: 'EPS = 순이익 ÷ 발행주식 수' },
  div: { label: 'DIV', name: '배당수익률', unit: '%', formula: 'DIV = 주당배당금 ÷ 주가 × 100' },
  dps: { label: 'DPS', name: '주당배당금', unit: '원', formula: 'DPS는 주식 한 주에 제공된 배당금입니다.' },
};
export type DetailObservation = BusinessObservation & {
  observedCount?: number; targetCount?: number; observedSecurityIds?: string[]; partial?: boolean; providedCount?: number; yearToDate?: boolean; yearEnd?: boolean;
};
export type AnnualComparisonReason = 'no_previous_year' | 'non_adjacent_year' | 'missing_previous' | 'missing_current' | 'cohort_changed' | 'non_positive_previous';
export type DetailAnnualRow = DetailObservation & { changeRate?: number; difference?: string; comparisonReason?: AnnualComparisonReason };
export function sourceValue(value: unknown): BusinessValue {
  return typeof value === 'string' || typeof value === 'number' && Number.isFinite(value) ? value : null;
}
export function detailObservations(rows: readonly Record<string, unknown>[], metric: DetailMetric): DetailObservation[] {
  return rows.flatMap(row => {
    if (typeof row.date !== 'string' || !isBusinessDay(row.date)) return [];
    const state = typeof row[`${metric}State`] === 'string' ? String(row[`${metric}State`]) : undefined;
    return [{ date: row.date, value: state && state !== 'provided' ? null : sourceValue(row[metric]), state }];
  }).sort((a, b) => a.date.localeCompare(b.date));
}
export function earlierDate(end: string, months: number) {
  const date = new Date(`${end}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return '';
  const day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}
export function selectDetailRange(rows: readonly DetailObservation[], start?: string, end?: string) {
  return rows.filter(row => (!start || row.date >= start) && (!end || row.date <= end));
}
export function detailAnnualRows(rows: readonly DetailObservation[], metric: DetailMetric = 'marketcap'): DetailAnnualRow[] {
  const years = new Map<string, DetailObservation>();
  for (const row of rows) if (metric !== 'bps' || row.date.slice(5, 7) === '12') {
    const year = row.date.slice(0, 4);
    if (!years.has(year) || years.get(year)!.date < row.date) years.set(year, row);
  }
  const ordered = [...years.values()].sort((a, b) => a.date.localeCompare(b.date));
  return ordered.map((row, index) => {
    const prior = ordered[index - 1];
    const sameCoverage = !row.observedSecurityIds && !prior?.observedSecurityIds
      || Boolean(prior && JSON.stringify([...(row.observedSecurityIds ?? [])].sort()) === JSON.stringify([...(prior.observedSecurityIds ?? [])].sort()));
    const adjacent = prior && Number(row.date.slice(0, 4)) - Number(prior.date.slice(0, 4)) === 1;
    const priorComparison = prior && (!prior.state || prior.state === 'provided') ? compareBusinessValues(prior.value, 0) : null;
    const currentComparison = !row.state || row.state === 'provided' ? compareBusinessValues(row.value, 0) : null;
    const comparisonReason: AnnualComparisonReason | undefined = !prior ? 'no_previous_year'
      : !adjacent ? 'non_adjacent_year'
        : !sameCoverage ? 'cohort_changed'
          : priorComparison == null ? 'missing_previous'
            : currentComparison == null ? 'missing_current'
              : priorComparison <= 0 ? 'non_positive_previous' : undefined;
    const rate = prior && !comparisonReason ? businessChangePercent(prior.value, row.value) : null;
    const difference = prior && comparisonReason === 'non_positive_previous' ? subtractBusinessValues(row.value, prior.value) ?? undefined : undefined;
    return { ...row, yearEnd: row.date.slice(5,7) === '12', yearToDate: row.date.slice(5,7) !== '12' && row.date.slice(0,4) === ordered.at(-1)?.date.slice(0,4), changeRate: rate == null ? undefined : Number(rate), difference, comparisonReason };
  }).reverse();
}
export function periodMeans(rows: readonly DetailObservation[], end: string) {
  return [12, 36, 60, 120, 240].map(months => ({
    label: months === 12 ? '12개월 평균' : `${months / 12}년 평균`,
    ...summarizeBusinessWindow(selectDetailRange(rows, earlierDate(end, months), end)),
  }));
}
export function monthlyHeatmap(rows: readonly DetailObservation[]) {
  const months = new Map<string, DetailObservation>();
  for (const row of rows) if (row.value != null) months.set(row.date.slice(0, 7), row);
  return Array.from({ length: 12 }, (_, index) => ({
    id: `${index + 1}월`,
    data: [...months.values()].filter(row => Number(row.date.slice(5, 7)) === index + 1 && row.value != null)
      .map(row => ({ x: row.date.slice(0, 4), y: Number(row.value) })).filter(row => Number.isFinite(row.y)),
  })).filter(month => month.data.length);
}
export function aggregateDetailRows(rows: readonly DetailObservation[], period: 'month' | 'year') {
  const groups = new Map<string, DetailObservation[]>();
  for (const row of rows) {
    const key = row.date.slice(0, period === 'year' ? 4 : 7);
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({
    date: group.at(-1)!.date,
    periodLabel: key,
    value: summarizeBusinessWindow(group).mean,
    providedCount: summarizeBusinessWindow(group).count,
  }));
}
export type DetailCandle = { time: string; open: number; high: number; low: number; close: number; volume: BusinessValue; source?: {open: BusinessValue; high: BusinessValue; low: BusinessValue; close: BusinessValue; volume: BusinessValue}; warmupOnly?: boolean };
export function actualCandlesticks(rows: readonly Record<string, unknown>[], start?: string, end?: string): DetailCandle[] {
  const candles = rows.flatMap(row => {
    const { open, high, low, close, date } = row;
    if (typeof date !== 'string' || !isBusinessDay(date) || ![open, high, low, close].every(value => sourceValue(value) != null && Number.isFinite(Number(value)))) return [];
    if (Number(high) < Math.max(Number(open), Number(close)) || Number(low) > Math.min(Number(open), Number(close))) return [];
    return [{ time: date, open: Number(open), high: Number(high), low: Number(low), close: Number(close), volume: sourceValue(row.volume), source: {open: sourceValue(open),high:sourceValue(high),low:sourceValue(low),close:sourceValue(close),volume:sourceValue(row.volume)} }];
  }).sort((a, b) => a.time.localeCompare(b.time)).filter(row => !end || row.time <= end);
  const first = start ? candles.findIndex(row => row.time >= start) : 0;
  if (first < 0) return [];
  return candles.slice(Math.max(0, first - 9)).map(row => ({ ...row, warmupOnly: Boolean(start && row.time < start) }));
}
export function validComposition(company: { totalMarketcap: BusinessValue; totalMarketcapDate: string | null; marketcapCompleteness?: string | null; compositionComplete?: boolean; securities: Array<{ marketcap: BusinessValue; marketcapDate: string | null }> }) {
  return company.compositionComplete === true && company.marketcapCompleteness === 'complete'
    && company.totalMarketcap != null && (compareBusinessValues(company.totalMarketcap, 0) ?? 0) > 0
    && company.securities.length > 0 && company.securities.every(row => row.marketcap != null && row.marketcapDate === company.totalMarketcapDate);
}

export function priceMovingAverages(rows: readonly Record<string, unknown>[], start?: string, end?: string) {
  const ordered = rows.filter(row => typeof row.date === 'string' && isBusinessDay(row.date)).sort((a,b) => String(a.date).localeCompare(String(b.date)));
  return ordered.map((row,index) => {
    const mean = (period: number) => {
      const window = ordered.slice(Math.max(0,index-period+1),index+1).map(row => ({date:String(row.date),value:sourceValue(row.close)}));
      const summary = summarizeBusinessWindow(window);
      return window.length === period && summary.count === period ? summary.mean : null;
    };
    return {date:String(row.date),value:sourceValue(row.close),average5:mean(5),average10:mean(10)};
  }).filter(row => (!start || row.date >= start) && (!end || row.date <= end));
}
