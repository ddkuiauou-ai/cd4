/** Listing periods are half-open [listingDate, delistingDate). Dates stay ISO business days. */
export interface SecurityListingPeriod {
  displayName?: string; displayExchange?: string;
  periodId: string; securityId: string; listingDate: string; delistingDate: string | null;
  lastPresentOn: string; listingSourceRef: string; delistingSourceRef: string | null;
  relistingReviewRef: string | null; mappingRef: string | null;
}
export interface SecurityLifecycleEvent {
  eventId: string; securityId: string; companyId: string | null;
  eventType: 'security_name_change' | 'company_name_change'; effectiveOn: string | null;
  datePrecision: 'day' | 'year' | 'unknown'; eventYear: number | null;
  oldName: string; newName: string; sourceRef: string;
  basis: 'roster_observed' | 'disclosure' | 'reviewed'; reviewRef: string | null; mappingRef: string | null;
}
export const listingContains = (period: SecurityListingPeriod | null | undefined, date: string | null | undefined) =>
  !period || Boolean(date && date >= period.listingDate && (!period.delistingDate || date < period.delistingDate));
export function selectListingPeriod(periods: readonly SecurityListingPeriod[], periodId?: string) {
  if (periodId) return periods.find(period => period.periodId === periodId) ?? null;
  return [...periods].sort((a,b) => a.listingDate.localeCompare(b.listingDate)).at(-1) ?? null;
}
export function filterListingRows<Row extends {date?: unknown}>(rows: readonly Row[], period: SecurityListingPeriod | null | undefined) {
  return period ? rows.filter(row => listingContains(period, typeof row.date === 'string' ? row.date : null)) : [...rows];
}
export function nameForListingPeriod(currentName: string, events: readonly SecurityLifecycleEvent[], period: SecurityListingPeriod | null) {
  if (!period) return currentName;
  if (period.displayName) return period.displayName;
  const changes = events.filter(event => event.eventType === 'security_name_change' && event.datePrecision === 'day' && event.effectiveOn)
    .sort((a,b) => a.effectiveOn!.localeCompare(b.effectiveOn!) || a.eventId.localeCompare(b.eventId));
  const later = period.delistingDate ? changes.find(event => event.effectiveOn! >= period.delistingDate!) : undefined;
  if (later) return later.oldName;
  return changes.filter(event => listingContains(period, event.effectiveOn)).at(-1)?.newName ?? currentName;
}
const metrics = ['price','shares','marketcap','bps','per','pbr','eps','div','dps'] as const;
/** Official values retain publication semantics; an earlier episode cannot inherit the current quote or last-provided. */
export function isolateListingValues<Row extends object>(row: Row, period: SecurityListingPeriod | null, historical: boolean): Row {
  if (!period) return row;
  const safe = {...row} as Record<string, unknown>;
  for (const metric of metrics) {
    if (historical || !listingContains(period, typeof safe[`${metric}Date`] === 'string' ? safe[`${metric}Date`] as string : null)) {
      for (const field of [metric, `${metric}Date`, `${metric}SourceRef`]) safe[field] = null;
      safe[`${metric}State`] = 'no_observation';
    }
    if (historical || !listingContains(period, typeof safe[`${metric}LastProvidedDate`] === 'string' ? safe[`${metric}LastProvidedDate`] as string : null)) {
      for (const field of [`${metric}LastProvided`, `${metric}LastProvidedDate`, `${metric}LastProvidedSourceRef`]) safe[field] = null;
    }
  }
  if (historical) { safe.state = 'unpublished'; safe.publication = null; }
  return safe as Row;
}
export function lifecycleTimeline(periods: readonly SecurityListingPeriod[], events: readonly SecurityLifecycleEvent[]) {
  const ordered = [...periods].sort((a,b) => a.listingDate.localeCompare(b.listingDate));
  const timeline: Array<{id:string; date:string|null; dateLabel:string; label:string; detail:string; sourceRef:string}> = [];
  ordered.forEach((period,index) => {
    timeline.push({id:`${period.periodId}:listing`,date:period.listingDate,dateLabel:period.listingDate,
      label:index ? '재상장' : '상장',detail:'명단에서 확인한 상장 시작',sourceRef:period.listingSourceRef});
    if (period.delistingDate) timeline.push({id:`${period.periodId}:delisting`,date:period.delistingDate,dateLabel:period.delistingDate,
      label:'상장폐지',detail:'완전한 명단에서 처음 확인한 부재',sourceRef:period.delistingSourceRef || ''});
  });
  for (const event of events) timeline.push({id:event.eventId,
    date:event.datePrecision === 'day' ? event.effectiveOn : event.eventYear ? String(event.eventYear) : null,
    dateLabel:event.datePrecision === 'day' ? event.effectiveOn || '날짜 미확정' : event.eventYear ? `${event.eventYear}년 (일자 미확정)` : '날짜 미확정',
    label:event.eventType === 'company_name_change' ? '회사명 변경' : '종목명 변경', detail:`${event.oldName} → ${event.newName}`, sourceRef:event.sourceRef});
  return timeline.sort((a,b) => (a.date || '9999').localeCompare(b.date || '9999') || a.id.localeCompare(b.id));
}
