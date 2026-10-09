const assert = require('node:assert/strict');
const test = require('node:test');
const { fixture, publication, day } = require('./helpers/business-data.cjs');

test('published ranking keeps tem membership, negative values and exact revision; no MAX or current delisting filter', async () => {
  const { state, load } = fixture();
  state.publications.find(row => row.resultKind === 'security_rank').revision = 9007199254740993n;
  const data = load('lib/data/security.ts');
  const result = await data.getSecurityRanksPage('per', 1);
  assert.equal(result.state, 'published');
  assert.equal(result.totalCount, 1);
  assert.equal(result.latestDate, '2026-10-02');
  assert.equal(result.items[0].value, '-5');
  assert.equal(result.publication.revision, '9007199254740993');
  const query = state.queries.find(row => row.table === 'security_rank');
  assert.match(query.sql, /"publication_key"/);
  assert.match(query.sql, /"result_revision"/);
  assert.match(query.sql, /"calculation_id"/);
  assert.match(query.sql, /"scope_key"/);
  assert.ok(query.params.includes('included'));
  assert.doesNotMatch(query.sql, /delisting_date|max\(/i);
  assert.deepEqual(state.transactions, [{ isolationLevel: 'repeatable read', accessMode: 'read only' }]);
});

test('unpublished and published zero-result are distinct, and old revision refuses silent page mixing', async () => {
  const { state, load } = fixture();
  const data = load('lib/data/security.ts');
  state.publications = state.publications.filter(row => row.resultKind !== 'security_rank');
  assert.equal((await data.getSecurityRanksPage('per', 1)).state, 'unpublished');
  state.publications.push(publication('security_rank', 'per', 2n, 0));
  state.ranks = [];
  const empty = await data.getSecurityRanksPage('per', 1);
  assert.equal(empty.state, 'published'); assert.equal(empty.totalCount, 0);
  const replaced = await data.getSecurityRanksPage('per', 2, 'asc', 'krx-all', '1');
  assert.equal(replaced.revisionChanged, true); assert.deepEqual(replaced.items, []);
  assert.equal(state.queries.filter(row => row.table === 'security_rank').length, 1);
});

test('publication replacement during a request does not mix count and rows; next request reads new revision without cache', async () => {
  const { state, load } = fixture();
  const data = load('lib/data/security.ts');
  state.afterHeader = current => {
    current.publications.find(row => row.resultKind === 'security_rank').revision = 2n;
    current.publications.find(row => row.resultKind === 'security_rank').includedCount = 0;
    current.ranks = [];
    current.afterHeader = null;
  };
  const before = await data.getSecurityRanksPage('per', 1);
  assert.equal(before.publication.revision, '1'); assert.equal(before.items.length, 1); assert.equal(before.totalCount, 1);
  const after = await data.getSecurityRanksPage('per', 1);
  assert.equal(after.publication.revision, '2'); assert.equal(after.items.length, 0); assert.equal(after.totalCount, 0);
});

test('header/query errors propagate and a later read recovers', async () => {
  for (const kind of ['publication', 'rows']) {
    const { state, load } = fixture(); const data = load('lib/data/security.ts');
    state.faults.add(kind);
    await assert.rejects(data.getSecurityRanksPage('per', 1), new RegExp(`fixture-${kind}-unavailable`));
    state.faults.clear(); assert.equal((await data.getSecurityRanksPage('per', 1)).items.length, 1);
  }
});

test('metric dates are resolved from their own publication, never a shared latest rank date', async () => {
  const { state, load } = fixture();
  state.publications.push({ ...publication('security_rank', 'bps'), asOf: day('2026-09-25') });
  const data = load('lib/data/ranking.ts');
  assert.equal(await data.getEffectiveRankDate('per'), '2026-10-02');
  assert.equal(await data.getEffectiveRankDate('bps'), '2026-09-25');
  assert.equal(await data.getEffectiveRankDate('multi'), null);
});
