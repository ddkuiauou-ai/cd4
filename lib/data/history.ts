import * as schema from "@/db/schema-postgres";
import { and, asc, eq, getTableColumns, gte, inArray, lte, sql } from "drizzle-orm";
import { businessDate, toDataDTO, type DataDTO } from "./dto";
import type { ReadDatabase } from "./publication";

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

export async function readPriceHistory(tx: ReadDatabase, securityIds: readonly string[], start?: string, end?: string) {
  if (!securityIds.length) return [];
  const { from, to } = historyRange(start, end);
  return toDataDTO(await tx.select({ ...getTableColumns(schema.price),
    open: sql<string>`${schema.price.open}::text`, high: sql<string>`${schema.price.high}::text`,
    low: sql<string>`${schema.price.low}::text`, close: sql<string>`${schema.price.close}::text`,
    fvolume: sql<string | null>`${schema.price.fvolume}::text`,
  }).from(schema.price).where(and(inArray(schema.price.securityId, [...securityIds]),
    from ? gte(schema.price.date, from) : undefined, to ? lte(schema.price.date, to) : undefined)).orderBy(asc(schema.price.date)));
}

export async function readMarketcapHistory(tx: ReadDatabase, securityIds: readonly string[], start?: string, end?: string) {
  if (!securityIds.length) return [];
  const { from, to } = historyRange(start, end);
  return toDataDTO(await tx.query.marketcap.findMany({ where: and(inArray(schema.marketcap.securityId, [...securityIds]),
    from ? gte(schema.marketcap.date, from) : undefined, to ? lte(schema.marketcap.date, to) : undefined), orderBy: [asc(schema.marketcap.date)] }));
}

export async function readMetricsHistory(tx: ReadDatabase, securityId: string, start?: string, end?: string) {
  const { from, to } = historyRange(start, end);
  return toDataDTO(await tx.select({ ...getTableColumns(schema.bppedd),
    bps: sql<string | null>`${schema.bppedd.bps}::text`, per: sql<string | null>`${schema.bppedd.per}::text`,
    pbr: sql<string | null>`${schema.bppedd.pbr}::text`, eps: sql<string | null>`${schema.bppedd.eps}::text`,
    div: sql<string | null>`${schema.bppedd.div}::text`, dps: sql<string | null>`${schema.bppedd.dps}::text`,
  }).from(schema.bppedd).where(and(eq(schema.bppedd.securityId, securityId),
    from ? gte(schema.bppedd.date, from) : undefined, to ? lte(schema.bppedd.date, to) : undefined)).orderBy(asc(schema.bppedd.date)));
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
    volume: string; fvolume: string | null; transaction: string | null; rate: number | null;
    year: number; month: number; createdAt: Date | string; updatedAt: Date | string;
  }>(sql`SELECT p.id, p.security_id AS "securityId", p.date, p.ticker, p.exchange,
    p.source_ref AS "sourceRef", p.name, p.kor_name AS "korName", p.open::text AS open, p.high::text AS high,
    p.low::text AS low, p.close::text AS close, p.volume::text AS volume, p.fvolume::text AS fvolume,
    p.transaction::text AS transaction, p.rate,
    p.year, p.month, p.created_at AS "createdAt", p.updated_at AS "updatedAt"
    FROM unnest(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}]::text[]) AS wanted(security_id)
    CROSS JOIN LATERAL (SELECT * FROM price WHERE security_id = wanted.security_id ${to ? sql`AND date <= ${to.toISOString()}::timestamptz` : sql``}
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
