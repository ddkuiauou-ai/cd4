const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, day } = require('./helpers/business-data.cjs');
const { installQueryCounter } = require('../scripts/static-query-counter.cjs');
const { getTableName } = require('drizzle-orm');
const { PgDialect } = require('drizzle-orm/pg-core');

test('SQL-free counter counts sent statements, transaction control and zero-query phases without retaining secrets', () => {
  const client = { options: { debug: false } };
  const counter = installQueryCounter(client);
  counter.phase('extract');
  client.options.debug('private-host', 'BEGIN');
  client.options.debug('private-host', 'SELECT password FROM private_table WHERE secret = $1', ['postgres://user:secret@private-host']);
  client.options.debug('private-host', 'COMMIT');
  counter.phase('file-render');
  const result = counter.snapshot();
  assert.equal(result.total, 3);
  assert.deepEqual(result.phases, { extract: 3, 'file-render': 0 });
  assert.deepEqual(result.commands, { BEGIN: 1, SELECT: 1, COMMIT: 1 });
  assert.doesNotMatch(JSON.stringify(result), /private_table|password|private-host|postgres:\/\/|user:secret/);
  counter.restore(); assert.equal(client.options.debug, false);
});

test('daily observations use three date-bounded reads for the existing market size, with bounded SQL parameters', async () => {
  const dialect = new PgDialect();
  const date = '2026-10-05';
  const ids = Array.from({ length: 10_001 }, (_, index) => `security-${index}`);
  const queries = [];
  const accurate = { securityId: ids[0], date, exchange: 'KOSPI', ticker: '000001', close: '9007199254740993.125' };
  const secondListing = { ...accurate, exchange: 'KOSDAQ', ticker: '000002', close: '0' };
  const observations = {
    price: [secondListing, accurate, { ...accurate, securityId: ids.at(-1), ticker: '000003' }],
    marketcap: [{ securityId: ids[0], date, marketcap: '9007199254740993', shares: '0' }],
    bppedd: [{ securityId: ids[0], date, per: '0', eps: null }],
  };
  const tx = {
    select: () => ({ from: table => ({ where: where => ({ orderBy: (...order) => {
      const tableName = getTableName(table);
      const { params } = dialect.sqlToQuery(where);
      assert.deepEqual(params.slice(-2), Array(2).fill(day(date).toISOString()));
      assert.deepEqual(order.map(term => dialect.sqlToQuery(term).sql),
        ['date', 'exchange', 'ticker'].map(column => `"${tableName}"."${column}" asc`));
      queries.push({ tableName, parameters: params.length });
      const selected = new Set(params.slice(0, -2));
      return Promise.resolve(observations[tableName].filter(row => selected.has(row.securityId)));
    } }) }) }),
  };
  const { readDailyHistorySources } = fixture().load('lib/static-build/read-security-batch.ts');
  const market = await readDailyHistorySources(tx, ids.slice(0, 5_496), date);
  assert.deepEqual(queries.splice(0), ['price', 'marketcap', 'bppedd'].map(tableName => ({ tableName, parameters: 5_498 })));
  assert.deepEqual(market.prices.get(ids[0]), [secondListing, accurate]);
  assert.deepEqual(market.marketcaps.get(ids[0]), observations.marketcap);
  assert.deepEqual(market.metrics.get(ids[0]), observations.bppedd);
  assert.equal(market.prices.has(ids[1]), false);
  assert.equal(market.prices.has(ids.at(-1)), false);

  const extended = await readDailyHistorySources(tx, [...ids, ids[0]], date);
  assert.deepEqual(queries.splice(0).map(row => row.parameters), [10_002, 10_002, 10_002, 3, 3, 3]);
  assert.deepEqual(extended.prices.get(ids.at(-1)), [observations.price.at(-1)]);
  assert.deepEqual(extended.prices.get(ids[0]), market.prices.get(ids[0]));
  const empty = await readDailyHistorySources(tx, [], date);
  assert.deepEqual(empty, { prices: new Map(), marketcaps: new Map(), metrics: new Map() });
  assert.equal(queries.length, 0);
});

test('batched histories equal live providers for current/stale masters and older/newer/missing publications', async t => {
  const previous = process.env.STATIC_PREPARING; process.env.STATIC_PREPARING = '1';
  t.after(() => { if (previous === undefined) delete process.env.STATIC_PREPARING; else process.env.STATIC_PREPARING = previous; });
  for (const [securityDate, companyDate] of [['2026-10-02', '2026-10-01'], ['2026-10-02', '2026-10-03'], ['2026-10-02', null], [null, '2026-10-02'], [null, null]]) {
    const { state, load, db } = fixture();
    if (securityDate) state.publications.find(row => row.resultKind === 'security_latest').asOf = day(securityDate);
    else state.publications = state.publications.filter(row => row.resultKind !== 'security_latest');
    if (companyDate) state.publications.find(row => row.resultKind === 'company_marketcap').asOf = day(companyDate);
    else state.publications = state.publications.filter(row => row.resultKind !== 'company_marketcap');
    state.securities.push({ ...state.securities[0], securityId: 'stale', ticker: '000002', resultRevision: 2n });
    state.listingPeriods.push({ securityId: 'security-1', periodId: 'open-period', listingDate: '2026-10-01',
      delistingDate: null, lastPresentOn: '2026-10-02' });
    state.lifecycleEvents.push({ eventId: 'rename', securityId: 'security-1', companyId: 'company-1',
      eventType: 'security_name_change', effectiveOn: '2026-10-01', datePrecision: 'day',
      oldName: '이전 종목명', newName: '변경 종목명' });
    for (const security of state.securities) for (const date of ['2026-10-01', '2026-10-02', '2026-10-03']) {
      state.prices.push({ securityId: security.securityId, date: day(date), close: '9007199254740993.125', volume: 9007199254740993n });
      state.marketcaps.push({ securityId: security.securityId, date: day(date), marketcap: 9007199254740993n, shares: 0n });
      state.metrics.push({ securityId: security.securityId, date: day(date), per: '-5', pbr: '0', eps: null });
    }
    const provider = load('lib/data/security.ts'), history = load('lib/data/history.ts');
    const { readBatchLifecycles, readSecurityBatch } = load('lib/static-build/read-security-batch.ts');
    const routeCodes = load('lib/entity-paths.ts').securityRouteCodes(state.securities);
    const securityHeader = state.publications.find(row => row.resultKind === 'security_latest') ?? null;
    const companyHeader = state.publications.find(row => row.resultKind === 'company_marketcap') ?? null;
    const companies = new Map(state.companies.map(row => [row.companyId, row]));
    const before = state.queries.length;
    const result = await db.transaction(tx => readSecurityBatch(tx, state.securities, companies,
      securityHeader, companyHeader, routeCodes));
    const queries = state.queries.slice(before);
    assert.ok(queries.length <= 7, 'one bounded batch reads at most four histories and three lifecycle/name queries');
    assert.ok(queries.every(row => ['price', 'marketcap', 'bppedd','listing-period','lifecycle-event','security_listing_period'].includes(row.table)), 'master/publication/route inventory is reused');
    for (const actual of result.items) {
      const expected = await provider.getSecurityByCode(actual.securityId);
      assert.deepEqual(actual.security, expected, `security DTO with cutoffs ${securityDate}/${companyDate}`);
      const expectedMetrics = await history.readMetricsHistory(db, actual.securityId, undefined, expected.publication?.asOf);
      assert.deepEqual(actual.metrics, expectedMetrics, 'stale masters retain the provider default unrestricted metric range');
      const companyCutoff = companyDate ?? securityDate;
      const expectedCompanyHistory = await history.readMarketcapHistory(db, [actual.securityId], undefined, companyCutoff ?? undefined);
      assert.deepEqual(actual.allMarketcaps, expectedCompanyHistory);
    }
    assert.ok(result.items.every(row => row.security.prices.every(price => price.close === '9007199254740993.125')));

    const prefetched = await db.transaction(async tx => {
      const lifecycle = await readBatchLifecycles(tx, state.securities.map(row => row.securityId));
      assert.equal(lifecycle.periods.get('security-1')[0].periodId, 'open-period');
      assert.equal(lifecycle.events.get('security-1')[0].eventId, 'rename');
      const priorQueries = state.queries.length;
      const batches = await Promise.all(state.securities.map(row => readSecurityBatch(tx, [row], companies,
        securityHeader, companyHeader, routeCodes, undefined, { lifecycle })));
      assert.ok(state.queries.slice(priorQueries).every(row => ['price', 'marketcap', 'bppedd'].includes(row.table)));
      return batches.flatMap(batch => batch.items);
    });
    assert.deepEqual(prefetched, result.items);
  }
});
