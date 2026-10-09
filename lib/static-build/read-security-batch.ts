import * as schema from '@/db/schema-postgres';
import { and, asc, getTableColumns, inArray, lte, sql } from 'drizzle-orm';
import { currentSecurity } from '../data/security';
import { currentCompany } from '../data/company';
import { businessDate, toDataDTO } from '../data/dto';
import { historyRange, readPriceHistory, readMarketcapHistory } from '../data/history';
import { isCurrentResult, type PublicationRow, type ReadDatabase } from '../data/publication';

type Security = typeof schema.security.$inferSelect;
type Company = typeof schema.company.$inferSelect;

/** Extract bounded source histories once per batch, using the live providers' casts and cutoffs. */
export async function readSecurityBatch(tx: ReadDatabase, rows: Security[], companies: Map<string, Company>,
  publication: PublicationRow | null, companyPublication: PublicationRow | null, routeCodes: Map<string, string | null>) {
  const ids = rows.map(row => row.securityId);
  if (!ids.length) return { items: [], historyRows: 0 };
  const asOf = publication ? businessDate(publication.asOf)! : undefined;
  const companyAsOf = companyPublication ? businessDate(companyPublication.asOf)! : undefined;
  const reuseMarketcaps = companyAsOf === asOf || (companyAsOf !== undefined && asOf !== undefined && companyAsOf <= asOf);
  const metricEnd = rows.every(row => isCurrentResult(row, publication)) ? asOf : undefined;
  const { to } = historyRange(undefined, metricEnd);
  const [prices, marketcaps, metrics, companyMarketcaps] = await Promise.all([
    readPriceHistory(tx, ids, undefined, asOf), readMarketcapHistory(tx, ids, undefined, asOf),
    tx.select({ ...getTableColumns(schema.bppedd),
      bps: sql<string | null>`${schema.bppedd.bps}::text`, per: sql<string | null>`${schema.bppedd.per}::text`,
      pbr: sql<string | null>`${schema.bppedd.pbr}::text`, eps: sql<string | null>`${schema.bppedd.eps}::text`,
      div: sql<string | null>`${schema.bppedd.div}::text`, dps: sql<string | null>`${schema.bppedd.dps}::text`,
    }).from(schema.bppedd).where(and(inArray(schema.bppedd.securityId, ids), to ? lte(schema.bppedd.date, to) : undefined))
      .orderBy(asc(schema.bppedd.date)).then(toDataDTO),
    reuseMarketcaps ? Promise.resolve(null) : readMarketcapHistory(tx, ids, undefined, companyAsOf),
  ]);
  const group = <Row extends { securityId: string | null }>(source: Row[]) => {
    const grouped = new Map<string, Row[]>();
    for (const row of source) if (row.securityId) {
      const values = grouped.get(row.securityId) ?? []; values.push(row); grouped.set(row.securityId, values);
    }
    return grouped;
  };
  const byPrice = group(prices), byMarketcap = group(marketcaps), byMetric = group(metrics);
  const byCompanyMarketcap = companyMarketcaps ? group(companyMarketcaps) : byMarketcap;
  return { historyRows: prices.length + marketcaps.length + metrics.length + (companyMarketcaps?.length ?? 0),
    items: rows.map(row => {
      const current = isCurrentResult(row, publication);
      const company = row.companyId ? companies.get(row.companyId) : undefined;
      const sourceMetrics = byMetric.get(row.securityId) ?? [];
      return { securityId: row.securityId,
        security: { ...toDataDTO(currentSecurity(row, publication)), company: company ? toDataDTO(currentCompany(company, companyPublication)) : null,
          prices: (byPrice.get(row.securityId) ?? []).toReversed(), marketcaps: byMarketcap.get(row.securityId) ?? [],
          routeCode: routeCodes.get(row.securityId) ?? null, publication: current && publication ? toDataDTO(publication) : null,
          state: current ? 'published' as const : 'unpublished' as const },
        metrics: current && asOf ? sourceMetrics.filter(observation => observation.date <= asOf) : sourceMetrics,
        allMarketcaps: byCompanyMarketcap.get(row.securityId) ?? [],
      };
    }) };
}
