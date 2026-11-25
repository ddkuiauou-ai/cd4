export interface SecurityRouteIdentity {
  securityId: string;
  exchange?: string | null;
  ticker?: string | null;
  /** null means the exchange and ticker do not uniquely identify this security. */
  routeCode?: string | null;
}

export interface CompanyRouteIdentity {
  companyId: string;
  routeCode?: string | null;
}

export function securityRouteCode(identity: SecurityRouteIdentity): string {
  if (identity.routeCode !== undefined) return identity.routeCode || identity.securityId;
  return identity.exchange && identity.ticker
    ? `${identity.exchange}.${identity.ticker}` : identity.securityId;
}

export function securityPath(identity: SecurityRouteIdentity, metric?: string): string {
  return `/security/${encodeURIComponent(securityRouteCode(identity))}${metric && metric !== 'price' ? `/${metric}` : ''}`;
}

export function companyPath(identity: CompanyRouteIdentity, metric?: string): string {
  return `/company/${encodeURIComponent(identity.routeCode || identity.companyId)}${metric ? `/${metric}` : ''}`;
}

/** A public market code must identify a single security across the full inventory. */
export function securityRouteCodes(identities: readonly SecurityRouteIdentity[]): Map<string, string | null> {
  const counts = new Map<string, number>();
  for (const identity of identities) {
    if (identity.exchange && identity.ticker) {
      const alias = `${identity.exchange}.${identity.ticker}`;
      counts.set(alias, (counts.get(alias) ?? 0) + 1);
    }
  }
  return new Map(identities.map(identity => {
    const alias = identity.exchange && identity.ticker ? `${identity.exchange}.${identity.ticker}` : null;
    return [identity.securityId, alias && counts.get(alias) === 1 ? alias : null];
  }));
}

export function companyRouteCodes(
  identities: readonly (SecurityRouteIdentity & { companyId: string | null; type?: string | null; delistingDate?: Date | string | null })[],
): Map<string, string | null> {
  const marketCodes = securityRouteCodes(identities);
  const result = new Map<string, string | null>();
  const sorted = [...identities].sort((a, b) =>
    Number(b.type === '보통주') - Number(a.type === '보통주')
    || Number(b.delistingDate == null) - Number(a.delistingDate == null)
    || (a.exchange ?? '').localeCompare(b.exchange ?? '')
    || (a.ticker ?? '').localeCompare(b.ticker ?? '')
    || a.securityId.localeCompare(b.securityId));
  for (const identity of sorted) {
    if (!identity.companyId || result.get(identity.companyId)) continue;
    // Prefer common stock for the URL. A company with only preferred stock still has a market code.
    result.set(identity.companyId, marketCodes.get(identity.securityId) ?? null);
  }
  return result;
}
