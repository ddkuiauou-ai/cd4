const assert = require('node:assert/strict');
const test = require('node:test');
const { fixture, day } = require('./helpers/business-data.cjs');

test('detail keeps tem exclusion reason and publication date without current-listing rejudgment', async () => {
  const { state, load } = fixture();
  state.ranks[0].currentRank = null;
  state.ranks[0].rankingState = 'excluded'; state.ranks[0].exclusionReason = 'rule:negative-per';
  const result = await load('lib/data/security-ranking-detail.ts').getSecurityMetricDetailRanking('security-1', 'per');
  assert.equal(result.state, 'published'); assert.equal(result.currentRank, null);
  assert.equal(result.rankingState, 'excluded'); assert.equal(result.exclusionReason, 'rule:negative-per');
  assert.equal(result.rankDate, '2026-10-02'); assert.equal(result.value, '-5');
  assert.doesNotMatch(state.queries.at(-1).sql, /delisting_date/);
});

test('latest missing is never replaced by last provided, including a last zero/negative value', async () => {
  for (const last of [0, -5]) {
    const { state, load } = fixture(); const security = state.securities[0];
    Object.assign(security, { per: null, perState: 'source_missing', perLastProvided: last,
      perLastProvidedDate: day('2026-09-25'), perLastProvidedSourceRef: 'tem://source/older' });
    const result = await load('lib/data/security.ts').getSecurityByCode('security-1');
    assert.equal(result.per, null); assert.equal(result.perState, 'source_missing');
    assert.equal(result.perLastProvided, String(last)); assert.equal(result.perLastProvidedDate, '2026-09-25');
    assert.equal(result.marketcap, '9007199254740993'); assert.equal(result.bps, '0');
  }
});

test('stale official security row masks all current/last values but keeps identity and raw history', async () => {
  const { state, load } = fixture();
  state.securities[0].resultRevision = 2n;
  state.prices = [{ securityId: 'security-1', date: day('2026-10-02'), close: 123 }];
  const result = await load('lib/data/security.ts').getSecurityByCode('security-1');
  assert.equal(result.state, 'unpublished'); assert.equal(result.marketcap, null); assert.equal(result.bps, null);
  assert.equal(result.bpsLastProvided, null); assert.equal(result.bpsState, 'no_observation');
  assert.equal(result.securityId, 'security-1'); assert.equal(result.prices[0].close, '123');
});

test('market.ticker lookup uses both fields, ambiguity yields no arbitrary reused-code match', async () => {
  const { state, load } = fixture();
  state.securities.push({ ...state.securities[0], securityId: 'security-old' });
  const result = await load('lib/data/security.ts').getSecurityByCode('KOSPI.000001');
  assert.equal(result, null);
  assert.match(state.queries.at(-1).sql, /"exchange"/); assert.match(state.queries.at(-1).sql, /"ticker"/);
  assert.deepEqual(state.queries.at(-1).params, ['KOSPI', '000001']);
});

test('neighbor lookup refuses a replaced revision or wrong business date', async () => {
  const { state, load } = fixture();
  const data = load('lib/data/security-ranking-detail.ts');
  assert.deepEqual(await data.getSecurityMetricNeighbors(1, 'per', '2026-10-02', '2'), []);
  assert.deepEqual(await data.getSecurityMetricNeighbors(1, 'per', '2026-10-01', '1'), []);
  assert.equal(state.queries.filter(row => row.table === 'security_rank').length, 0);
});
