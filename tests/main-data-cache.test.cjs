const assert = require('node:assert/strict');
const test = require('node:test');
const { fixture, loadModules, day } = require('./helpers/business-data.cjs');

test('DTO preserves bigint exactly, Korea business day, zero/negative/NULL and UTC audit time', () => {
  const { toDataDTO, businessDate } = loadModules()('lib/data/dto.ts');
  const converted = toDataDTO({ date: day('2000-01-04'), marketcapDate: day('2000-01-04'),
    valueObservedAt: day('2000-01-04'), amount: 9007199254740993n, zero: 0, loss: -1, missing: null,
    createdAt: new Date('2000-01-03T15:00:00Z') });
  assert.deepEqual(converted, { date: '2000-01-04', marketcapDate: '2000-01-04', valueObservedAt: '2000-01-04',
    amount: '9007199254740993', zero: 0, loss: -1, missing: null, createdAt: '2000-01-03T15:00:00.000Z' });
  assert.doesNotThrow(() => JSON.stringify(converted));
  assert.equal(businessDate('2000-01-03T15:00:00Z'), '2000-01-04');
  assert.throws(() => toDataDTO({ bps: NaN }));
});

test('current mutable reads never retain old successful or failed results in a persistent data cache', async () => {
  const { cachedData } = loadModules()('lib/data/cache-policy.ts');
  let value = 1n, failure = false, calls = 0;
  const read = cachedData(async () => { calls++; if (failure) throw new Error('unavailable'); return { value }; }, 'sample', []);
  assert.deepEqual(await read(), { value: '1' }); value = 2n;
  assert.deepEqual(await read(), { value: '2' }); failure = true;
  await assert.rejects(read(), /unavailable/); failure = false;
  assert.deepEqual(await read(), { value: '2' }); assert.equal(calls, 4);
});

test('company official total stays tem stored exact value with no active analysis constituents', async () => {
  const { state, load } = fixture();
  const data = load('lib/data/company.ts');
  const result = await data.getCompanyAggregatedMarketcap('company-1');
  assert.equal(result.totalMarketcap, '9007199254740993'); assert.equal(result.marketcapCompleteness, 'complete');
  assert.deepEqual(result.securities, []);
  assert.deepEqual(result.aggregatedHistory.map(row => [row.date, row.totalMarketcap, row.observedCount, row.targetCount]),
    [['2026-10-02', null, 0, 0]]);
  assert.equal(result.compositionComplete, false);
  assert.equal(state.queries.some(row => row.table === 'marketcap'), false);
  state.companies[0].marketcap = null; state.companies[0].marketcapCompleteness = 'missing_input';
  state.companies[0].rankingState = 'excluded'; state.companies[0].marketcapRank = null;
  const missing = await data.getCompanyAggregatedMarketcap('company-1');
  assert.equal(missing.totalMarketcap, null); assert.equal(missing.marketcapCompleteness, 'missing_input');
});

test('old/unpublished master result never leaks through the current company DTO', async () => {
  const { state, load } = fixture();
  state.companies[0].resultRevision = 2n;
  const result = await load('lib/data/company.ts').getCompanyAggregatedMarketcap('company-1');
  assert.equal(result.state, 'unpublished'); assert.equal(result.totalMarketcap, null); assert.equal(result.publication, null);
});

test('history bounds are SQL dates in Korea, reject invalid/descending ranges, preserve NULL and zero', async () => {
  const { state, load } = fixture();
  state.metrics = [{ securityId: 'security-1', date: day('2000-01-04'), bps: null, per: 0, eps: -10, bpsState: 'source_missing', perState: 'provided' }];
  const data = load('lib/data/security.ts');
  const rows = await data.getSecurityMetricsHistory('security-1', '2000-01-01', '2000-01-31');
  assert.equal(rows[0].date, '2000-01-04'); assert.equal(rows[0].bps, null); assert.equal(rows[0].per, '0'); assert.equal(rows[0].eps, '-10');
  assert.match(state.queries.at(-1).sql, />=/); assert.match(state.queries.at(-1).sql, /<=/);
  await assert.rejects(data.getSecurityPriceHistory('security-1', '2000-02-30'), /올바르지/);
  await assert.rejects(data.getSecurityPriceHistory('security-1', '2000-02-01', '2000-01-01'), /이후/);
});
