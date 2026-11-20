const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { day, fixture } = require('./helpers/business-data.cjs');

const listing = (securityId, listingDate, delistingDate = null) => ({
  securityId,
  periodId: securityId + '-' + listingDate,
  listingDate,
  delistingDate,
  lastPresentOn: listingDate,
  listingSourceRef: 'fixture:listing',
  delistingSourceRef: delistingDate ? 'fixture:delisting' : null,
});
const orderById = (a, b) => a.securityId.localeCompare(b.securityId);

test('server and frozen search list only securities listed on the security publication day', async t => {
  const { load, state } = fixture();
  const master = { ...state.securities[0] };
  const addSecurity = (securityId, ticker, overrides = {}) => ({
    ...master, securityId, ticker, korName: securityId, listingDate: null, delistingDate: null, ...overrides,
  });
  state.publications[1].asOf = day('2026-10-01');
  state.securities = [
    addSecurity('closed', '005931', { delistingDate: day('2026-10-02') }),
    addSecurity('gap', '005932'),
    addSecurity('legacy', '005935'),
    addSecurity('legacy-future', '005929', { listingDate: day('2026-10-03') }),
    addSecurity('relisted', '005930', { marketcap: null, marketcapState: 'row_missing' }),
  ];
  state.listingPeriods = [
    listing('closed', '2026-10-01', '2026-10-02'),
    listing('gap', '2026-09-01', '2026-10-01'),
    listing('gap', '2026-10-03'),
    listing('relisted', '2026-09-01', '2026-09-23'),
    listing('relisted', '2026-10-02'),
  ];

  const frozen = mkdtempSync(join(tmpdir(), 'cd-listed-search-'));
  const previous = { NEXT_OUTPUT_MODE: process.env.NEXT_OUTPUT_MODE, STATIC_PREPARING: process.env.STATIC_PREPARING,
    STATIC_SNAPSHOT_DIR: process.env.STATIC_SNAPSHOT_DIR };
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(frozen, { recursive: true, force: true });
  });
  process.env.NEXT_OUTPUT_MODE = 'standalone';
  const { GET } = load('app/search-data.json/route.ts');
  const live = await (await GET()).json();
  assert.deepEqual(live.map(row => row.securityId), ['legacy', 'relisted']);
  assert.ok(live.every(row => row.companyRouteCode === 'KOSPI.005929'));
  assert.ok(live.every(row => !('listingDate' in row) && !('delistingDate' in row)));
  assert.deepEqual(state.transactions, [{ isolationLevel: 'repeatable read', accessMode: 'read only' }]);

  process.env.NEXT_OUTPUT_MODE = 'export';
  process.env.STATIC_PREPARING = '0';
  process.env.STATIC_SNAPSHOT_DIR = frozen;
  const write = (file, value) => writeFileSync(join(frozen, file), JSON.stringify(value));
  const { securityRouteCodes, companyRouteCodes } = load('lib/entity-paths.ts');
  const securities = securityRouteCodes(state.securities);
  const companies = companyRouteCodes(state.securities);
  const identities = state.securities.map(row => ({
    securityId: row.securityId, companyId: row.companyId, name: row.name, korName: row.korName,
    type: row.type, exchange: row.exchange, ticker: row.ticker, routeCode: securities.get(row.securityId),
    companyRouteCode: companies.get(row.companyId),
  }));
  write('manifest.json', { version: 1, securityAliases: { 'KOSPI.005931': 'closed' } });
  write('identities.json', identities);
  await assert.rejects(GET, { code: 'ENOENT' });

  const { listedSecurityPeriods } = load('lib/data/listed-security-periods.ts');
  write('search-security-ids.json',
    [...listedSecurityPeriods(state.securities, state.listingPeriods, '2026-10-02').keys()]);
  const exported = await (await GET()).json();
  assert.deepEqual(exported.toSorted(orderById), live.toSorted(orderById));
  assert.equal(load('lib/static-build/server.ts').resolveStaticSecurity('KOSPI.005931').securityId, 'closed');
  assert.equal(state.transactions.length, 1, 'static search has no database transaction');
});

test('search uses open episodes without a publication and propagates lookup failures', async () => {
  const { load, state } = fixture();
  state.publications = state.publications.filter(row => row.resultKind !== 'security_latest');
  const name = state.securities[0].securityId;
  state.securities[0].delistingDate = null;
  state.listingPeriods = [listing(name, '2026-10-01', '2026-10-02')];
  const { GET } = load('app/search-data.json/route.ts');
  assert.deepEqual(await (await GET()).json(), []);

  state.listingPeriods.push(listing(name, '2026-10-03'));
  assert.deepEqual((await (await GET()).json()).map(row => row.securityId), [name]);

  state.faults.add('listing-period');
  await assert.rejects(GET, /fixture-listing-period-unavailable/);
});
