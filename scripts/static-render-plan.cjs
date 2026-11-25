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
  function entity(kind, id) {
    if (Object.hasOwn(digests[kind], id)) return digests[kind][id];
    const file = path.join(input, 'data', kind, id + '.json');
    const source = fs.existsSync(file) ? file : file + '.gz';
    return digests[kind][id] = sha256(source);
  }
  const companyMemo = new Map();
  function company(id) {
    if (!id) return null;
    if (!companyMemo.has(id)) {
      const companyId = String(id);
      companyMemo.set(id, hash([entity('company', companyId), (members.get(companyId) ?? []).map(sid => entity('security', sid))]));
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
  const packYear = manifest.referenceDate?.slice(0, 4);
  return Object.fromEntries(manifest.routes.map(({ path: address }) => {
    const [kind, code] = routePath(address).split('/').slice(1);
    if (kind === 'security') {
      const id = manifest.securityAliases[code];
      const row = identityById.get(id);
      if (!row) throw new Error(`Unknown security route input: ${address}`);
      return [address, hash([entity(kind, id), company(row.companyId), packYear])];
    }
    if (kind === 'company') return [address, hash([company(manifest.companyAliases[code]), packYear])];
    if (address === '/') return [address, hash([rankPage('marketcaps', 1), manifest.marketCsv])];
    if (kind === 'dashboard') return [address, hash([
      rankPage('marketcaps', 1), [...rankManifests].filter(([base]) => base !== 'marketcaps')
        .map(([base, ranking]) => [base, ranking.scopes['krx-all']]), arena, manifest.marketCsv,
    ])];
    const page = code?.includes('~') ? Number(code.split('~').at(-1)) : Number(code || 1);
    return [address, hash([address, rankPage(kind, page), manifest.marketCsv])];
  }));
}

function planRender(routes, previous, sameCode) {
  const changed = Object.keys(routes).filter(address => !sameCode || routes[address] !== previous?.[address]);
  const removed = Object.keys(previous ?? {}).filter(address => !Object.hasOwn(routes, address));
  return { changed, removed };
}

module.exports = { routeFingerprints, planRender };
