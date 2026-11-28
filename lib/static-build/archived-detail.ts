import type { SecurityListingPeriod } from '../security-lifecycle';

type ArchiveSecurity = {
  selectedPeriod?: SecurityListingPeriod | null;
  delistingDate?: string | null;
  state?: string;
};

/** Pin an ended security to the last day inside its final listing interval. */
export function archivedSecurityThrough(
  security: ArchiveSecurity, publicationDay: string | null, sourceEnds: Array<string | undefined>,
) {
  const period = security.selectedPeriod;
  const delisting = period ? period.delistingDate : security.delistingDate;
  if (!publicationDay || !delisting || delisting > publicationDay) return undefined;
  // Legacy masters can have observations beyond a date without an authoritative
  // listing episode. Keep those inputs on their ordinary publication cutoff.
  if (!period && (security.state === 'published' || sourceEnds.some(date => date && date >= delisting))) return undefined;
  const previous = new Date(delisting + 'T00:00:00Z');
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

const privateFields = new Set(['company', 'prices', 'marketcaps', 'createdAt', 'updatedAt', 'calculationId', 'publicationKey', 'resultRevision']);

function corporationView(row: object | null | undefined) {
  if (!row) return null;
  const { name, korName, logo, industry, establishedDate, homepage } = row as Record<string, unknown>;
  return { name, korName, logo, industry, establishedDate, homepage };
}

/** Public history hashes and the linked company supply the other render inputs. */
export function archivedSecurityRenderSource(security: { company?: object | null }, assets: object, rankings: object) {
  const fields = Object.fromEntries(Object.entries(security).filter(([key]) => !privateFields.has(key) && !key.endsWith('SourceRef')));
  return { security: { ...fields, company: corporationView(security.company) }, assets, rankings };
}

export function archivedCompanyRenderSource({ company: corporation, ...company }: { company: object }, assets: object, neighbors: object[]) {
  return { company: { ...company, company: corporationView(corporation) }, assets, neighbors };
}
