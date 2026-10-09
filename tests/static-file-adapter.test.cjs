const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');
const { fixture, day } = require('./helpers/business-data.cjs');
const { createStaticAliases } = require('../scripts/static-aliases.cjs');
const { projectExpected, firstDifference, routeInventory, normalizeAuditTimestamps } = require('../scripts/verify-static-input.cjs');

function write(directory, filename, value) {
  const destination = path.join(directory, filename); fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(`${destination}.tmp`, JSON.stringify(value)); fs.renameSync(`${destination}.tmp`, destination);
}
function input(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cd4-static-adapter-'));
  const previous = process.env.STATIC_SNAPSHOT_DIR;
  process.env.STATIC_SNAPSHOT_DIR = directory;
  t.after(() => { if (previous === undefined) delete process.env.STATIC_SNAPSHOT_DIR; else process.env.STATIC_SNAPSHOT_DIR = previous;
    fs.rmSync(directory, { recursive: true, force: true }); });
  const manifest = { version: 1, snapshotId: 'one', securityAliases: {}, companyAliases: {}, securityCodes: [], companyCodes: [] };
  write(directory, 'manifest.json', manifest);
  return { directory, manifest, server: createBusinessPageLoader().load('lib/static-build/server.ts') };
}

test('static alias inventory mirrors live dotted syntax, combined ambiguity, and stable ID precedence', () => {
  const securities = [
    { securityId: 'one', companyId: 'company-one', exchange: 'KOSPI', ticker: '000001', name: 'Dotted.Name', korName: '공통명' },
    { securityId: 'two', companyId: 'company-two', exchange: 'KOSDAQ', ticker: '000001', name: '공통명', korName: '다른이름' },
    { securityId: '__proto__', companyId: 'constructor', exchange: 'NYSE', ticker: 'OTHER', name: 'one', korName: '.leading' },
  ];
  const aliases = createStaticAliases(securities, [{ companyId: 'company-one' }, { companyId: 'company-two' }, { companyId: 'constructor' }]);
  assert.equal(aliases.securityAliases['KOSPI.000001'], 'one');
  assert.equal(Object.hasOwn(aliases.securityAliases, '000001'), false);
  assert.equal(Object.hasOwn(aliases.securityAliases, '공통명'), false);
  assert.equal(Object.hasOwn(aliases.securityAliases, 'Dotted.Name'), false);
  assert.equal(aliases.securityAliases.one, 'one');
  assert.equal(aliases.securityAliases.__proto__, '__proto__');
  assert.equal(aliases.securityAliases['.leading'], '__proto__');
  assert.equal(aliases.companyAliases.constructor, 'constructor');
});

test('static JSON cache follows manifest replacement and input directory changes rather than serving old revisions', t => {
  const { directory, manifest, server } = input(t);
  const ranking = revision => ({ version: 1, metric: 'per', scope: 'security', scopes: { 'krx-all': {
    state: 'published', publication: { revision }, totalCount: 0, totalPages: 1, pages: { 1: '/ranking.json' }, csv: null } } });
  write(directory, 'rankings/security-per.json', ranking('1'));
  write(directory, 'assets/ranking.json', { items: [], revision: '1' });
  assert.equal(server.getStaticManifest().snapshotId, 'one');
  assert.equal(server.getStaticRankingPage('per', 'security', 1).revision, '1');
  write(directory, 'rankings/security-per.json', ranking('9007199254740993'));
  write(directory, 'assets/ranking.json', { items: [], revision: '9007199254740993' });
  write(directory, 'manifest.json', { ...manifest, snapshotId: 'two' });
  assert.equal(server.getStaticManifest().snapshotId, 'two');
  assert.equal(server.getStaticRankingPage('per', 'security', 1).revision, '9007199254740993');
  const second = fs.mkdtempSync(path.join(os.tmpdir(), 'cd4-static-adapter-next-'));
  t.after(() => fs.rmSync(second, { recursive: true, force: true }));
  write(second, 'manifest.json', { ...manifest, snapshotId: 'other-directory' });
  process.env.STATIC_SNAPSHOT_DIR = second;
  assert.equal(server.getStaticManifest().snapshotId, 'other-directory');
  process.env.STATIC_SNAPSHOT_DIR = directory;
  assert.equal(server.getStaticManifest().snapshotId, 'two');
});

test('static scope and identity lookups reject inherited keys but allow an actual stable prototype-named ID', t => {
  const { directory, manifest, server } = input(t);
  const aliases = createStaticAliases([{ securityId: '__proto__', companyId: 'constructor', exchange: 'KOSPI', ticker: '1' }], [{ companyId: 'constructor' }]);
  write(directory, 'identities.json', [{ securityId: '__proto__', companyId: 'constructor' }]);
  write(directory, 'companies.json', [{ companyId: 'constructor' }]);
  write(directory, 'manifest.json', { ...manifest, ...aliases });
  write(directory, 'rankings/security-per.json', { version: 1, metric: 'per', scope: 'security', scopes: {} });
  assert.equal(server.resolveStaticSecurity('__proto__').securityId, '__proto__');
  assert.equal(server.resolveStaticCompany('constructor').companyId, 'constructor');
  assert.equal(server.resolveStaticSecurity('constructor'), null);
  assert.equal(server.resolveStaticCompany('toString'), null);
  for (const key of ['__proto__', 'constructor', 'toString', 'missing']) {
    const result = server.getStaticRankingPage('per', 'security', 1, key);
    assert.equal(result.state, 'unpublished'); assert.deepEqual(result.items, []);
    assert.equal(server.getStaticRankingPage('per', 'security', 1, key, 'old').revisionChanged, true);
  }
  assert.deepEqual(server.getStaticRankingParams('per', 'security'), [{ page: '1' }]);
});

test('descending static ranks paginate the global reverse order across the twenty/hundred boundary', t => {
  const { directory, server } = input(t);
  const all = Array.from({ length: 125 }, (_, index) => ({ currentRank: index + 1 }));
  const pages = {};
  for (const [page, items] of [[1, all.slice(0, 20)], [2, all.slice(20, 120)], [3, all.slice(120)]]) {
    pages[page] = `/page-${page}.json`; write(directory, `assets/page-${page}.json`, { page, items });
  }
  write(directory, 'rankings/security-per.json', { scopes: { 'krx-all': {
    state: 'published', totalCount: 125, totalPages: 3, pages, publication: { revision: '1' } } } });
  const ranks = page => server.getStaticRankingPage('per', 'security', page, 'krx-all', undefined, true).items.map(row => row.currentRank);
  assert.deepEqual(ranks(1), all.slice(105).map(row => row.currentRank).reverse());
  assert.deepEqual(ranks(2), all.slice(5, 105).map(row => row.currentRank).reverse());
  assert.deepEqual(ranks(3), [5, 4, 3, 2, 1]);
  const tied = all.map((_, index) => ({ currentRank: 1, securityId: String(index).padStart(3, '0') }));
  for (const [page, items] of [[1, tied.slice(0, 20)], [2, tied.slice(20, 120)], [3, tied.slice(120)]]) {
    write(directory, `assets/page-${page}.json`, { page, items });
  }
  write(directory, 'manifest.json', { version: 1, snapshotId: 'ties' });
  assert.deepEqual(server.getStaticRankingPage('per', 'security', 1, 'krx-all', undefined, true).items,
    tied.slice(0, 20));
});

test('file detail adapter preserves live provider DTO fields, exact decimals, publication and date filtering', async t => {
  const { directory, manifest, server } = input(t);
  const previous = process.env.STATIC_PREPARING;
  process.env.STATIC_PREPARING = '1';
  t.after(() => { if (previous === undefined) delete process.env.STATIC_PREPARING; else process.env.STATIC_PREPARING = previous; });
  const { state, load } = fixture();
  state.securities[0].delistingDate = null;
  state.prices.push({ securityId: 'security-1', date: day('2026-10-01'), close: '9007199254740993.125', volume: '9007199254740993' });
  state.prices.push({ securityId: 'security-1', date: day('2026-10-02'), close: '0', volume: '0' });
  state.metrics.push({ securityId: 'security-1', date: day('2026-10-01'), per: '-5', pbr: '0', eps: null });
  state.marketcaps.push({ securityId: 'security-1', date: day('2026-10-02'), marketcap: '9007199254740993', shares: '9007199254740993' });
  const provider = load('lib/data/detail-snapshot.ts');
  const live = await provider.getSecurityDetailSnapshot('security-1', 'per');
  const liveCompany = await provider.getCompanyDetailSnapshot('company-1');
  const rankings = {};
  for (const metric of ['marketcap', 'per', 'pbr', 'eps', 'bps', 'div', 'dps']) {
    const detail = await provider.getSecurityDetailSnapshot('security-1', metric);
    rankings[metric] = { ranking: detail.ranking, neighbors: detail.neighbors };
  }
  write(directory, 'manifest.json', { ...manifest, securityAliases: { 'security-1': 'security-1', 'KOSPI.000001': 'security-1' },
    companyAliases: { 'company-1': 'company-1' } });
  write(directory, 'identities.json', [{ securityId: 'security-1', companyId: 'company-1' }]);
  write(directory, 'companies.json', [{ companyId: 'company-1' }]);
  write(directory, 'data/security/security-1.json', { security: live.security, metrics: live.history, assets: {}, rankings });
  write(directory, 'data/company/company-1.json', { company: live.company, companySecs: live.companySecs, neighbors: liveCompany.neighbors, assets: {} });
  const actual = server.getStaticSecurityDetail('KOSPI.000001', 'per');
  assert.equal(firstDifference(projectExpected(actual, live), live), null);
  assert.equal(actual.security.prices[1].close, '9007199254740993.125');
  assert.equal(server.getStaticSecurityDetail('security-1', 'price', '2026-10-02', '2026-10-02').history.length, 1);
  assert.equal(server.getStaticSecurityDetail('security-1', 'per', '2026-10-02').history.length, 0);
  assert.equal(firstDifference(projectExpected(server.getStaticCompanyDetail('company-1'), liveCompany), liveCompany), null);
});

test('route inventory accounts for every eight security, two company, ranking and first-page alias URL', () => {
  const manifest = { securityCodes: ['s1', 's2'], companyCodes: ['c1'], routes: Array(25),
    extraction: { sourceSecurities: 3004, sourceCompanies: 2745 } };
  const result = routeInventory(manifest, [{ scopes: { all: { totalPages: 1 } } }, { scopes: { all: { totalPages: 2 }, custom: { totalPages: 1 } } }]);
  assert.deepEqual(result, { expectedPages: 25, actualPages: 25, fullPlannedPages: 29529 });
});

test('parity normalization changes only audit timestamp representation and preserves exact financial/source dates', () => {
  assert.deepEqual(normalizeAuditTimestamps({ createdAt: '2026-10-08 17:13:44.278263+00',
    value: '9007199254740993.125', date: '2026-10-06', revision: '9007199254740993' }), {
    createdAt: '2026-10-08T17:13:44.278Z', value: '9007199254740993.125', date: '2026-10-06', revision: '9007199254740993' });
});
