const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, day, publication } = require('./helpers/business-data.cjs');

function setup(t) {
  const previous = process.env.STATIC_PREPARING; process.env.STATIC_PREPARING = '1';
  t.after(() => { if (previous === undefined) delete process.env.STATIC_PREPARING; else process.env.STATIC_PREPARING = previous; });
  const context = fixture(), { state } = context;
  state.ranks[0].rankDate = day('2026-10-02'); state.ranks[0].scopeKey = 'krx-all'; state.ranks[0].metricType = 'per';
  return context;
}

test('ranking batch shares one cutoff price fetch across scopes and matches live rendered data and page metadata', async t => {
  const { state, load, db } = setup(t);
  state.securities.push({ ...state.securities[0], securityId: 'active', ticker: '000002', delistingDate: null });
  for (const id of ['security-1', 'active']) for (let index = 0; index < 45; index++) {
    state.prices.push({ securityId: id, date: day(new Date(Date.UTC(2026, 7, index + 1)).toISOString().slice(0, 10)),
      close: '9007199254740993.125', open: '0', volume: 9007199254740993n, rate: -2.5 });
  }
  state.prices.push({ securityId: 'security-1', date: day('2026-10-03'), close: '999', open: '999', volume: 1n, rate: 99 });
  const routeCodes = load('lib/entity-paths.ts').securityRouteCodes(state.securities);
  const prepared = load('lib/static-build/ranking-snapshots.ts').createPreparedRankings(state, routeCodes);
  const before = state.queries.length;
  await db.transaction(tx => prepared.loadPrices(tx));
  assert.equal(state.queries.slice(before).length, 1);
  assert.equal(prepared.stats.distinctCutoffs, 1);
  assert.equal(prepared.stats.distinctSecurityCutoffs, 2);
  const { createRankingRows } = load('lib/ranking-view.ts');
  for (const scope of ['security', 'company']) {
    const metric = scope === 'security' ? 'per' : 'marketcap';
    const expected = scope === 'security' ? await load('lib/data/security.ts').getSecurityRanksPage(metric, 1)
      : await load('lib/data/company.ts').getCompanyRankingPage(1);
    const actual = prepared.getPage(scope, metric, 1);
    assert.deepEqual({ ...actual, items: createRankingRows(actual.items, metric, scope) },
      { ...expected, items: createRankingRows(expected.items, metric, scope) });
    assert.equal(actual.items[0].prices.length, 30);
    assert.equal(actual.items[0].prices.at(-1).close, '9007199254740993.125');
  }
  assert.equal(prepared.getPage('company', 'marketcap', 1).items[0].representativeSecurity.securityId, 'active');
});

test('ranking batch enforces all publication membership fields and distinguishes zero from unpublished', async t => {
  const { state, load, db } = setup(t);
  const valid = state.ranks[0];
  for (const change of [{ scopeKey: 'other' }, { metricType: 'pbr' }, { rankDate: day('2026-10-01') },
    { resultRevision: 2n }, { calculationId: 'other' }, { publicationKey: 'other' }, { rankingState: 'excluded' }]) {
    state.ranks.push({ ...valid, ...change });
  }
  const create = () => load('lib/static-build/ranking-snapshots.ts').createPreparedRankings(state,
    load('lib/entity-paths.ts').securityRouteCodes(state.securities));
  const prepared = create(); await db.transaction(tx => prepared.loadPrices(tx));
  assert.equal(prepared.getPage('security', 'per', 1).items.length, 1);
  assert.equal(prepared.getPage('security', 'pbr', 1).state, 'unpublished');
  state.ranks = []; state.publications.find(row => row.resultKind === 'security_rank').includedCount = 0;
  const empty = create(); await db.transaction(tx => empty.loadPrices(tx));
  const zero = empty.getPage('security', 'per', 1);
  assert.equal(zero.state, 'published'); assert.equal(zero.totalCount, 0); assert.deepEqual(zero.items, []);
  assert.equal(zero.totalPages, 1);
});

test('ranking price caches use each publication cutoff and never substitute a newer observation', async t => {
  const { state, load, db } = setup(t);
  state.publications.find(row => row.resultKind === 'security_rank').asOf = day('2026-10-01');
  state.ranks[0].rankDate = day('2026-10-01'); state.ranks[0].valueObservedAt = day('2026-10-01');
  state.publications.push(publication('security_rank', 'pbr'));
  state.ranks.push({ ...state.ranks[0], metricType: 'pbr', publicationKey: 'security_rank/krx-all/pbr', rankDate: day('2026-10-02') });
  for (const [date, close] of [['2026-10-01', '10'], ['2026-10-02', '20'], ['2026-10-03', '30']]) {
    state.prices.push({ securityId: 'security-1', date: day(date), close, volume: 1n });
  }
  const prepared = load('lib/static-build/ranking-snapshots.ts').createPreparedRankings(state,
    load('lib/entity-paths.ts').securityRouteCodes(state.securities));
  await db.transaction(tx => prepared.loadPrices(tx));
  assert.equal(prepared.stats.distinctCutoffs, 2); assert.equal(prepared.stats.batches, 2);
  assert.equal(prepared.getPage('security', 'per', 1).items[0].prices.at(-1).close, '10');
  assert.equal(prepared.getPage('security', 'pbr', 1).items[0].prices.at(-1).close, '20');
  assert.equal(prepared.getPage('company', 'marketcap', 1).items[0].prices.at(-1).close, '20');
});
