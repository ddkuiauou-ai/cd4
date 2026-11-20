import { listingContains, selectListingPeriod, type SecurityListingPeriod } from '../security-lifecycle';
import { businessDate } from './dto';

type ListingMaster = {
  securityId: string;
  listingDate?: Date | string | null;
  delistingDate?: Date | string | null;
};

/** null values identify eligible legacy masters that have no listing periods. */
export function companyMemberPeriods(
  securities: readonly ListingMaster[], periods: readonly SecurityListingPeriod[], asOf: string | null,
) {
  const bySecurity = new Map<string, SecurityListingPeriod[]>();
  for (const period of periods) {
    const group = bySecurity.get(period.securityId) ?? [];
    group.push(period);
    bySecurity.set(period.securityId, group);
  }

  const members = new Map<string, SecurityListingPeriod | null>();
  for (const security of securities) {
    const listingPeriods = bySecurity.get(security.securityId);
    if (listingPeriods) {
      const period = asOf
        ? listingPeriods.find(period => listingContains(period, asOf))
        : selectListingPeriod(listingPeriods);
      if (period && (asOf || period.delistingDate == null)) members.set(security.securityId, period);
      continue;
    }

    const start = businessDate(security.listingDate);
    const end = businessDate(security.delistingDate);
    const listed = asOf ? (!start || start <= asOf) && (!end || asOf < end) : !end;
    if (listed) members.set(security.securityId, null);
  }
  return members;
}
