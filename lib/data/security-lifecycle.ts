import * as schema from '@/db/schema-postgres';
import { and,asc,eq,inArray,sql } from 'drizzle-orm';
import type { ReadDatabase } from './publication';
import type { SecurityListingPeriod, SecurityLifecycleEvent } from '../security-lifecycle';

/** Batch with the caller's repeatable-read transaction, so periods and observations share a snapshot. */
export async function readSecurityLifecycles(tx: ReadDatabase, ids: readonly string[]) {
  if (!ids.length) return {periods: [] as SecurityListingPeriod[], events: [] as SecurityLifecycleEvent[]};
  const [periods, events,names] = await Promise.all([
    tx.query.securityListingPeriod.findMany({where:inArray(schema.securityListingPeriod.securityId,[...ids]), orderBy:[asc(schema.securityListingPeriod.listingDate)]}),
    tx.query.securityEvent.findMany({where:inArray(schema.securityEvent.securityId,[...ids]), orderBy:[asc(schema.securityEvent.effectiveOn),asc(schema.securityEvent.eventId)]}),
    tx.select({periodId:schema.securityListingPeriod.periodId,name:schema.stockcodename.name,exchange:schema.stockcodename.exchange})
      .from(schema.securityListingPeriod).innerJoin(schema.stockcodename,and(
        eq(schema.stockcodename.securityId,schema.securityListingPeriod.securityId),
        sql`${schema.stockcodename.date} = (${schema.securityListingPeriod.lastPresentOn}::timestamp AT TIME ZONE 'Asia/Seoul')`))
      .where(inArray(schema.securityListingPeriod.securityId,[...ids])),
  ]);
  const displayNames=new Map<string,string>(),displayExchanges=new Map<string,string>();
  for(const row of names) {
    if(row.name) {
      if(displayNames.has(row.periodId)&&displayNames.get(row.periodId)!==row.name) throw new Error('상장 기간의 명단 이름이 일치하지 않습니다.');
      displayNames.set(row.periodId,row.name);
    }
    if(row.exchange) {
      if(displayExchanges.has(row.periodId)&&displayExchanges.get(row.periodId)!==row.exchange) throw new Error('상장 기간의 명단 시장이 일치하지 않습니다.');
      displayExchanges.set(row.periodId,row.exchange);
    }
  }
  return {periods:periods.map(period=>({...period,...(displayNames.has(period.periodId)?{displayName:displayNames.get(period.periodId)}:{}),
    ...(displayExchanges.has(period.periodId)?{displayExchange:displayExchanges.get(period.periodId)}:{})})) as SecurityListingPeriod[],events:events as SecurityLifecycleEvent[]};
}
