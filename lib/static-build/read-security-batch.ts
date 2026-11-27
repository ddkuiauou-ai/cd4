import {filterListingRows,isolateListingValues,listingContains,selectListingPeriod} from '../security-lifecycle';
import {readSecurityLifecycles} from '../data/security-lifecycle';
import { listedSecurityPeriods } from '../data/listed-security-periods';
import * as schema from '@/db/schema-postgres';
import { and, asc, getTableColumns, gte, inArray, lte, sql } from 'drizzle-orm';
import { currentSecurity } from '../data/security';
import { currentCompany } from '../data/company';
import { businessDate, toDataDTO } from '../data/dto';
import { historyRange, readPriceHistory, readMarketcapHistory } from '../data/history';
import { isCurrentResult, type PublicationRow, type ReadDatabase } from '../data/publication';

type Security = typeof schema.security.$inferSelect;
type Company = typeof schema.company.$inferSelect;

function staticHistoryPopulation(ids: string[], from?: Date, through?: Date) {
  return (table: typeof schema.price | typeof schema.marketcap | typeof schema.bppedd) => and(
    inArray(table.securityId, ids), from && gte(table.date, from), through && lte(table.date, through),
  );
}

const historyDay = (column: unknown) => sql<string>`to_char(${column} AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')`;

async function readStaticPriceRows(tx: ReadDatabase, ids: string[], start?: string, end?: string) {
  const { from, to } = historyRange(start, end);
  const price = schema.price;
  return tx.select({ securityId: price.securityId, date: historyDay(price.date), exchange: price.exchange, ticker: price.ticker,
    open: sql<string>`${price.open}::text`, high: sql<string>`${price.high}::text`, low: sql<string>`${price.low}::text`, close: sql<string>`${price.close}::text`,
    volume: sql<string>`${price.volume}::text`, fvolume: sql<string | null>`${price.fvolume}::text`,
    transaction: sql<string | null>`${price.transaction}::text`, rate: price.rate,
  }).from(price).where(staticHistoryPopulation(ids, from, to)(price)).orderBy(asc(price.date), asc(price.exchange), asc(price.ticker));
}

async function readStaticMarketcapRows(tx: ReadDatabase, ids: string[], start?: string, end?: string) {
  const { from, to } = historyRange(start, end);
  const cap = schema.marketcap;
  return tx.select({ securityId: cap.securityId, date: historyDay(cap.date), exchange: cap.exchange, ticker: cap.ticker, name: cap.name, korName: cap.korName,
    marketcap: sql<string>`${cap.marketcap}::text`, shares: sql<string>`${cap.shares}::text`,
  }).from(cap).where(staticHistoryPopulation(ids, from, to)(cap)).orderBy(asc(cap.date), asc(cap.exchange), asc(cap.ticker));
}

async function readStaticMetricRows(tx: ReadDatabase, ids: string[], start?: string, end?: string) {
  const { from, to } = historyRange(start, end);
  const metric = schema.bppedd;
  return tx.select({ securityId: metric.securityId, date: historyDay(metric.date), exchange: metric.exchange, ticker: metric.ticker, name: metric.name, korName: metric.korName,
    bps: sql<string | null>`${metric.bps}::text`, per: sql<string | null>`${metric.per}::text`,
    pbr: sql<string | null>`${metric.pbr}::text`, eps: sql<string | null>`${metric.eps}::text`,
    div: sql<string | null>`${metric.div}::text`, dps: sql<string | null>`${metric.dps}::text`,
    bpsState: metric.bpsState, perState: metric.perState, pbrState: metric.pbrState, epsState: metric.epsState,
    divState: metric.divState, dpsState: metric.dpsState,
  }).from(metric).where(staticHistoryPopulation(ids, from, to)(metric)).orderBy(asc(metric.date), asc(metric.exchange), asc(metric.ticker));
}

type HistorySources = {
  prices: Awaited<ReturnType<typeof readStaticPriceRows>>;
  marketcaps: Awaited<ReturnType<typeof readStaticMarketcapRows>>;
  metrics: Awaited<ReturnType<typeof readStaticMetricRows>>;
};

/** Fetch only the new day's observations independently of the history decode batch size. */
export async function readDailyHistorySources(tx: ReadDatabase, ids: string[], day: string) {
  const grouped = {
    prices: new Map<string, HistorySources['prices']>(),
    marketcaps: new Map<string, HistorySources['marketcaps']>(),
    metrics: new Map<string, HistorySources['metrics']>(),
  };
  const uniqueIds = [...new Set(ids)];
  // Each query also binds the two date boundaries.
  const queryBatchSize = 10_000;
  function group<Row extends { securityId: string | null }>(records: Row[], destination: Map<string, Row[]>) {
    for (const [id, rows] of Map.groupBy(records, row => row.securityId)) {
      if (id !== null) destination.set(id, rows);
    }
  }
  for (let offset = 0; offset < uniqueIds.length; offset += queryBatchSize) {
    const batch = uniqueIds.slice(offset, offset + queryBatchSize);
    const [prices, marketcaps, metrics] = await Promise.all([
      readStaticPriceRows(tx, batch, day, day),
      readStaticMarketcapRows(tx, batch, day, day),
      readStaticMetricRows(tx, batch, day, day),
    ]);
    group(prices, grouped.prices);
    group(marketcaps, grouped.marketcaps);
    group(metrics, grouped.metrics);
  }
  return grouped;
}

export async function readObservedMarketDays(tx: ReadDatabase, from: string, through: string) {
  const { from: lower, to: upper } = historyRange(from, through);
  const rows = await tx.execute<{ day: string }>(sql`
    SELECT DISTINCT to_char(date AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS day
    FROM price
    WHERE date > ${lower!.toISOString()}::timestamptz AND date <= ${upper!.toISOString()}::timestamptz
      AND exchange IN ('KOSPI', 'KOSDAQ', 'KONEX') AND close > 0 ORDER BY day
  `);
  return rows.map(row => row.day);
}

export async function readMetricSources(tx: ReadDatabase, ids: string[], start?: string, end?: string) {
  const { from, to } = historyRange(start, end);
  const metric = schema.bppedd;
  return toDataDTO(await tx.select({ ...getTableColumns(metric),
    bps: sql<string | null>`${metric.bps}::text`, per: sql<string | null>`${metric.per}::text`,
    pbr: sql<string | null>`${metric.pbr}::text`, eps: sql<string | null>`${metric.eps}::text`,
    div: sql<string | null>`${metric.div}::text`, dps: sql<string | null>`${metric.dps}::text`,
  }).from(metric).where(and(inArray(metric.securityId, ids), from ? gte(metric.date, from) : undefined,
    to ? lte(metric.date, to) : undefined)).orderBy(asc(metric.date), asc(metric.exchange), asc(metric.ticker)));
}

export async function readBatchLifecycles(tx: ReadDatabase, ids: string[]) {
  const { periods, events } = await readSecurityLifecycles(tx, ids);
  return {
    periods: Map.groupBy(periods, row => row.securityId),
    events: Map.groupBy(events, row => row.securityId),
  };
}

/** Extract bounded source histories once per batch, using the live providers' casts and cutoffs. */
export async function readSecurityBatch(tx: ReadDatabase, rows: Security[], companies: Map<string, Company>,
  publication: PublicationRow | null, companyPublication: PublicationRow | null, routeCodes: Map<string, string | null>,
  sourceOverride?: () => Promise<HistorySources>,
  { officialOnly = false, pricesThrough, lifecycle }: {
    officialOnly?: boolean; pricesThrough?: string; lifecycle?: Awaited<ReturnType<typeof readBatchLifecycles>>;
  } = {}) {
  const ids = rows.map(row => row.securityId);
  if (!ids.length) return { items: [], historyRows: 0 };
  const asOf = publication ? businessDate(publication.asOf)! : undefined;
  const companyAsOf = businessDate((companyPublication ?? publication)?.asOf) ?? undefined;
  const reuseMarketcaps = companyAsOf === asOf || (companyAsOf !== undefined && asOf !== undefined && companyAsOf <= asOf);
  const marketcapEnd = asOf && companyAsOf ? (asOf > companyAsOf ? asOf : companyAsOf) : undefined;
  const source = sourceOverride ? await sourceOverride() : null;
  const priceEnd = pricesThrough && (!asOf || pricesThrough > asOf) ? pricesThrough : asOf;
  const [prices, allCaps, metrics] = source ? [source.prices, source.marketcaps, source.metrics] : officialOnly
    ? await Promise.all([readStaticPriceRows(tx, ids, undefined, priceEnd), readStaticMarketcapRows(tx, ids, undefined, marketcapEnd),
      readStaticMetricRows(tx, ids, undefined, asOf)])
    : await Promise.all([readPriceHistory(tx, ids, undefined, priceEnd, null), readMarketcapHistory(tx, ids, undefined, marketcapEnd, null),
      readMetricSources(tx, ids)]);
  const { periods: byPeriod, events: byEvent } = lifecycle ?? await readBatchLifecycles(tx, ids);
  const membership = listedSecurityPeriods(rows, ids.flatMap(id => byPeriod.get(id) ?? []), companyAsOf ?? null);
  const byPrice = Map.groupBy(prices, row => row.securityId);
  const byMarketcap = Map.groupBy(allCaps, row => row.securityId);
  const byMetric = Map.groupBy(metrics, row => row.securityId);
  return { historyRows: prices.length + allCaps.length + metrics.length,
    items: rows.map(row => {
      const current = isCurrentResult(row, publication);
      const company = row.companyId ? companies.get(row.companyId) : undefined;
      const sourceMetrics = byMetric.get(row.securityId) ?? [];
      const listingPeriods = byPeriod.get(row.securityId) ?? [];
      const lifecycleEvents = byEvent.get(row.securityId) ?? [];
      const selectedPeriod=selectListingPeriod(listingPeriods);
      const rawCompanyMarketcaps = byMarketcap.get(row.securityId) ?? [];
      const rankingPriceSources = byPrice.get(row.securityId) ?? [];
      const archive = { prices: asOf && pricesThrough && pricesThrough > asOf ? rankingPriceSources.filter(price => price.date <= asOf) : rankingPriceSources,
        marketcaps: asOf ? rawCompanyMarketcaps.filter(observation => observation.date <= asOf) : rawCompanyMarketcaps,
        metrics: sourceMetrics };
      const companyMarketcaps = rawCompanyMarketcaps
        .filter(observation => !companyAsOf || observation.date <= companyAsOf);
      return { securityId: row.securityId,
        security: { ...isolateListingValues(toDataDTO(currentSecurity(row, publication)),selectedPeriod,false), company: company ? toDataDTO(currentCompany(company, companyPublication)) : null,
          prices:filterListingRows(archive.prices,selectedPeriod).toReversed(),marketcaps:filterListingRows(archive.marketcaps,selectedPeriod),
          listingPeriods,lifecycleEvents,selectedPeriod,historicalPeriod:false,
          routeCode: routeCodes.get(row.securityId) ?? null, publication: current && publication && listingContains(selectedPeriod,asOf) ? toDataDTO(publication) : null,
          state: current && listingContains(selectedPeriod,asOf) ? 'published' as const : 'unpublished' as const },
        archive, rankingPriceSources: officialOnly ? filterListingRows(rankingPriceSources, selectedPeriod) : undefined, rawCompanyMarketcaps: !reuseMarketcaps ? rawCompanyMarketcaps : undefined,
        metrics: current && asOf ? sourceMetrics.filter(observation => observation.date <= asOf) : sourceMetrics,
        companyMember: membership.has(row.securityId),
        allMarketcaps:filterListingRows(companyMarketcaps, membership.get(row.securityId) ?? selectedPeriod),
      };
    }) };
}
