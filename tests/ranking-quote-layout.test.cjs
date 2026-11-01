const assert = require('node:assert/strict');
const test = require('node:test');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');
const { layoutRankingQuote } = createBusinessPageLoader().load('lib/ranking-quote-layout.ts');

const point = (x, y) => ({ x, y });
const base = { width: 120, height: 88, price: { width: 64, height: 18 },
  rate: { width: 40, height: 16 }, overlay: true, hasEndpoint: true };
const layout = (segments, overrides = {}) => layoutRankingQuote({ ...base, segments, ...overrides });

test('rising, falling and flat trends retain the vertical reading order with deterministic free positions', () => {
  const rising = layout([[point(0, 1), point(1, 0)]]);
  assert.equal(rising.placement, 'overlay');
  assert.equal(rising.priceLeft, 0);
  assert.equal(rising.rateLeft, 80);
  const falling = layout([[point(0, 0), point(1, 1)]]);
  assert.equal(falling.placement, 'overlay');
  assert.equal(falling.priceLeft, 56);
  assert.equal(falling.rateLeft, 0);
  const flat = layout([[point(0, .5), point(1, .5)]]);
  assert.equal(flat.placement, 'overlay');
  assert.deepEqual(flat.segments[0].map(p => p.y), [44, 44]);
  assert.equal(flat.priceLeft, 56);
  assert.equal(flat.rateLeft, 80);
});

test('spikes and V shapes fall back to safe space without flattening below the minimum plot height', () => {
  for (const points of [
    [point(0, .5), point(.2, 0), point(.4, 1), point(.6, 0), point(.8, 1), point(1, .5)],
    [point(0, 0), point(.5, 1), point(1, 0)],
  ]) {
    const result = layout([points]);
    assert.equal(result.placement, 'safe');
    assert.equal(result.priceLeft, 56);
    assert.equal(result.rateLeft, 80);
    assert.equal(result.height, 88);
    const ys = result.segments.flat().map(p => p.y);
    assert.ok(Math.max(...ys) - Math.min(...ys) >= 30);
    assert.ok(Math.min(...ys) >= base.price.height + 11);
    assert.ok(Math.max(...ys) <= result.height - base.rate.height - 11);
  }
});

test('a connecting segment crossing a label is detected even when both observations lie outside it', () => {
  // Screen points (7,7) and (113,40) lie outside the right price rectangle
  // x=40..120/y=0..18, but the connecting segment enters its lower-left corner.
  const result = layout([[point(0, 0), point(1, 33 / 74)]], {
    price: { width: 80, height: 18 }, hasEndpoint: false,
  });
  assert.equal(result.placement, 'safe');
});

test('the 14px endpoint can reject a label that clears its isolated 4px data point', () => {
  const segments = [[point(58 / 106, 6 / 74)]]; // screen (65,13)
  const options = { price: { width: 48, height: 18 }, rate: { width: 48, height: 16 } };
  const unmarked = layout(segments, { ...options, hasEndpoint: false });
  const marked = layout(segments, options);
  assert.equal(unmarked.priceLeft, 72);
  assert.equal(marked.priceLeft, 0);
  assert.equal(marked.placement, 'overlay');
});

test('boundary contact counts as collision and isolated historic points are protected', () => {
  // Isolated point at x=50/y=10 touches the right price label's 6px clearance.
  const result = layout([[point(43 / 106, 3 / 74)], [point(1, .5)]], { hasEndpoint: false });
  assert.equal(result.placement, 'safe');
});

test('wrapped labels grow the canvas while keeping at least 30px for the line', () => {
  const result = layout([[point(0, 0), point(.5, 1), point(1, 0)]], {
    price: { width: 110, height: 45 }, rate: { width: 70, height: 32 }, height: 88,
  });
  assert.equal(result.height, 129);
  assert.equal(result.placement, 'safe');
  assert.equal(Math.max(...result.segments[0].map(p => p.y)) - Math.min(...result.segments[0].map(p => p.y)), 30);
});

test('gap segments, single zero observations and missing latest endpoints keep their meaning', () => {
  const source = [[point(0, .5)], [], [point(.75, 1), point(1, 0)]];
  const snapshot = JSON.stringify(source);
  const result = layout(source, { overlay: false, width: 300, height: 56 });
  assert.equal(result.segments.length, 2);
  assert.deepEqual(result.segments.map(s => s.length), [1, 2]);
  assert.deepEqual(result.endpoint, { x: 293, y: 7 });
  assert.equal(JSON.stringify(source), snapshot, 'Layout must not mutate normalized finance geometry');
  const singleZero = layout([[point(.5, .5)]]);
  assert.deepEqual(singleZero.endpoint, { x: 60, y: 44 });
  assert.equal(layout(source, { hasEndpoint: false }).endpoint, null);
  assert.equal(layout([]).endpoint, null);
});

test('separate layout uses the full measured chart with fixed marker insets', () => {
  const result = layout([[point(0, 0), point(1, 1)]], { overlay: false, width: 356, height: 56 });
  assert.equal(result.placement, 'separate');
  assert.equal(result.height, 56);
  assert.deepEqual(result.segments, [[{ x: 7, y: 7 }, { x: 349, y: 49 }]]);
  assert.deepEqual(result.endpoint, { x: 349, y: 49 });
});
