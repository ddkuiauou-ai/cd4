const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { readJson, routePath, sha256 } = require('./static-tools.cjs');
require('./register-typescript.cjs');
const { rankingManifestForPage } = require('../lib/static-ranking.ts');

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rankBases = new Set(['marketcap', 'per', 'pbr', 'eps', 'bps', 'div', 'dps', 'marketcaps']);
const rankInput = base => base === 'marketcaps' ? 'rankings/company-marketcap.json' : `rankings/security-${base}.json`;

function routeFingerprints(input, manifest) {
  const identities = readJson(path.join(input, 'identities.json'));
  const identityById = new Map(identities.map(row => [row.securityId, row]));
  const members = new Map();
  for (const row of identities) {
    if (!row.companyId) continue;
    const group = members.get(row.companyId) ?? [];
    group.push(row.securityId);
    members.set(row.companyId, group);
  }
  const cacheFile = path.join(input, 'entity-digests.json');
  const digests = fs.existsSync(cacheFile) ? readJson(cacheFile) : { security: {}, company: {} };
  const archivedSecurities = new Set(digests.archivedSecurities);
  const publishedDay = manifest.referenceDate;
  function entity(kind, id) {
    if (Object.hasOwn(digests[kind], id)) return digests[kind][id];
    const file = path.join(input, 'data', kind, id + '.json');
    const source = fs.existsSync(file) ? file : file + '.gz';
    return digests[kind][id] = sha256(source);
  }
  const companyMemo = new Map();
  const hasCompanyMembers = id => digests.companyMembers && Object.hasOwn(digests.companyMembers, id);
  const companyMembers = id => hasCompanyMembers(id) ? digests.companyMembers[id] : members.get(id) ?? [];
  function company(id) {
    if (!id) return null;
    if (!companyMemo.has(id)) {
      const companyId = String(id);
      const companySecurities = companyMembers(companyId);
      // A lagging company publication can still include an ended security in its
      // rolling dividend comparison, whose window follows the security publication.
      companyMemo.set(id, hash([entity('company', companyId), companySecurities.map(sid => entity('security', sid)),
        companySecurities.some(sid => archivedSecurities.has(sid)) ? publishedDay : null]));
    }
    return companyMemo.get(id);
  }
  const rankManifests = new Map();
  for (const base of rankBases) {
    const file = path.join(input, rankInput(base));
    if (fs.existsSync(file)) rankManifests.set(base, readJson(file));
  }
  const rankPage = (base, page) => {
    const ranking = rankManifests.get(base);
    return ranking ? rankingManifestForPage(ranking, page) : null;
  };
  const arenaFile = path.join(input, 'data', 'dashboard-arena-history.json');
  const arena = fs.existsSync(arenaFile) ? sha256(arenaFile) : null;
  return Object.fromEntries(manifest.routes.map(({ path: address }) => {
    const [kind, code] = routePath(address).split('/').slice(1);
    if (kind === 'security') {
      const id = manifest.securityAliases[code];
      const row = identityById.get(id);
      if (!row) throw new Error(`Unknown security route input: ${address}`);
      return [address, hash([row, entity(kind, id), company(row.companyId), archivedSecurities.has(id) ? null : publishedDay])];
    }
    if (kind === 'company') {
      const id = manifest.companyAliases[code];
      const active = !hasCompanyMembers(id) || companyMembers(id).length > 0;
      return [address, hash([company(id), manifest.companyRoutes?.[id], active ? publishedDay : null])];
    }
    if (address === '/') return [address, hash([rankPage('marketcaps', 1), manifest.marketCsv, publishedDay])];
    if (kind === 'dashboard') return [address, hash([
      rankPage('marketcaps', 1), [...rankManifests].filter(([base]) => base !== 'marketcaps')
        .map(([base, ranking]) => [base, ranking.scopes['krx-all']]), arena, manifest.marketCsv, publishedDay,
    ])];
    const page = code?.includes('~') ? Number(code.split('~').at(-1)) : Number(code || 1);
    return [address, hash([address, rankPage(kind, page), manifest.marketCsv, publishedDay])];
  }));
}

function planRender(routes, previous, sameCode) {
  const changed = Object.keys(routes).filter(address => !sameCode || routes[address] !== previous?.[address]);
  const removed = Object.keys(previous ?? {}).filter(address => !Object.hasOwn(routes, address));
  return { changed, removed };
}

module.exports = { routeFingerprints, planRender };
