import type { DetailCompanyView, DetailSecurityRow } from '@/components/detail-types';
import {
  addBusinessValues, businessChangePercent, compareBusinessValues, isBusinessDay,
  subtractBusinessValues, type BusinessValue,
} from './business-analysis';

const nameOf = (member: DetailSecurityRow) => member.korName || member.name || member.ticker || '이름 미등록';
const dateOf = (value: Date | string | null | undefined) => {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : null;
  return typeof value === 'string' && isBusinessDay(value) ? value : null;
};
const nonnegative = (value: BusinessValue | undefined): value is number | string =>
  value != null && (compareBusinessValues(value, 0) ?? -1) >= 0;
const magnitude = (value: string) => value.startsWith('-') ? value.slice(1) : value;

/** Use the latest record, including a missing latest close; never silently substitute an older price. */
function latestQuote(member: DetailSecurityRow | undefined) {
  // An undated source record cannot safely be ordered against the dated records.
  if (member?.prices?.some(row => !dateOf(row.date))) return { date: null, close: null };
  const dated = (member?.prices ?? []).flatMap(row => {
    const date = dateOf(row.date);
    return date ? [{ date, close: row.close }] : [];
  });
  const date = dated.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
  const latest = dated.filter(row => row.date === date);
  const close = latest[0]?.close ?? null;
  const consistent = latest.every(row => compareBusinessValues(row.close, close) === 0);
  return { date, close: consistent && nonnegative(close) ? close : null };
}

export function prepareDetailComparison(company: DetailCompanyView | null, members: readonly DetailSecurityRow[]) {
  const unique = new Map<string, DetailSecurityRow>();
  const duplicateIds = new Set<string>();
  for (const member of members) {
    if (unique.has(member.securityId)) duplicateIds.add(member.securityId);
    else unique.set(member.securityId, member);
  }
  const rows = [...unique.values()];
  const date = dateOf(company?.totalMarketcapDate);
  const officialMembers = company?.securities ?? [];
  const officialIds = new Set(officialMembers.map(member => member.securityId));
  const total = company?.totalMarketcap ?? null;
  const compositionComplete = Boolean(company?.state === 'published' && company.marketcapCompleteness === 'complete'
    && company.compositionComplete && date && (compareBusinessValues(total, 0) ?? 0) > 0
    && officialMembers.length > 0 && officialIds.size === officialMembers.length
    && company.compositionObservedCount === officialMembers.length && company.compositionTargetCount === officialMembers.length
    && officialMembers.every(member => nonnegative(member.marketcap) && dateOf(member.marketcapDate) === date)
    && compareBusinessValues(addBusinessValues(officialMembers.map(member => member.marketcap)), total) === 0);
  const compositionReason = compositionComplete ? null
    : !company || company.state !== 'published' ? '공개된 기업 합산값이 없어 구성 비중을 표시하지 않습니다.'
    : company.compositionReason === 'different_total' ? '종목별 합계와 공개 총액이 달라 구성 비중을 표시하지 않습니다.'
    : '같은 기준일의 모든 구성 종목과 합산값이 확인되면 비중을 표시합니다.';
  const compositionRows = rows.map(member => {
    const source = officialMembers.find(row => row.securityId === member.securityId);
    const value = source?.marketcap ?? null;
    // (total + part - total) / total, using exact decimal arithmetic before display rounding.
    const percentage = compositionComplete && source && value != null
      ? businessChangePercent(total, addBusinessValues([total, value])) : null;
    return { securityId: member.securityId, name: nameOf(member), type: member.type, value, percentage };
  });

  // The official membership excludes retired listings. A same-name/ticker record is never an identity match.
  const currentMembers = rows.filter(member => officialIds.has(member.securityId));
  const commonMembers = currentMembers.filter(member => member.type === '보통주');
  const common = commonMembers.length === 1 ? commonMembers[0] : undefined;
  const commonQuote = latestQuote(common);
  const priceComparisons = currentMembers.filter(member => member.type?.includes('우선주')).map(member => {
    const quote = latestQuote(member);
    const canCompare = Boolean(common && !duplicateIds.has(common.securityId) && !duplicateIds.has(member.securityId)
      && commonQuote.date && commonQuote.date === quote.date && quote.close != null
      && (compareBusinessValues(commonQuote.close, 0) ?? 0) > 0);
    const difference = canCompare ? subtractBusinessValues(quote.close, commonQuote.close) : null;
    const percent = canCompare ? businessChangePercent(commonQuote.close, quote.close) : null;
    const sign = difference == null ? null : compareBusinessValues(difference, 0);
    const reason = canCompare ? null : !common ? '비교할 보통주가 하나로 확인되지 않습니다.'
      : commonQuote.date && quote.date && commonQuote.date !== quote.date ? '거래 기준일이 달라 가격 차이를 계산하지 않습니다.'
      : '같은 기준일의 유효한 주가와 0보다 큰 보통주 주가가 필요합니다.';
    return { securityId: member.securityId, name: nameOf(member), commonName: common ? nameOf(common) : '보통주',
      commonDate: commonQuote.date, date: quote.date, commonPrice: commonQuote.close, price: quote.close,
      difference: difference == null ? null : magnitude(difference), percent: percent == null ? null : magnitude(percent),
      direction: sign == null ? null : sign < 0 ? 'lower' as const : sign > 0 ? 'higher' as const : 'same' as const, reason };
  });
  return { composition: { date, total, complete: compositionComplete, reason: compositionReason, rows: compositionRows }, priceComparisons };
}
