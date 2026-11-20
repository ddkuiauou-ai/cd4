import { compareBusinessValues, isBusinessDay } from '@/lib/business-analysis';
import type { DetailObservation } from '@/lib/detail-presentation';

export function lastMonthlyObservations(rows: readonly DetailObservation[]) {
  const months = new Map<string, DetailObservation>();
  for (const row of rows) {
    if (!isBusinessDay(row.date)) continue;
    const month = row.date.slice(0, 7);
    const prior = months.get(month);
    const provided = (!row.state || row.state === 'provided') && compareBusinessValues(row.value, 0) != null;
    if (prior?.value != null && (!provided || prior.date >= row.date)) continue;
    if (!provided && prior && prior.date >= row.date) continue;
    months.set(month, provided ? row : { ...row, value: null });
  }
  return months;
}

export function chartMonths(first?: string, last?: string) {
  if (!first || !last) return [];
  const monthNumber = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
  const start = monthNumber(first);
  return Array.from({ length: monthNumber(last) - start + 1 }, (_, index) => {
    const month = start + index;
    return `${String(Math.floor(month / 12)).padStart(4, '0')}-${String(month % 12 + 1).padStart(2, '0')}`;
  });
}
