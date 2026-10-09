export interface SecurityRouteIdentity {
  securityId: string;
  exchange?: string | null;
  ticker?: string | null;
  /** null explicitly means the legacy alias is ambiguous. */
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

/** Decide aliases from the complete identity inventory, never a ranking page subset. */
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
  const aliases = securityRouteCodes(identities);
  const result = new Map<string, string | null>();
  const sorted = [...identities].sort((a, b) =>
    Number(b.type === '보통주') - Number(a.type === '보통주')
    || Number(b.delistingDate == null) - Number(a.delistingDate == null)
    || (a.exchange ?? '').localeCompare(b.exchange ?? '')
    || (a.ticker ?? '').localeCompare(b.ticker ?? '')
    || a.securityId.localeCompare(b.securityId));
  for (const identity of sorted) {
    if (identity.type === '보통주' && identity.companyId && !result.has(identity.companyId)) {
      result.set(identity.companyId, aliases.get(identity.securityId) ?? null);
    }
  }
  return result;
}
