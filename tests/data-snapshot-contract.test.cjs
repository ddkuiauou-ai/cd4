const assert = require('node:assert/strict');
const test = require('node:test');
const { fixture, day } = require('./helpers/business-data.cjs');

function rawPrice(securityId, date, value = 100) {
  return { id: 1, securityId, date: day(date), ticker: '000001', exchange: 'KOSPI', sourceRef: 'source://price',
    open: value, high: value, low: value, close: value, volume: 9007199254740993n, transaction: null,
    rate: -0.25, fvolume: null, year: Number(date.slice(0, 4)), month: Number(date.slice(5, 7)),
    createdAt: day(date), updatedAt: day(date) };
}
function rawMarketcap(securityId, date, value) {
  return { ...rawPrice(securityId, date), marketcap: BigInt(value), shares: 10n };
}

test('registered company sums retain partial coverage, actual zero, no observations and exact big integers', () => {
  const { load } = fixture();
  const { aggregateRegisteredCompanyHistory } = load('lib/data/registered-company-history.ts');
  const rows = aggregateRegisteredCompanyHistory(['b', 'a', 'b'], [
    { securityId: 'a', date: '2026-10-01', marketcap: '9007199254740993' },
    { securityId: 'b', date: '2026-10-01', marketcap: '2' },
    { securityId: 'a', date: '2026-10-02', marketcap: '0' },
    { securityId: 'b', date: '2026-10-02', marketcap: null },
    { securityId: 'outside', date: '2026-10-03', marketcap: '999' },
  ], ['2026-10-04']);
  assert.deepEqual(rows.map(row => [row.date, row.totalMarketcap, row.observedCount, row.targetCount, row.partial]), [
    ['2026-10-01', '9007199254740995', 2, 2, false], ['2026-10-02', '0', 1, 2, true],
    ['2026-10-04', null, 0, 2, true],
  ]);
  assert.deepEqual(rows[1].securitiesBreakdown, { a: '0', b: null });
  assert.deepEqual(rows[1].observedSecurityIds, ['a']);
  assert.throws(() => aggregateRegisteredCompanyHistory(['a'], [
    { securityId: 'a', date: '2026-10-01', marketcap: '1' },
    { securityId: 'a', date: '2026-10-01', marketcap: '2' },
  ]), /중복/);
});

test('company official total remains authoritative while its registered history and composition expose coverage', async () => {
  const { state, load } = fixture();
  state.securities[0].delistingDate = null;
  state.securities.push({ ...state.securities[0], securityId: 'security-2', ticker: '000002', type: '우선주' });
  state.marketcaps = [rawMarketcap('security-1', '2026-10-01', '0'), rawMarketcap('security-1', '2026-10-02', '9007199254740993')];
  const data = load('lib/data/company.ts');
  const partial = await data.getCompanyAggregatedMarketcap('company-1');
  assert.equal(partial.totalMarketcap, '9007199254740993');
  assert.equal(partial.marketcapRank, 1);
  assert.equal(partial.registeredHistory[0].totalMarketcap, '0');
  assert.equal(partial.registeredHistory[1].observedCount, 1);
  assert.equal(partial.registeredHistory[1].targetCount, 2);
  assert.equal(partial.compositionComplete, false);
  assert.equal(partial.securities[1].marketcap, null);
  assert.ok(partial.securities.every(row => row.percentage === null));
  state.marketcaps.push(rawMarketcap('security-2', '2026-10-02', '0'));
  const complete = await data.getCompanyAggregatedMarketcap('company-1');
  assert.equal(complete.compositionComplete, true);
  assert.deepEqual(complete.securities.map(row => row.percentage), [100, 0]);
  state.marketcaps[1].marketcap = 1n;
  const different = await data.getCompanyAggregatedMarketcap('company-1');
  assert.equal(different.totalMarketcap, '9007199254740993');
  assert.equal(different.compositionComplete, false);
  assert.equal(different.compositionReason, 'different_total');
});

test('detail reads one repeatable snapshot, complete history before publication, full moving average warmup and exact DTOs', async () => {
  const { state, load } = fixture();
  state.securities[0].delistingDate = null;
  for (let index = 0; index < 250; index++) {
    const date = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
    state.prices.push(rawPrice('security-1', date, index));
    state.marketcaps.push(rawMarketcap('security-1', date, String(index)));
  }
  state.prices.push(rawPrice('security-1', '2026-10-03', 999));
  state.marketcaps.push(rawMarketcap('security-1', '2026-10-03', '999'));
  state.afterHeader = current => {
    current.publications.forEach(row => { row.revision = 2n; });
    current.prices = []; current.marketcaps = []; current.afterHeader = null;
  };
  const data = load('lib/data/detail-snapshot.ts');
  const snapshot = await data.getSecurityDetailSnapshot('security-1', 'price', '2026-08-01', '2026-09-30');
  assert.equal(snapshot.security.publication.revision, '1');
  assert.equal(snapshot.company.publication.revision, '1');
  assert.equal(snapshot.priceHistory.length, 250);
  assert.equal(snapshot.priceHistory[0].date, '2026-01-01');
  assert.equal(snapshot.priceHistory[0].close, '0');
  assert.equal(snapshot.priceHistory[0].volume, '9007199254740993');
  assert.equal(snapshot.priceHistory[0].rate, -0.25);
  assert.equal(snapshot.security.marketcaps.length, 250);
  assert.ok(snapshot.history.every(row => row.date >= '2026-08-01' && row.date <= '2026-09-30'));
  assert.equal(state.transactions.length, 1);
  assert.deepEqual(state.transactions[0], { isolationLevel: 'repeatable read', accessMode: 'read only' });
  assert.equal(state.queries.filter(row => row.table === 'publication').length, 2);
  assert.throws(() => data.getSecurityDetailSnapshot('security-1', 'price', '2026-02-30'), /날짜/);
  assert.throws(() => data.getCompanyDetailSnapshot('company-1', '2026-10-02', '2026-10-01'), /시작일/);
});

test('ranking prices are limited per security in one SQL batch and bounded by that publication', async () => {
  const { state, load } = fixture();
  for (let index = 0; index < 45; index++) {
    const date = new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10);
    state.prices.push(rawPrice('security-1', date, index));
  }
  state.prices.push(rawPrice('security-1', '2026-10-03', 999));
  const result = await load('lib/data/security.ts').getSecurityRanksPage('per', 1);
  assert.equal(result.items[0].prices.length, 30);
  assert.equal(result.items[0].prices.at(-1).close, '44');
  const batches = state.queries.filter(row => row.table === 'price-batch');
  assert.equal(batches.length, 1);
  assert.match(batches[0].sql, /CROSS JOIN LATERAL/);
  assert.match(batches[0].sql, /date <=/);
  assert.match(batches[0].sql, /ORDER BY date DESC LIMIT/);
  assert.ok(batches[0].params.includes('2026-10-01T15:00:00.000Z'));
  assert.ok(batches[0].params.every(value => !(value instanceof Date)), 'raw SQL parameters must use a driver-safe timestamp string');
  assert.equal(batches[0].params.at(-1), 30);
});

test('company rows survive absent common stock; representative prefers active common stock and aliases must be unique', async () => {
  const { state, load } = fixture();
  state.companies[0].industry = '제조업';
  state.companies[0].homepage = 'https://example.com';
  state.companies[0].establishedDate = day('1980-01-01');
  state.securities.push({ ...state.securities[0], securityId: 'preferred', type: '우선주', ticker: '000000', delistingDate: null });
  state.securities.push({ ...state.securities[0], securityId: 'active-common', ticker: '000003', delistingDate: null });
  const data = load('lib/data/company.ts');
  let result = await data.getCompanyRankingPage(1);
  assert.equal(result.items[0].representativeSecurity.securityId, 'active-common');
  assert.equal(result.items[0].routeCode, 'KOSPI.000003');
  state.securities.push({ ...state.securities.at(-1), securityId: 'reused-alias', companyId: 'outside-company' });
  result = await data.getCompanyRankingPage(1);
  assert.equal(result.items[0].routeCode, null);
  state.securities.forEach(row => { row.type = '우선주'; });
  result = await data.getCompanyRankingPage(1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].marketcap, '9007199254740993');
  assert.equal(result.items[0].representativeSecurity, null);
  assert.deepEqual(result.items[0].prices, []);
  const snapshot = await load('lib/data/detail-snapshot.ts').getCompanyDetailSnapshot('company-1');
  assert.equal(snapshot.security, null);
  assert.equal(snapshot.company.company.industry, '제조업');
  assert.equal(snapshot.company.company.homepage, 'https://example.com');
  assert.equal(snapshot.company.company.establishedDate, '1980-01-01');
});
