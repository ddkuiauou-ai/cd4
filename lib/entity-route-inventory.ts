import { isStaticBuild, getStaticIdentities } from './static-build/server';
import { cache } from 'react';
import { db } from '@/db';
import { companyRouteCodes, securityRouteCodes } from './entity-paths';

/** Request-local identity lookup; no persistent cache of a changing master. */
export const getEntityRouteInventory = cache(async () => {
  const identities = isStaticBuild() ? getStaticIdentities() : await db.query.security.findMany({
    columns: { securityId: true, companyId: true, ticker: true, exchange: true, type: true, delistingDate: true },
  });
  return { identities, securities: securityRouteCodes(identities), companies: companyRouteCodes(identities) };
});
