import { earlierDate, sourceValue, type DetailMetric } from './detail-presentation';
import { listingContains, type SecurityListingPeriod } from './security-lifecycle';

export const detailMetricOrder = ['marketcap', 'per', 'pbr', 'eps', 'bps', 'dps', 'div'] as const satisfies readonly DetailMetric[];
export const financialDetailMetrics = ['per', 'pbr', 'eps', 'bps', 'div', 'dps'] as const;
type FinancialDetailMetric = typeof financialDetailMetrics[number];
export type DividendObservation = { date: string; div: string | null; dps: string | null };

export function availableDetailMetrics(row: object, observed: Iterable<DetailMetric>, period?: SecurityListingPeriod | null, cutoff?: string) {
  const fields = row as Record<string, unknown>;
  const present = new Set(observed);
  const withinHistory = (date: unknown) => typeof date === 'string' && listingContains(period, date) && (!cutoff || date <= cutoff);
  return detailMetricOrder.filter(metric => present.has(metric)
    || (fields[`${metric}State`] === 'provided' && sourceValue(fields[metric]) != null && withinHistory(fields[`${metric}Date`]))
    || (sourceValue(fields[`${metric}LastProvided`]) != null && withinHistory(fields[`${metric}LastProvidedDate`])));
}

export function financialMetricProvided(row: Record<string, unknown>, metric: FinancialDetailMetric) {
  const state = row[`${metric}State`];
  return (state == null || state === 'provided') && sourceValue(row[metric]) != null;
}

/** A month can supply distinct dates for DPS and DIV. Keep each original date. */
export function monthlyDividendHistory(rows: readonly Record<string, unknown>[], cutoff?: string): DividendObservation[] {
  const provided = rows.filter(row => typeof row.date === 'string' && (!cutoff || row.date <= cutoff)
    && (financialMetricProvided(row, 'div') || financialMetricProvided(row, 'dps')));
  const last = cutoff ?? provided.reduce((latest, row) => String(row.date) > latest ? String(row.date) : latest, '');
  if (!last) return [];
  const start = earlierDate(last, 60);
  const months = new Map<string, { date: string; metric: 'div' | 'dps'; value: string }>();
  for (const row of provided) {
    const date = String(row.date);
    if (date < start) continue;
    for (const metric of ['div', 'dps'] as const) {
      const key = `${date.slice(0, 7)}/${metric}`;
      const selected = months.get(key);
      if (financialMetricProvided(row, metric) && (!selected || date > selected.date)) {
        months.set(key, { date, metric, value: String(row[metric]) });
      }
    }
  }
  const dates = new Map<string, DividendObservation>();
  for (const { date, metric, value } of months.values()) {
    const row = dates.get(date) ?? { date, div: null, dps: null };
    row[metric] = value;
    dates.set(date, row);
  }
  return [...dates.values()].sort((a, b) => a.date.localeCompare(b.date));
}
