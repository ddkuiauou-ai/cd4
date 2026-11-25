import * as schema from '@/db/schema-postgres';
import {
  MARKET_CSV_INPUT, marketCsvMetadata, marketCsvMetrics, serializeMarketCsv, type MarketCsvMetadata, type MarketCsvMetric,
} from '@/lib/csv/market';
import { getStaticManifest, isStaticBuild, staticInputDirectory } from '@/lib/static-build/server';
import { eq, sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { businessDate, toDataDTO } from './dto';
import { listedSecurityPeriods } from './listed-security-periods';
import {
  DEFAULT_SCOPE, isCurrentResult, readPublication, readSnapshot, SECURITY_PUBLICATION_KEY,
  securityRankPublicationKey, type PublicationRow, type ReadDatabase,
} from './publication';

export type { MarketCsvMetadata } from '@/lib/csv/market';

type Security = typeof schema.security.$inferSelect;
type Rank = typeof schema.securityRank.$inferSelect;

async function readPopulation(tx: ReadDatabase, date: string) {
  const securities = await tx.query.security.findMany();
  const periods = await tx.query.securityListingPeriod.findMany();
  const members = listedSecurityPeriods(securities, periods, date);
  return securities.filter(row => members.has(row.securityId));
}

export async function readMarketCsv(
  tx: ReadDatabase, publication: PublicationRow, securities: readonly Security[],
  rankPublications: readonly PublicationRow[], ranks: readonly Rank[],
) {
  const date = businessDate(publication.asOf)!;
  const byMetric = new Map<MarketCsvMetric, Map<string, Rank>>();
  const headers = new Map(rankPublications.map(row => [row.publicationKey, row]));
  for (const metric of marketCsvMetrics) byMetric.set(metric, new Map());
  for (const rank of ranks) {
    const header = headers.get(rank.publicationKey);
    if (!header || !isCurrentResult(rank, header) || rank.scopeKey !== DEFAULT_SCOPE
      || rank.scopeKey !== header.scopeKey || rank.metricType !== header.metricType
      || businessDate(rank.rankDate) !== businessDate(header.asOf)) continue;
    byMetric.get(rank.metricType)?.set(rank.securityId, rank);
  }
  const price = schema.price;
  const prices = toDataDTO(await tx.select({
    securityId: price.securityId, ticker: price.ticker, exchange: price.exchange, date: price.date,
    open: sql<string>`${price.open}::text`, high: sql<string>`${price.high}::text`,
    low: sql<string>`${price.low}::text`, close: sql<string>`${price.close}::text`, volume: price.volume,
  }).from(price).where(eq(price.date, publication.asOf)));
  const trades = new Map(prices.map(row => [JSON.stringify([row.securityId, row.exchange, row.ticker]), row]));
  return serializeMarketCsv(date, securities.map(row => ({
    security: toDataDTO(row),
    current: isCurrentResult(row, publication),
    price: trades.get(JSON.stringify([row.securityId, row.exchange, row.ticker])),
    ranks: Object.fromEntries(marketCsvMetrics.map(metric => {
      const header = headers.get(securityRankPublicationKey(metric));
      const rank = byMetric.get(metric)?.get(row.securityId);
      return [metric, { rankDate: businessDate(header?.asOf), currentRank: rank?.currentRank ?? null,
        rankingState: rank?.rankingState ?? null }];
    })),
  })));
}

export async function getMarketCsvMetadata(): Promise<MarketCsvMetadata | null> {
  if (isStaticBuild()) return getStaticManifest().marketCsv ?? null;
  return readSnapshot(async tx => {
    const publication = await readPublication(tx, SECURITY_PUBLICATION_KEY);
    if (!publication) return null;
    const date = businessDate(publication.asOf)!;
    return marketCsvMetadata(date, (await readPopulation(tx, date)).length);
  });
}

export async function getLiveMarketCsv(file?: string) {
  return readSnapshot(async tx => {
    const publication = await readPublication(tx, SECURITY_PUBLICATION_KEY);
    if (!publication || (file && file !== `${businessDate(publication.asOf)}.csv`)) return null;
    const securities = await readPopulation(tx, businessDate(publication.asOf)!);
    const publications = await tx.query.resultPublication.findMany({ where: eq(schema.resultPublication.resultKind, 'security_rank') });
    const ranks = await tx.query.securityRank.findMany({ where: eq(schema.securityRank.scopeKey, DEFAULT_SCOPE) });
    return { ...(await readMarketCsv(tx, publication, securities, publications, ranks)), revision: String(publication.revision) };
  });
}

function csvResponse(body: string, metadata: MarketCsvMetadata) {
  return new Response(body, { headers: {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="market-${metadata.date}.csv"`,
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'X-Market-Reference-Date': metadata.date,
    'X-Market-Row-Count': String(metadata.rowCount),
  } });
}

export async function getMarketCsvResponse(file: string) {
  const missing = () => new Response('공개된 시장 자료가 없습니다.', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  if (isStaticBuild()) {
    const data = getStaticManifest().marketCsv;
    return data && file === `${data.date}.csv`
      ? csvResponse(fs.readFileSync(path.join(staticInputDirectory(), MARKET_CSV_INPUT), 'utf8'), data) : missing();
  }
  if (!/^\d{4}-\d{2}-\d{2}\.csv$/.test(file)) return missing();
  const csv = await getLiveMarketCsv(file);
  return csv ? csvResponse(csv.body, csv.metadata) : missing();
}
