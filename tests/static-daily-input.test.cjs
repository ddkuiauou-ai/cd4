const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
require('../scripts/register-typescript.cjs');
const { mergeBusinessDay, planDailyPublication, publicationHeads } = require('../scripts/static-daily-input.cjs');
const { encodePrivateHistory, readPrivateHistory } = require('../lib/static-build/private-history.ts');
const { gzipSync } = require('node:zlib');

const metrics = ['marketcap', 'per', 'pbr', 'eps', 'bps', 'div', 'dps'];
const keys = ['security_latest/krx-all', 'company_marketcap/krx-all', ...metrics.map(metric => 'security_rank/krx-all/' + metric)];
const publications = (asOf, revision) => keys.map(publicationKey => ({ publicationKey, asOf, revision, calculationId: 'pub-' + revision }));
const previous = { sample: { enabled: false }, sourcePublications: publicationHeads(publications('2026-12-30', 52n)) };

test('daily input requires a prior successful freeze and no-ops on a reread or incomplete publication', () => {
  assert.equal(planDailyPublication({ previous: null, publications: publications('2026-12-30', 52n) }).reason, 'missing-previous-full');
  assert.equal(planDailyPublication({ previous, publications: publications('2026-12-30', 52n) }).reason, 'same-publication');
  assert.deepEqual(planDailyPublication({ previous, publications: publications('2026-12-30', 52n), expectedDay: '2026-12-31' }),
    { unchanged: true, reason: 'publication-not-advanced', expectedDay: '2026-12-31', from: '2026-12-30' });
  assert.equal(planDailyPublication({ previous, publications: publications('2027-01-04', 53n).slice(0, -1) }).reason, 'publication-bundle-incomplete');
});

test('the next available business day may roll the calendar year, while corrections and skipped revisions require full', () => {
  assert.deepEqual(planDailyPublication({ previous, publications: publications('2027-01-04', 53n) }), { from: '2026-12-30', day: '2027-01-04' });
  const correction = planDailyPublication({ previous, publications: publications('2026-12-30', 53n) });
  assert.equal(correction.requiresFull, true);
  assert.equal(correction.reason, 'historical-or-same-day-correction');
  const missed = planDailyPublication({ previous, publications: publications('2027-01-04', 54n) });
  assert.equal(missed.requiresFull, true);
  assert.equal(missed.reason, 'publication-revision-gap');
});

test('frozen row merge keeps exact zeros, nulls and large values and rejects a mixed date response', () => {
  const old = [{ date: '2026-12-29', value: '9007199254740993' }, { date: '2026-12-30', value: '0' },
    { date: '2026-12-31', value: '999999999' }];
  const today = [{ date: '2027-01-04', value: null }];
  assert.deepEqual(mergeBusinessDay(old, today, '2026-12-30', '2027-01-04'), [...old.slice(0, 2), ...today]);
  assert.throws(() => mergeBusinessDay(old, today, '2026-12-30', '2027-01-05'), /unexpected business day/);
});

test('gzip history sidecars restore exact stored rows in order across a calendar boundary', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-private-history.'));
  const base = 'data/security-history/aabb-ccdd';
  try {
    fs.mkdirSync(path.join(scratch, 'data/security-history'), { recursive: true });
    const build = (part, content) => fs.writeFileSync(path.join(scratch, base + part + '.json.gz'),
      gzipSync(JSON.stringify(encodePrivateHistory(content))));
    const empty = { marketcaps: [], metrics: [], companyMarketcaps: [] };
    const older = { date: '2026-12-30', close: '9007199254740993.0123', volume: null };
    const latest = { date: '2027-01-04', close: '0', volume: '0' };
    build('.archive', { ...empty, prices: [older] });
    build('.current', { ...empty, prices: [latest] });
    assert.deepEqual(readPrivateHistory(scratch, { archive: { path: base + '.archive.json' }, current: { path: base + '.current.json' } }),
      { ...empty, prices: [older, latest] });
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
});

test('preindexed neighbors return the first tied row of each distinct surrounding rank', () => {
  const { rankNeighborsByValue } = require('../scripts/static-source-index.cjs');
  const ordered = [[1,'a'], [1,'b'], [3,'c'], [3,'d'], [6,'e']];
  const neighbors = rankNeighborsByValue(ordered, row => row[0]);
  assert.deepEqual(neighbors(3), [[1,'a'], [6,'e']]);
  assert.deepEqual(neighbors(1), [undefined, [3,'c']]);
  assert.deepEqual(neighbors(5), [[3,'c'], [6,'e']]);
});
