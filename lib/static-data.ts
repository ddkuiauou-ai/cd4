import type { DetailMetric } from './detail-presentation';
import type { StaticDetailAssets } from './static-detail-contract';

export type StaticDataRow = Record<string, unknown>;
const inFlight = new Map<string, Promise<StaticDataRow[]>>();
const completed = new Map<string, {request: Promise<StaticDataRow[]>; rowCount: number}>();
const MAX_CACHED_TABLES = 64;
const MAX_CACHED_ROWS = 100_000;
let cachedRows = 0;

function rememberCompleted(url: string, request: Promise<StaticDataRow[]>, rows: StaticDataRow[]) {
  // A large table remains usable by its current consumer without displacing
  // every smaller history or being retained beyond the cache's row budget.
  if (rows.length > MAX_CACHED_ROWS) return;
  completed.set(url, {request, rowCount: rows.length});
  cachedRows += rows.length;
  while (completed.size > MAX_CACHED_TABLES || cachedRows > MAX_CACHED_ROWS) {
    const oldest = completed.entries().next().value;
    if (!oldest) break;
    completed.delete(oldest[0]);
    cachedRows -= oldest[1].rowCount;
  }
}

/** Decode without coercion: exact decimals, nulls and coverage objects are source data. */
export function decodeStaticTable(value: unknown): StaticDataRow[] {
  if (!value || typeof value !== 'object') throw new Error('정적 자료 형식이 올바르지 않습니다.');
  const table = value as { schemaVersion?: unknown; columns?: unknown; rows?: unknown };
  if (table.schemaVersion !== 1 || !Array.isArray(table.columns) || !Array.isArray(table.rows)
    || table.columns.some(column => typeof column !== 'string')
    || new Set(table.columns).size !== table.columns.length) throw new Error('정적 자료 형식이 올바르지 않습니다.');
  const columns = table.columns as string[];
  return table.rows.map(row => {
    if (!Array.isArray(row) || row.length !== columns.length) throw new Error('정적 자료의 열 개수가 일치하지 않습니다.');
    return Object.fromEntries(columns.map((column, index) => [column, row[index]]));
  });
}

/** Content-hashed URLs share a request across charts, navigation and downloads. */
export function loadStaticRows(url: string): Promise<StaticDataRow[]> {
  const cached = completed.get(url);
  if (cached) {
    completed.delete(url); completed.set(url, cached);
    return cached.request;
  }
  const existing = inFlight.get(url);
  if (existing) return existing;
  const request = fetch(url).then(async response => {
    if (!response.ok) throw new Error('이력 자료를 불러오지 못했습니다.');
    return decodeStaticTable(await response.json());
  });
  inFlight.set(url, request);
  // Pending requests are never evicted; failures never poison retries. Completed
  // tables use LRU limits so long browsing sessions release old decoded histories.
  void request.then(rows => {
    inFlight.delete(url);
    rememberCompleted(url, request, rows);
  }, () => { inFlight.delete(url); });
  return request;
}

/** Preserve primary row membership and states while attaching PER/PBR dependencies. */
export function combineStaticMetricRows(primary: StaticDataRow[], dependency: StaticDataRow[], field: 'eps' | 'bps') {
  const byDate = new Map(dependency.map(row => [row.date, row]));
  return primary.map(row => ({ ...row, [field]: byDate.get(row.date)?.[field] ?? null }));
}

export async function loadStaticDetailData(assets: StaticDetailAssets, metric: DetailMetric, companyPage = false) {
  const sourceUrl = companyPage ? assets.companyHistory : metric === 'marketcap' ? assets.marketcap : assets.metrics?.[metric];
  if (!sourceUrl) throw new Error('이 페이지의 이력 자료가 없습니다.');
  const dependency = metric === 'per' ? 'eps' : metric === 'pbr' ? 'bps' : null;
  const [source, prices, companyHistory, dependencyRows] = await Promise.all([
    loadStaticRows(sourceUrl),
    assets.prices ? loadStaticRows(assets.prices) : Promise.resolve([]),
    metric === 'marketcap' && assets.companyHistory ? loadStaticRows(assets.companyHistory) : Promise.resolve([]),
    dependency && assets.metrics?.[dependency] ? loadStaticRows(assets.metrics[dependency]!) : Promise.resolve([]),
  ]);
  return {
    sourceHistory: dependency ? combineStaticMetricRows(source, dependencyRows, dependency) : source,
    prices,
    companyHistory,
  };
}
