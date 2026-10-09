// Match readSecurityByCode: stable IDs first, then exchange.ticker syntax,
// otherwise the combined name/korName/ticker match must be unique.
function createStaticAliases(securities, companies) {
  const securityAliases = Object.create(null), companyAliases = Object.create(null);
  const candidates = new Map();
  const byId = new Map(securities.map(row => [row.securityId, row]));
  function add(alias, id) {
    if (!alias) return;
    if (!candidates.has(alias)) candidates.set(alias, new Set());
    candidates.get(alias).add(id);
  }
  for (const row of securities) {
    if (row.exchange && row.ticker) add(`${row.exchange}.${row.ticker}`, row.securityId);
    for (const alias of [row.name, row.korName, row.ticker]) {
      if (alias && alias.indexOf('.') <= 0) add(alias, row.securityId);
    }
  }
  for (const [alias, ids] of candidates) if (ids.size === 1) securityAliases[alias] = [...ids][0];
  for (const row of securities) securityAliases[row.securityId] = row.securityId;
  for (const [alias, id] of Object.entries(securityAliases)) {
    const companyId = byId.get(id)?.companyId;
    if (companyId) companyAliases[alias] = companyId;
  }
  for (const row of companies) companyAliases[row.companyId] = row.companyId;
  return { securityAliases, companyAliases };
}

module.exports = { createStaticAliases };
