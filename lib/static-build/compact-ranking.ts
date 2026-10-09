import type { RankingScope } from '@/lib/ranking-view';

type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === 'object' ? value as Row : {};
const pick = (value: Row, keys: readonly string[]): Row => Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));
const identity = ['securityId', 'companyId', 'name', 'korName', 'exchange', 'ticker', 'type', 'routeCode'];

function prices(value: unknown) {
  return Array.isArray(value) ? value.map(record).map(row => pick(row, ['date', 'close', 'open', 'rate', 'volume'])) : [];
}

/** Retain the exact inputs to createRankingRows, excluding raw provider/audit fields. */
export function compactRankingItems(items: readonly unknown[], scope: RankingScope) {
  return items.map(value => {
    const row = record(value);
    if (scope === 'security') return {
      ...pick(row, [...identity, 'currentRank', 'priorRank', 'value', 'valueObservedAt']), prices: prices(row.prices),
    };
    const representative = row.representativeSecurity == null ? null : record(row.representativeSecurity);
    return {
      ...pick(row, ['companyId', 'name', 'korName', 'routeCode', 'marketcap', 'marketcapRank', 'marketcapPriorRank', 'marketcapDate', 'marketcapCompleteness']),
      representativeSecurity: representative ? { ...pick(representative, identity), prices: prices(representative.prices) } : null,
      ...(Object.hasOwn(row, 'prices') ? {prices: prices(row.prices)} : {}),
    };
  });
}
