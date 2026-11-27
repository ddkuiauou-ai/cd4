import path from 'node:path';
import { readPrivateJsonText } from './read-private-json';

export type PrivateHistoryRow = Record<string, unknown> & { date: string };
type StoredTable = { columns: string[]; rows: unknown[][] };
export interface PrivateHistoryPart { path: string; digest: string }
export interface PrivateHistoryParts { archive: PrivateHistoryPart; current: PrivateHistoryPart; year: string }
export type PrivateHistory = Record<'prices' | 'marketcaps' | 'metrics' | 'companyMarketcaps', PrivateHistoryRow[]>;

const baseColumns = ['securityId', 'date', 'exchange', 'ticker'];
const capColumns = [...baseColumns, 'name', 'korName', 'marketcap', 'shares'];
const privateColumns: Record<keyof PrivateHistory, string[]> = {
  prices: [...baseColumns, 'open', 'high', 'low', 'close', 'volume', 'fvolume', 'transaction', 'rate'],
  marketcaps: capColumns,
  metrics: [...baseColumns, 'name', 'korName', 'bps', 'per', 'pbr', 'eps', 'div', 'dps',
    'bpsState', 'perState', 'pbrState', 'epsState', 'divState', 'dpsState'],
  companyMarketcaps: capColumns,
};

export function normalizeLegacyHistory(history: PrivateHistory): PrivateHistory {
  return Object.fromEntries(Object.entries(history).map(([key, rows]) => [key, rows.map(row =>
    Object.fromEntries(privateColumns[key as keyof PrivateHistory].map(column => [column, row[column] ?? null])))])) as PrivateHistory;
}

export function encodePrivateHistory(history: PrivateHistory) {
  return Object.fromEntries(Object.entries(history).map(([key, rows]) => {
    const columns = rows.length ? Object.keys(rows[0]) : [];
    return [key, { columns, rows: rows.map(row => columns.map(column => row[column])) }];
  }));
}

export function readPrivateHistoryPart(root: string, relative: string): PrivateHistory {
  if (!/^data\/security-history\/[0-9a-f-]+\.(archive|current)\.json$/.test(relative)) throw new Error('Invalid private history path');
  const tables: Record<string, StoredTable> = JSON.parse(readPrivateJsonText(path.join(root, relative)));
  return Object.fromEntries(Object.entries(tables).map(([key, { columns, rows }]) => {
    const template = Object.fromEntries(columns.map(column => [column, null]));
    return [key, rows.map(values => {
      const row: Record<string, unknown> = { ...template };
      for (let i = 0; i < columns.length; i++) row[columns[i]] = values[i];
      return row;
    })];
  })) as PrivateHistory;
}

export function readPrivateHistory(root: string, parts: PrivateHistoryParts): PrivateHistory {
  const old = readPrivateHistoryPart(root, parts.archive.path);
  const current = readPrivateHistoryPart(root, parts.current.path);
  return { prices: [...old.prices, ...current.prices], marketcaps: [...old.marketcaps, ...current.marketcaps],
    metrics: [...old.metrics, ...current.metrics], companyMarketcaps: [...old.companyMarketcaps, ...current.companyMarketcaps] };
}
