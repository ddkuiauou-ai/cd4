/** Screen analysis of the fixed set of currently connected securities. */
export interface RegisteredMarketcapObservation {
  securityId: string | null;
  date: string;
  marketcap: string | bigint | null;
}

export interface RegisteredCompanyObservation {
  date: string;
  totalMarketcap: string | null;
  securitiesBreakdown: Record<string, string | null>;
  observedCount: number;
  targetCount: number;
  observedSecurityIds: string[];
  partial: boolean;
}

export function aggregateRegisteredCompanyHistory(
  securityIds: readonly string[], observations: readonly RegisteredMarketcapObservation[],
  knownDates: readonly string[] = [],
): RegisteredCompanyObservation[] {
  const ids = [...new Set(securityIds)].sort();
  const wanted = new Set(ids);
  const dates = new Map<string, Map<string, string>>(knownDates.map(date => [date, new Map()]));
  for (const row of observations) {
    if (!row.securityId || !wanted.has(row.securityId)) continue;
    const values = dates.get(row.date) ?? new Map<string, string>();
    dates.set(row.date, values);
    if (row.marketcap == null) continue;
    if (!/^\d+$/.test(String(row.marketcap))) throw new Error("시가총액 이력은 정확한 비음수 정수여야 합니다.");
    const value = BigInt(row.marketcap).toString();
    if (values.has(row.securityId) && values.get(row.securityId) !== value) {
      throw new Error("같은 종목·업무일의 시가총액 관측이 중복되었습니다.");
    }
    values.set(row.securityId, value);
  }
  return [...dates.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, values]) => {
    const observedSecurityIds = ids.filter(id => values.has(id));
    const total = observedSecurityIds.reduce((sum, id) => sum + BigInt(values.get(id)!), 0n);
    return { date, totalMarketcap: observedSecurityIds.length ? total.toString() : null,
      securitiesBreakdown: Object.fromEntries(ids.map(id => [id, values.get(id) ?? null])),
      observedCount: observedSecurityIds.length, targetCount: ids.length, observedSecurityIds,
      partial: observedSecurityIds.length < ids.length };
  });
}

export function exactPercentage(value: string, total: string): number | null {
  const denominator = BigInt(total);
  return denominator > 0n ? Number((BigInt(value) * 1_000_000n + denominator / 2n) / denominator) / 10_000 : null;
}
