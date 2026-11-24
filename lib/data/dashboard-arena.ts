import { existsSync } from "node:fs";
import path from "node:path";
import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import * as schema from "@/db/schema-postgres";
import { compareBusinessValues } from "@/lib/business-analysis";
import { arenaEntry, arenaMetrics, historicalRepresentative, scoreArena, type ArenaEntry, type ArenaHistory, type ArenaRankings } from "@/lib/dashboard-arena";
import { securityPath } from "@/lib/entity-paths";
import { createRankingRows, type RankingMetric } from "@/lib/ranking-view";
import { getStaticRankingManifest, isStaticBuild, readStaticJson, staticInputDirectory } from "@/lib/static-build/server";
import { businessDate } from "./dto";
import { readRecentPrices, readRouteCodes } from "./history";
import { currentRankFilter, readPublication, readSnapshot, securityRankPublicationKey, type ReadDatabase } from "./publication";

export const ARENA_HISTORY_FILE = "data/dashboard-arena-history.json";
export type ArenaHistoricalSnapshot = { anchor: string; leaders: ArenaHistory };

const financialMetrics = ["per", "pbr", "eps", "bps", "dps", "div"] as const;
const exchanges = ["KOSPI", "KOSDAQ"];

function historicalWindow(anchor: string) {
  const [year, month, day] = anchor.split("-").map(Number);
  const cutoff = new Date(Date.UTC(year - 1, month - 1, Math.min(day, new Date(Date.UTC(year - 1, month, 0)).getUTCDate())));
  const start = new Date(cutoff);
  start.setUTCDate(start.getUTCDate() - 14);
  return [start, cutoff].map(date => new Date(`${date.toISOString().slice(0, 10)}T00:00:00+09:00`));
}

export async function readArenaHistory(tx: ReadDatabase, anchor: string): Promise<ArenaHistoricalSnapshot> {
  const [start, cutoff] = historicalWindow(anchor);
  const financial = schema.bppedd;
  const capitalization = schema.marketcap;
  const stock = schema.security;
  const [financialDay] = await tx.select({ date: financial.date }).from(financial).where(and(
    gte(financial.date, start), lte(financial.date, cutoff), inArray(financial.exchange, exchanges),
  )).orderBy(desc(financial.date)).limit(1);
  const [capitalDay] = await tx.select({ date: capitalization.date }).from(capitalization).where(and(
    gte(capitalization.date, start), lte(capitalization.date, cutoff), inArray(capitalization.exchange, exchanges),
  )).orderBy(desc(capitalization.date)).limit(1);
  if (!financialDay && !capitalDay) return { anchor, leaders: {} };

  const codes = await readRouteCodes(tx);
  const leaders: ArenaHistory = {};
  function save(metric: RankingMetric, date: Date, candidates: {
    id: string; name: string; ticker: string; type: string | null; value: string | null; observedMarketcap: string | null;
  }[]) {
    const direction = metric === "per" || metric === "pbr" ? 1 : -1;
    const valid = candidates.filter(row => {
      const sign = compareBusinessValues(row.value, 0);
      return sign != null && (direction === -1 || sign > 0);
    }).sort((a, b) => direction * compareBusinessValues(a.value, b.value)! || a.id.localeCompare(b.id));
    if (!valid.length) return;
    const tied = valid.filter(row => compareBusinessValues(row.value, valid[0].value) === 0);
    const unique = new Map(tied.map(row => [row.id, row]));
    leaders[metric] = { date: businessDate(date)!, entries: [...unique.values()]
      .map(row => ({ ...row, rank: 1, href: securityPath({ securityId: row.id, routeCode: codes.get(row.id) ?? null }, metric) })) };
  }
  if (financialDay) {
    const rows = await tx.select({ id: stock.securityId, ticker: financial.ticker, type: stock.type,
      name: sql<string>`coalesce(nullif(${financial.korName}, ''), nullif(${stock.korName}, ''), nullif(${financial.name}, ''), nullif(${stock.name}, ''), ${financial.ticker})`,
      observedMarketcap: sql<string | null>`${capitalization.marketcap}::text`,
      per: sql<string | null>`${financial.per}::text`, pbr: sql<string | null>`${financial.pbr}::text`,
      eps: sql<string | null>`${financial.eps}::text`, bps: sql<string | null>`${financial.bps}::text`,
      div: sql<string | null>`${financial.div}::text`, dps: sql<string | null>`${financial.dps}::text`,
    }).from(financial).innerJoin(stock, eq(stock.securityId, financial.securityId))
      .leftJoin(capitalization, and(eq(capitalization.date, financial.date), eq(capitalization.exchange, financial.exchange),
        eq(capitalization.ticker, financial.ticker))).where(and(
      eq(financial.date, financialDay.date), inArray(financial.exchange, exchanges)));
    for (const metric of financialMetrics) save(metric, financialDay.date, rows.map(({ id, ticker, name, type, observedMarketcap, ...values }) => ({
      id, ticker, name, type, observedMarketcap, value: values[metric],
    })));
  }
  if (capitalDay) {
    const rows = await tx.select({ id: stock.securityId, ticker: capitalization.ticker, type: stock.type,
      name: sql<string>`coalesce(nullif(${capitalization.korName}, ''), nullif(${stock.korName}, ''), nullif(${capitalization.name}, ''), nullif(${stock.name}, ''), ${capitalization.ticker})`,
      value: sql<string>`${capitalization.marketcap}::text`,
    }).from(capitalization).innerJoin(stock, eq(stock.securityId, capitalization.securityId)).where(and(
      eq(capitalization.date, capitalDay.date), inArray(capitalization.exchange, exchanges)));
    save("marketcap", capitalDay.date, rows.map(row => ({ ...row, observedMarketcap: row.value })));
  }
  return { anchor, leaders };
}

function assemble(rankings: ArenaRankings, history: ArenaHistory, anchor: string) {
  const score = scoreArena(rankings, anchor);
  const past = arenaMetrics.map(metric => {
    const records = history[metric];
    const representative = historicalRepresentative(records?.entries ?? []);
    const current = representative ? rankings[metric].rows.find(row => row.id === representative.id) ?? null : null;
    return { metric, date: records?.date ?? null, currentDate: rankings[metric].date, tiedCount: records?.entries.length ?? 0,
      row: representative ? { ...representative, current } : null };
  });
  const today = arenaMetrics.map(metric => ({ metric, date: rankings[metric].date, rows: rankings[metric].rows.slice(0, 3) }));
  return { today, past, score };
}

function readFrozenArena(anchor: string) {
  const rankings = Object.fromEntries(arenaMetrics.map(metric => {
    const entry = getStaticRankingManifest(metric, "security").scopes["krx-all"];
    const rows = Object.values(entry?.pages ?? {}).flatMap(url => {
      const file = readStaticJson<{ items: unknown[] }>(`assets/${url.replace(/^\//, "")}`);
      return createRankingRows(file.items, metric, "security").flatMap(row => arenaEntry(row) ?? []);
    });
    return [metric, { date: entry?.publication?.asOf ?? null, rows }];
  })) as ArenaRankings;
  const history = existsSync(path.join(staticInputDirectory(), ARENA_HISTORY_FILE))
    ? readStaticJson<ArenaHistoricalSnapshot>(ARENA_HISTORY_FILE) : null;
  return assemble(rankings, history?.anchor === anchor ? history.leaders : {}, anchor);
}

export async function getDashboardArena(anchor: string) {
  if (isStaticBuild()) return readFrozenArena(anchor);
  return readSnapshot(async tx => {
    const headers = await Promise.all(arenaMetrics.map(async metric => [metric, await readPublication(tx, securityRankPublicationKey(metric))] as const));
    const filters = headers.flatMap(([, header]) => header ? currentRankFilter(header) ?? [] : []);
    const rank = schema.securityRank;
    const stock = schema.security;
    const rows = filters.length ? await tx.select({ metric: rank.metricType, rank: rank.currentRank, value: rank.value,
      id: stock.securityId, name: stock.name, korName: stock.korName, type: stock.type,
    }).from(rank).innerJoin(stock, eq(stock.securityId, rank.securityId)).where(or(...filters))
      .orderBy(rank.currentRank, stock.securityId) : [];
    const codes = await readRouteCodes(tx);
    const rankings = Object.fromEntries(headers.map(([metric, header]) => [metric, { date: businessDate(header?.asOf), rows: [] as ArenaEntry[] }])) as ArenaRankings;
    for (const row of rows) {
      if (row.rank == null || !Object.hasOwn(rankings, row.metric)) continue;
      const metric = row.metric as RankingMetric;
      rankings[metric].rows.push({ ...row, rank: row.rank, name: row.korName || row.name || row.id,
        href: securityPath({ securityId: row.id, routeCode: codes.get(row.id) ?? null }, metric) });
    }
    const { leaders } = await readArenaHistory(tx, anchor);
    const result = assemble(rankings, leaders, anchor);
    const dates = new Map<string, ArenaEntry[]>();
    function addQuotes(date: string | null, candidates: ArenaEntry[]) {
      if (date && candidates.length) dates.set(date, [...(dates.get(date) ?? []), ...candidates]);
    }
    for (const { date, rows } of result.today) addQuotes(date, rows);
    for (const { currentDate, row } of result.past) if (row?.current) addQuotes(currentDate, [row.current]);
    addQuotes(anchor, result.score.scores.map(score => score.entry));
    for (const [date, candidates] of dates) {
      const prices = await readRecentPrices(tx, candidates.map(entry => entry.id), 1, date);
      for (const entry of candidates) {
        const quote = prices[entry.id]?.at(-1);
        if (quote) entry.quote = { close: quote.close, rate: quote.rate, priceDate: quote.date, volume: quote.volume };
      }
    }
    return result;
  });
}
