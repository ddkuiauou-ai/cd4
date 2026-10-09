const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, day } = require('./helpers/business-data.cjs');
const { installQueryCounter } = require('../scripts/static-query-counter.cjs');

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
    for (const security of state.securities) for (const date of ['2026-10-01', '2026-10-02', '2026-10-03']) {
      state.prices.push({ securityId: security.securityId, date: day(date), close: '9007199254740993.125', volume: 9007199254740993n });
      state.marketcaps.push({ securityId: security.securityId, date: day(date), marketcap: 9007199254740993n, shares: 0n });
      state.metrics.push({ securityId: security.securityId, date: day(date), per: '-5', pbr: '0', eps: null });
    }
    const provider = load('lib/data/security.ts'), history = load('lib/data/history.ts');
    const { readSecurityBatch } = load('lib/static-build/read-security-batch.ts');
    const routeCodes = load('lib/entity-paths.ts').securityRouteCodes(state.securities);
    const securityHeader = state.publications.find(row => row.resultKind === 'security_latest') ?? null;
    const companyHeader = state.publications.find(row => row.resultKind === 'company_marketcap') ?? null;
    const before = state.queries.length;
    const result = await db.transaction(tx => readSecurityBatch(tx, state.securities, new Map(state.companies.map(row => [row.companyId, row])),
      securityHeader, companyHeader, routeCodes));
    const queries = state.queries.slice(before);
    assert.ok(queries.length <= 4, 'one bounded batch reads at most four source history queries');
    assert.ok(queries.every(row => ['price', 'marketcap', 'bppedd'].includes(row.table)), 'master/publication/route inventory is reused');
    for (const actual of result.items) {
      const expected = await provider.getSecurityByCode(actual.securityId);
      assert.deepEqual(actual.security, expected, `security DTO with cutoffs ${securityDate}/${companyDate}`);
      const expectedMetrics = await history.readMetricsHistory(db, actual.securityId, undefined, expected.publication?.asOf);
      assert.deepEqual(actual.metrics, expectedMetrics, 'stale masters retain the provider default unrestricted metric range');
      const expectedCompanyHistory = await history.readMarketcapHistory(db, [actual.securityId], undefined, companyDate ?? undefined);
      assert.deepEqual(actual.allMarketcaps.filter(row => !companyDate || row.date <= companyDate), expectedCompanyHistory);
    }
    assert.ok(result.items.every(row => row.security.prices.every(price => price.close === '9007199254740993.125')));
  }
});
