const assert = require('node:assert/strict');
const test = require('node:test');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');

test('unique legacy aliases survive while reused codes resolve to distinct stable paths', () => {
  const { load } = createBusinessPageLoader();
  const paths = load('lib/entity-paths.ts');
  const identities = [
    { securityId: 'common', companyId: 'company', type: '보통주', exchange: 'KOSPI', ticker: '005930' },
    { securityId: 'preferred', companyId: 'company', type: '우선주', exchange: 'KOSPI', ticker: '005935' },
    { securityId: 'old', companyId: null, exchange: 'KOSDAQ', ticker: '000001' },
    { securityId: 'new', companyId: null, exchange: 'KOSDAQ', ticker: '000001' },
  ];
  const securities = paths.securityRouteCodes(identities);
  const companies = paths.companyRouteCodes(identities.toReversed());
  assert.equal(paths.securityPath({ ...identities[0], routeCode: securities.get('common') }, 'pbr'), '/security/KOSPI.005930/pbr');
  assert.equal(paths.companyPath({ companyId: 'company', routeCode: companies.get('company') }, 'marketcap'), '/company/KOSPI.005930/marketcap');
  assert.equal(paths.securityPath({ ...identities[2], routeCode: securities.get('old') }, 'eps'), '/security/old/eps');
  assert.equal(paths.securityPath({ ...identities[3], routeCode: securities.get('new') }, 'eps'), '/security/new/eps');
});

test('display rounding never changes exact integers and zero/negative values stay visible', () => {
  const { load } = createBusinessPageLoader();
  const values = load('lib/business-analysis.ts');
  assert.equal(values.formatBusinessValue('9007199254740993'), '9,007,199,254,740,993');
  assert.equal(values.formatCompactBusinessValue('9007199254740993'), '9007조');
  assert.equal(values.addBusinessValues(['9007199254740993', '1']), '9007199254740994');
  assert.equal(values.subtractBusinessValues('9007199254740994', '9007199254740993'), '1');
  assert.equal(values.businessChangePercent('100', '100'), '0');
  assert.equal(values.businessChangePercent('0', '100'), null);
  assert.equal(values.formatCompactBusinessValue('-120000'), '-12만');
  assert.equal(values.formatBusinessValue('0'), '0');
  assert.equal(values.formatBusinessValue(null), '—');
  const projected = values.projectBusinessChartRows([
    { date: '2026-10-07', value: '9007199254740993' },
    { date: '2026-10-08', value: '9007199254740994' },
  ]);
  assert.deepEqual(projected.rows.map(row => row.plot), [0, 1]);
  assert.equal(values.businessChartAxisValue(projected.min, projected.max, 0), '9007199254740993');
  assert.equal(values.businessChartAxisValue(projected.min, projected.max, 1), '9007199254740994');
});

test('old recent aliases are upgraded without losing metrics or linking an ambiguous code arbitrarily', () => {
  const key = 'recently-viewed-securities';
  const record = (secCode, lastViewed, metrics, securityId) => ({ secCode, securityId, name: 'Samsung', korName: '삼성전자', ticker: '005930', exchange: 'KOSPI', lastViewed, metrics });
  const storage = new Map([[key, JSON.stringify([
    record('KOSPI.005930', 20, { pbr: { value: '0', lastViewed: 20 } }),
    record('id', 10, { marketcap: { value: '9007199254740993', lastViewed: 10 } }, 'id'),
    record('KOSPI.000001', 5, { eps: { value: '-10', lastViewed: 5 } }),
  ])]]);
  global.window = { dispatchEvent() {} };
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  global.StorageEvent = class { constructor(type, data) { Object.assign(this, { type }, data); } };
  try {
    const recent = createBusinessPageLoader().load('lib/recent-securities.ts');
    recent.migrateRecentSecurityIdentities([
      { securityId: 'id', exchange: 'KOSPI', ticker: '005930' },
      { securityId: 'old', exchange: 'KOSPI', ticker: '000001' },
      { securityId: 'new', exchange: 'KOSPI', ticker: '000001' },
    ]);
    const rows = recent.getRecentlyViewedSecurities();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].securityId, 'id');
    assert.equal(rows[0].lastViewed, 20);
    assert.equal(rows[0].metrics.pbr.value, '0');
    assert.equal(rows[0].metrics.marketcap.value, '9007199254740993');
    assert.equal(recent.getRecentSecurityPath(rows[0]), '/security/KOSPI.005930/pbr');
    assert.equal(rows[1].secCode, 'KOSPI.000001');
    assert.equal(rows[1].securityId, undefined);
  } finally {
    delete global.window; delete global.localStorage; delete global.StorageEvent;
  }
});

test('recent basic and company visits retain their view while unique legacy identities are upgraded', () => {
  const storage = new Map();
  global.window = { dispatchEvent() {} };
  global.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  global.StorageEvent = class { constructor(type, data) { Object.assign(this, { type }, data); } };
  try {
    const recent = createBusinessPageLoader().load('lib/recent-securities.ts');
    const identity = { securityId: 'id', companyId: 'company', name: 'Samsung', korName: '삼성전자', type: '보통주', exchange: 'KOSPI', ticker: '005930' };
    const base = { ...identity, secCode: 'id', lastPath: '/security/id' };
    recent.addRecentlyViewedSecurity(base, 'marketcap', '0');
    recent.migrateRecentSecurityIdentities([identity]);
    assert.equal(recent.getRecentSecurityPath(recent.getRecentlyViewedSecurities()[0]), '/security/KOSPI.005930');
    recent.addRecentlyViewedSecurity({ ...base, lastPath: '/security/KOSPI.005930' }, 'marketcap', '0');
    assert.equal(recent.getRecentSecurityPath(recent.getRecentlyViewedSecurities()[0]), '/security/KOSPI.005930');
    recent.addRecentlyViewedSecurity({ ...base, lastPath: '/company/company' }, 'marketcap', '0');
    recent.migrateRecentSecurityIdentities([identity]);
    assert.equal(recent.getRecentSecurityPath(recent.getRecentlyViewedSecurities()[0]), '/company/KOSPI.005930');
    assert.equal(recent.getRecentlyViewedSecurities().length, 1);
  } finally {
    delete global.window; delete global.localStorage; delete global.StorageEvent;
  }
});
