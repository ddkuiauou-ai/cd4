import * as schema from "@/db/schema-postgres";
import { and, asc, desc, eq, getTableColumns, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { businessDate, toDataDTO, type DataDTO } from "./dto";
import type { SecurityListingPeriod } from "../security-lifecycle";
import type { ReadDatabase } from "./publication";
import { financialDetailMetrics, monthlyDividendHistory, readDividendReference, type DividendObservation } from '../detail-metric-availability';

export type PriceDTO = DataDTO<typeof schema.price.$inferSelect>;
export type MarketcapDTO = DataDTO<typeof schema.marketcap.$inferSelect>;

export function historyRange(start?: string, end?: string) {
  const bound = (value?: string) => {
    if (value == null) return undefined;
    if (businessDate(value) !== value) throw new Error("조회 날짜는 YYYY-MM-DD 형식이어야 합니다.");
    return new Date(`${value}T00:00:00+09:00`);
  };
  const from = bound(start), to = bound(end);
  if (from && to && from > to) throw new Error("조회 시작일은 종료일 이후일 수 없습니다.");
  return { from, to };
}


/** Default reads use the newest episode per identity. null is reserved for complete offline/static extraction. */
export function listingHistoryFilter(id: unknown, observedDate: unknown, period?: SecurityListingPeriod | null) {
  if (period === null) return undefined;
  if (period) return sql`${observedDate} >= (${period.listingDate}::timestamp AT TIME ZONE 'Asia/Seoul')
    ${period.delistingDate ? sql`AND ${observedDate} < (${period.delistingDate}::timestamp AT TIME ZONE 'Asia/Seoul')` : sql``}`;
  return sql`(NOT EXISTS (SELECT 1 FROM security_listing_period lp WHERE lp.security_id = ${id}) OR EXISTS
    (SELECT 1 FROM security_listing_period lp WHERE lp.security_id = ${id}
      AND lp.listing_date = (SELECT max(latest.listing_date) FROM security_listing_period latest WHERE latest.security_id = ${id})
      AND ${observedDate} >= (lp.listing_date::timestamp AT TIME ZONE 'Asia/Seoul')
      AND (lp.delisting_date IS NULL OR ${observedDate} < (lp.delisting_date::timestamp AT TIME ZONE 'Asia/Seoul'))))`;
}

export async function readPriceHistory(tx: ReadDatabase, securityIds: readonly string[], start?: string, end?: string, period?: SecurityListingPeriod | null) {
  if (!securityIds.length) return [];
  const { from, to } = historyRange(start, end);
  return toDataDTO(await tx.select({ ...getTableColumns(schema.price),
    open: sql<string>`${schema.price.open}::text`, high: sql<string>`${schema.price.high}::text`,
    low: sql<string>`${schema.price.low}::text`, close: sql<string>`${schema.price.close}::text`,
    advOpen: sql<string | null>`${schema.price.advOpen}::text`, advHigh: sql<string | null>`${schema.price.advHigh}::text`,
    advLow: sql<string | null>`${schema.price.advLow}::text`, advClose: sql<string | null>`${schema.price.advClose}::text`,
    advObservedAt: sql<string | null>`to_char(${schema.price.advObservedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    fvolume: sql<string | null>`${schema.price.fvolume}::text`,
  }).from(schema.price).where(and(inArray(schema.price.securityId, [...securityIds]),
    listingHistoryFilter(schema.price.securityId,schema.price.date,period), from ? gte(schema.price.date, from) : undefined, to ? lte(schema.price.date, to) : undefined)).orderBy(asc(schema.price.date)));
}

export interface AdjustedPriceRange {
  exchange: string;
  ticker: string;
  start?: string;
  end?: string;
  /** Inclusive CD observation cutoff. Omit for the latest published adjustment. */
  observedAsOf?: string;
}

export async function readAdjustedPriceHistory(tx: ReadDatabase, range: AdjustedPriceRange) {
  const { from, to } = historyRange(range.start, range.end);
  const cutoff = range.observedAsOf;
  if (cutoff !== undefined) {
    // Pass the original microseconds to PostgreSQL, including when two versions share a millisecond.
    const instant = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.exec(cutoff);
    if (!instant || businessDate(instant[1]) !== instant[1]) {
      throw new Error("관측 기준 시각에는 날짜·시각과 UTC 오프셋이 필요합니다.");
    }
  }
  const table = cutoff === undefined ? schema.price : schema.priceAdjustmentHistory;
  const observedAt = cutoff === undefined ? schema.price.advObservedAt : schema.priceAdjustmentHistory.observedAt;
  const rows = await tx.selectDistinctOn([table.date], {
    date: table.date, exchange: table.exchange, ticker: table.ticker, securityId: table.securityId,
    advOpen: sql<string>`${table.advOpen}::text`, advHigh: sql<string>`${table.advHigh}::text`,
    advLow: sql<string>`${table.advLow}::text`, advClose: sql<string>`${table.advClose}::text`,
    advSource: table.advSource,
    advObservedAt: sql<string>`to_char(${observedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  }).from(table).where(and(
    eq(table.exchange, range.exchange), eq(table.ticker, range.ticker), isNotNull(observedAt),
    cutoff === undefined ? undefined : lte(observedAt, cutoff),
    from && gte(table.date, from), to && lte(table.date, to),
  )).orderBy(asc(table.date), desc(observedAt));
  return toDataDTO(rows);
}

export async function readMarketcapHistory(tx: ReadDatabase, securityIds: readonly string[], start?: string, end?: string, period?: SecurityListingPeriod | null) {
  if (!securityIds.length) return [];
  const { from, to } = historyRange(start, end);
  return toDataDTO(await tx.query.marketcap.findMany({ where: and(inArray(schema.marketcap.securityId, [...securityIds]),
    listingHistoryFilter(schema.marketcap.securityId,schema.marketcap.date,period), from ? gte(schema.marketcap.date, from) : undefined, to ? lte(schema.marketcap.date, to) : undefined), orderBy: [asc(schema.marketcap.date)] }));
}

export async function readMetricsHistory(tx: ReadDatabase, securityId: string, start?: string, end?: string, period?: SecurityListingPeriod | null) {
  const { from, to } = historyRange(start, end);
  return toDataDTO(await tx.select({ ...getTableColumns(schema.bppedd),
    bps: sql<string | null>`${schema.bppedd.bps}::text`, per: sql<string | null>`${schema.bppedd.per}::text`,
    pbr: sql<string | null>`${schema.bppedd.pbr}::text`, eps: sql<string | null>`${schema.bppedd.eps}::text`,
    div: sql<string | null>`${schema.bppedd.div}::text`, dps: sql<string | null>`${schema.bppedd.dps}::text`,
  }).from(schema.bppedd).where(and(eq(schema.bppedd.securityId, securityId),
    listingHistoryFilter(schema.bppedd.securityId,schema.bppedd.date,period), from ? gte(schema.bppedd.date, from) : undefined, to ? lte(schema.bppedd.date, to) : undefined)).orderBy(asc(schema.bppedd.date)));
}

/** Load exact same-day sibling observations without adding daily history to the detail payload. */
export async function readDetailDividendReferences(tx: ReadDatabase, securityIds: string[], date: string) {
  const { from } = historyRange(date, date);
  const table = schema.bppedd;
  const metrics = await tx.select({
    securityId: table.securityId, date: table.date, dpsState: table.dpsState, divState: table.divState,
    dps: sql<string | null>`${table.dps}::text`, div: sql<string | null>`${table.div}::text`,
  }).from(table).where(and(inArray(table.securityId, securityIds), eq(table.date, from!),
    listingHistoryFilter(table.securityId, table.date)));
  const prices = await readPriceHistory(tx, securityIds, date, date);
  const rows = toDataDTO(metrics);
  return new Map(securityIds.map(id => [id, readDividendReference(date, null,
    rows.filter(row => row.securityId === id), prices.filter(row => row.securityId === id))]));
}

interface DetailHistorySelection {
  securityId: string;
  period?: SecurityListingPeriod | null;
  cutoff?: string;
}

function detailHistorySelections(selections: readonly DetailHistorySelection[]) {
  return sql.join(selections.map(({ securityId, period, cutoff }) => sql`(${securityId}::text,
    ${period?.listingDate ?? null}::date, ${period?.delistingDate ?? null}::date, ${cutoff ?? null}::date)`), sql`, `);
}

export async function readDetailFinancialAvailability(tx: ReadDatabase, selections: readonly DetailHistorySelection[]) {
  const bySecurity = new Map<string, (typeof financialDetailMetrics)[number][]>();
  if (!selections.length) return bySecurity;
  const columns = financialDetailMetrics.map(metric => sql`bool_or(b.${sql.identifier(`${metric}_state`)} = 'provided'
      AND b.${sql.identifier(metric)} IS NOT NULL) AS ${sql.identifier(metric)}`);
  const rows = await tx.execute<{ securityId: string } & Partial<Record<(typeof financialDetailMetrics)[number], boolean>>>(sql`
    WITH wanted(security_id, listing_date, delisting_date, cutoff) AS (VALUES ${detailHistorySelections(selections)})
    SELECT w.security_id AS "securityId", ${sql.join(columns, sql`, `)}
    FROM wanted w JOIN bppedd b ON b.security_id = w.security_id
      AND (w.listing_date IS NULL OR b.date >= (w.listing_date::timestamp AT TIME ZONE 'Asia/Seoul'))
      AND (w.delisting_date IS NULL OR b.date < (w.delisting_date::timestamp AT TIME ZONE 'Asia/Seoul'))
      AND (w.cutoff IS NULL OR b.date <= (w.cutoff::timestamp AT TIME ZONE 'Asia/Seoul'))
    GROUP BY w.security_id`);
  for (const row of rows) bySecurity.set(row.securityId, financialDetailMetrics.filter(metric => row[metric]));
  return bySecurity;
}

/** Limit each member/metric to the actual final supplied row of each recent month. */
export async function readDetailDividendHistory(tx: ReadDatabase, selections: readonly DetailHistorySelection[]) {
  const bySecurity = new Map<string, DividendObservation[]>();
  if (!selections.length) return bySecurity;
  const rows = await tx.execute<{ securityId: string; date: Date | string; metric: 'div' | 'dps'; value: string }>(sql`
    WITH wanted(security_id, listing_date, delisting_date, cutoff) AS (VALUES ${detailHistorySelections(selections)}),
    observed AS (
      SELECT w.security_id, (b.date AT TIME ZONE 'Asia/Seoul')::date AS date, w.cutoff,
        metric.name, metric.value
      FROM wanted w JOIN bppedd b ON b.security_id = w.security_id
        AND b.date >= coalesce(greatest(w.listing_date::timestamp, w.cutoff - interval '5 years') AT TIME ZONE 'Asia/Seoul', '-infinity'::timestamptz)
        AND b.date < coalesce(w.delisting_date::timestamp AT TIME ZONE 'Asia/Seoul', 'infinity'::timestamptz)
        AND b.date <= coalesce(w.cutoff::timestamp AT TIME ZONE 'Asia/Seoul', 'infinity'::timestamptz)
      CROSS JOIN LATERAL (VALUES ('div', b.div, b.div_state), ('dps', b.dps, b.dps_state)) AS metric(name, value, state)
      WHERE metric.state = 'provided' AND metric.value IS NOT NULL
    ), bounded AS (
      SELECT *, coalesce(cutoff, max(date) OVER (PARTITION BY security_id)) AS anchor FROM observed
    )
    SELECT DISTINCT ON (security_id, date_trunc('month', date::timestamp), name)
      security_id AS "securityId", to_char(date, 'YYYY-MM-DD') AS date, name AS metric, value::text AS value
    FROM bounded WHERE date >= anchor - interval '5 years'
    ORDER BY security_id, date_trunc('month', date::timestamp), name, bounded.date DESC`);
  const samples = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const values = samples.get(row.securityId) ?? [];
    values.push({ date: businessDate(row.date), [row.metric]: row.value });
    samples.set(row.securityId, values);
  }
  for (const {securityId, cutoff} of selections) bySecurity.set(securityId, monthlyDividendHistory(samples.get(securityId) ?? [], cutoff));
  return bySecurity;
}

/** Limit at the database per security, rather than reading all history and slicing in JS. */
export async function readRecentPrices(tx: ReadDatabase, securityIds: readonly string[], count = 30, asOf?: string | null) {
  const ids = [...new Set(securityIds)];
  if (!ids.length) return {} as Record<string, PriceDTO[]>;
  const limit = Number.isSafeInteger(count) && count > 0 ? count : 30;
  const { to } = historyRange(undefined, asOf ?? undefined);
  const rows = await tx.execute<{
    id: number; securityId: string; date: Date | string; ticker: string; exchange: string; sourceRef: string;
    name: string | null; korName: string | null; open: string; high: string; low: string; close: string;
    advOpen: string | null; advHigh: string | null; advLow: string | null; advClose: string | null;
    advSource: string | null; advObservedAt: string | null;
    volume: string; fvolume: string | null; transaction: string | null; rate: number | null;
    year: number; month: number; createdAt: Date | string; updatedAt: Date | string;
  }>(sql`SELECT p.id, p.security_id AS "securityId", p.date, p.ticker, p.exchange,
    p.source_ref AS "sourceRef", p.name, p.kor_name AS "korName", p.open::text AS open, p.high::text AS high,
    p.low::text AS low, p.close::text AS close, p.volume::text AS volume, p.fvolume::text AS fvolume,
    p.transaction::text AS transaction, p.rate,
    p.adv_open::text AS "advOpen", p.adv_high::text AS "advHigh", p.adv_low::text AS "advLow", p.adv_close::text AS "advClose",
    p.adv_source AS "advSource", to_char(p.adv_observed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "advObservedAt",
    p.year, p.month, p.created_at AS "createdAt", p.updated_at AS "updatedAt"
    FROM unnest(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[]) AS wanted(security_id)
    CROSS JOIN LATERAL (SELECT * FROM price WHERE security_id = wanted.security_id ${to ? sql`AND date <= ${to.toISOString()}::timestamptz` : sql``}
      AND ${listingHistoryFilter(sql`wanted.security_id`,sql`date`)}
      ORDER BY date DESC LIMIT ${limit}) p ORDER BY p.security_id, p.date`);
  const grouped: Record<string, PriceDTO[]> = {};
  for (const row of rows) {
    const dto = { ...toDataDTO(row), date: businessDate(row.date)! } as PriceDTO;
    (grouped[row.securityId] ??= []).push(dto);
  }
  return grouped;
}

const routeCodesBySnapshot = new WeakMap<ReadDatabase, Promise<Map<string, string | null>>>();

async function queryRouteCodes(tx: ReadDatabase) {
  const rows = await tx.query.security.findMany({ columns: { securityId: true, exchange: true, ticker: true },
    orderBy: [asc(schema.security.securityId)] });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const code = `${row.exchange}.${row.ticker}`;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return new Map(rows.map(row => { const code = `${row.exchange}.${row.ticker}`;
    return [row.securityId, counts.get(code) === 1 ? code : null] as const; }));
}

export function readRouteCodes(tx: ReadDatabase) {
  let result = routeCodesBySnapshot.get(tx);
  if (!result) { result = queryRouteCodes(tx); routeCodesBySnapshot.set(tx, result); }
  return result;
}
