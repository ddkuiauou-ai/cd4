const assert = require('node:assert/strict');
const test = require('node:test');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');
const { layoutRankingQuote } = createBusinessPageLoader().load('lib/ranking-quote-layout.ts');

const point = (x, y) => ({ x, y });
const layout = (segments, overrides = {}) => layoutRankingQuote({
  width: 120, height: 30, hasEndpoint: true, segments, ...overrides,
});

test('short and wide plots keep their shape and the 14px endpoint inset', () => {
  const segments = [[point(0, 0), point(0.5, 1), point(1, 0)]];
  const narrow = layout(segments);
  assert.deepEqual(narrow.segments[0], [point(7, 7), point(60, 23), point(113, 7)]);
  assert.deepEqual(narrow.endpoint, point(113, 7));
  const wide = layout(segments, { width: 450, height: 46 });
  assert.deepEqual(wide.segments[0], [point(7, 7), point(225, 39), point(443, 7)]);
  assert.deepEqual(wide.endpoint, point(443, 7));
});

test('gap segments, single observations and missing endpoints keep their meaning', () => {
  const source = [[point(0, 0.5)], [], [point(0.75, 1), point(1, 0)]];
  const snapshot = JSON.stringify(source);
  const result = layout(source, { width: 300, height: 56 });
  assert.deepEqual(result.segments.map(segment => segment.length), [1, 2]);
  assert.deepEqual(result.endpoint, point(293, 7));
  assert.equal(JSON.stringify(source), snapshot, 'Layout must not mutate normalized finance geometry');
  assert.deepEqual(layout([[point(0.5, 0.5)]]).endpoint, point(60, 15));
  assert.equal(layout(source, { hasEndpoint: false }).endpoint, null);
  assert.equal(layout([]).endpoint, null);
});
