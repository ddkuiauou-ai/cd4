import type * as schema from '@/db/schema-postgres';
import { businessDate, toDataDTO } from '../data/dto';
import { readRecentPrices, type PriceDTO } from '../data/history';
import { computeMixedPagination, computeTotalPagesMixed } from '../data/pagination';
import { isCurrentResult, publicationState, type PublicationRow, type ReadDatabase } from '../data/publication';
import { compactRankingItems } from './compact-ranking';

type Security = typeof schema.security.$inferSelect;
type Company = typeof schema.company.$inferSelect;
type Rank = typeof schema.securityRank.$inferSelect;
type Input = { securities: Security[]; companies: Company[]; ranks: Rank[]; publications: PublicationRow[] };
type Price = Pick<PriceDTO, 'date' | 'open' | 'close' | 'rate' | 'volume'>;

/** Assemble rank pages from one inventory; only latest-30 source prices need additional queries. */
export function createPreparedRankings(raw: Input, routeCodes: Map<string, string | null>, suppliedMembers?: Map<string, Security[]>) {
  const securityById = new Map(raw.securities.map(row => [row.securityId, row]));
  const publications = new Map(raw.publications.map(row => [row.publicationKey, row]));
  const members = suppliedMembers ?? new Map<string, Security[]>();
  if (!suppliedMembers) {
    for (const row of raw.securities) if (row.companyId) {
      const rows = members.get(row.companyId) ?? []; rows.push(row); members.set(row.companyId, rows);
    }
    for (const rows of members.values()) rows.sort((a, b) => Number(b.delistingDate == null) - Number(a.delistingDate == null)
      || a.exchange.localeCompare(b.exchange) || a.ticker.localeCompare(b.ticker) || a.securityId.localeCompare(b.securityId));
  }
  const representative = (companyId: string) => members.get(companyId)?.find(row => row.type === '보통주');
  const securityRanks = new Map<string, Rank[]>();
  for (const publication of raw.publications) if (publication.publicationKey.startsWith('security_rank/') && publication.metricType) {
    securityRanks.set(publication.publicationKey, raw.ranks.filter(row => isCurrentResult(row, publication)
      && row.rankingState === 'included' && row.scopeKey === publication.scopeKey && row.metricType === publication.metricType
      && businessDate(row.rankDate) === businessDate(publication.asOf) && securityById.has(row.securityId))
      .sort((a, b) => a.currentRank! - b.currentRank! || a.securityId.localeCompare(b.securityId)));
  }
  const companyPublication = publications.get('company_marketcap/krx-all') ?? null;
  const companyRanks = raw.companies.filter(row => isCurrentResult(row, companyPublication) && row.rankingState === 'included')
    .sort((a, b) => a.marketcapRank! - b.marketcapRank! || a.companyId.localeCompare(b.companyId));
  const wanted = new Map<string, Set<string>>();
  function add(date: string, id?: string) {
    if (!id) return;
    const ids = wanted.get(date) ?? new Set<string>(); ids.add(id); wanted.set(date, ids);
  }
  for (const [key, ranks] of securityRanks) {
    const date = businessDate(publications.get(key)!.asOf)!;
    for (const rank of ranks) add(date, rank.securityId);
  }
  if (companyPublication) for (const company of companyRanks) add(businessDate(companyPublication.asOf)!, representative(company.companyId)?.securityId);
  const prices = new Map<string, Map<string, Price[]>>();
  const stats = { batchSize: 100, batches: 0, sourcePriceRows: 0, distinctCutoffs: wanted.size, distinctSecurityCutoffs: 0,
    seconds: 0, peakRssBytes: 0, peakHeapUsedBytes: 0 };
  const sampleMemory = () => {
    const memory = process.memoryUsage(); stats.peakRssBytes = Math.max(stats.peakRssBytes, memory.rss);
    stats.peakHeapUsedBytes = Math.max(stats.peakHeapUsedBytes, memory.heapUsed);
  };
  return {
    stats,
    async loadPrices(tx: ReadDatabase) {
      const started = performance.now();
      for (const [date, wantedIds] of wanted) {
        const grouped = new Map<string, Price[]>(); prices.set(date, grouped);
        const ids = [...wantedIds]; stats.distinctSecurityCutoffs += ids.length;
        for (let offset = 0; offset < ids.length; offset += stats.batchSize) {
          const batch = await readRecentPrices(tx, ids.slice(offset, offset + stats.batchSize), 30, date);
          for (const [id, rows] of Object.entries(batch)) {
            stats.sourcePriceRows += rows.length;
            grouped.set(id, rows.map(({ date, open, close, rate, volume }) => ({ date, open, close, rate, volume })));
          }
          stats.batches++; sampleMemory();
        }
      }
      stats.seconds = (performance.now() - started) / 1000;
    },
    getPage(scope: 'security' | 'company', metric: schema.MetricType, page: number, scopeKey = 'krx-all') {
      const key = scope === 'company' ? 'company_marketcap/krx-all' : `security_rank/${scopeKey}/${metric}`;
      const publication = publications.get(key) ?? null;
      const status = publicationState(publication);
      const { page: currentPage, pageSize, limit, skip } = computeMixedPagination(page);
      const priceMap = publication ? prices.get(businessDate(publication.asOf)!) : undefined;
      if (publication && !priceMap && (scope === 'security' ? securityRanks.get(key)?.length : companyRanks.length)) {
        // An empty company representative set legitimately has no price request.
        if (scope === 'security' || companyRanks.some(row => representative(row.companyId))) throw new Error('Ranking prices must load before page assembly');
      }
      const items = scope === 'security' ? (securityRanks.get(key) ?? []).slice(skip, skip + limit).map(rank => {
        const row = securityById.get(rank.securityId)!;
        return { securityId: row.securityId, companyId: row.companyId, name: row.name, korName: row.korName,
          exchange: row.exchange, ticker: row.ticker, type: row.type, routeCode: routeCodes.get(row.securityId) ?? null,
          currentRank: rank.currentRank, priorRank: rank.priorRank, value: rank.value, valueObservedAt: rank.valueObservedAt,
          prices: priceMap?.get(row.securityId) ?? [] };
      }) : companyRanks.slice(skip, skip + limit).map(row => {
        const security = representative(row.companyId);
        const rep = security ? { securityId: security.securityId, exchange: security.exchange, ticker: security.ticker,
          type: security.type, name: security.name, korName: security.korName, routeCode: routeCodes.get(security.securityId) ?? null,
          prices: priceMap?.get(security.securityId) ?? [] } : null;
        return { ...row, representativeSecurity: rep, routeCode: rep?.routeCode ?? null, prices: rep?.prices ?? [] };
      });
      return { ...status, items: compactRankingItems(toDataDTO(items), scope), latestDate: status.publication?.asOf ?? null,
        totalCount: publication?.includedCount ?? 0, page: currentPage, pageSize, skip,
        totalPages: computeTotalPagesMixed(publication?.includedCount ?? 0) };
    },
  };
}
