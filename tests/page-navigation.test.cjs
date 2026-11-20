const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { createRoot } = require('react-dom/client');
const { JSDOM } = require('jsdom');
const { loader } = require('./helpers/detail-presentation-loader.cjs');

const sections = [
  { id: 'constituents', label: '구성 종목' },
  { id: 'dividends', label: '배당 비교' },
  { id: 'profile', label: '기업 개요' },
];

async function withOutline(url, verify) {
  const dom = new JSDOM(
    '<!doctype html><html style="scroll-padding-top:84px"><body>'
    + '<header data-site-header></header><div data-detail-header></div><div data-detail-inline-outline id="root"></div>'
    + sections.map(({ id }) => '<section id="' + id + '" style="scroll-margin-top:104px"></section>').join('')
    + '</body></html>',
    { url },
  );
  const win = dom.window;
  const doc = win.document;
  let scrollY = 0;
  const positions = new Map([['constituents', 220], ['dividends', 650], ['profile', 1050]]);
  for (const { id } of sections) {
    doc.getElementById(id).getBoundingClientRect = () => ({ top: positions.get(id) });
  }
  doc.querySelector('[data-site-header]').getBoundingClientRect = () => ({ height: 60 });
  doc.querySelector('[data-detail-header]').getBoundingClientRect = () => ({ height: 40 });
  doc.querySelector('[data-detail-inline-outline]').getBoundingClientRect = () => ({ height: 48 });
  Object.defineProperty(doc.documentElement, 'scrollHeight', { value: 1400 });
  Object.defineProperty(win, 'innerHeight', { value: 900 });
  Object.defineProperty(win, 'scrollY', { get: () => scrollY });
  let runFrame;
  const globals = {
    window: win, document: doc, IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: callback => { runFrame = callback; return 1; },
    cancelAnimationFrame: () => { runFrame = undefined; },
  };
  const prior = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const { PageNavigation } = loader()('components/page-navigation.tsx');
  const root = createRoot(doc.getElementById('root'));
  const render = () => React.act(async () => { root.render(React.createElement(PageNavigation, { sections })); });
  const move = ({ top, positions: next, event = 'scroll', hash }) => React.act(async () => {
    scrollY = top;
    for (const [id, value] of Object.entries(next)) positions.set(id, value);
    if (hash !== undefined) win.history.replaceState({}, '', url.split('#')[0] + hash);
    win.dispatchEvent(new win.Event(event));
    const nextFrame = runFrame;
    runFrame = undefined;
    nextFrame?.(0);
  });
  const active = () => [...doc.querySelectorAll('a[aria-current="location"]')].map(link => link.getAttribute('href'));
  try {
    await verify({ render, move, active });
  } finally {
    await React.act(async () => { root.unmount(); });
    for (const [key, descriptor] of prior) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    win.close();
  }
}

test('the outline follows the browser fragment offset and then follows manual scrolling', async () => {
  await withOutline('http://localhost/company/samsung/', async ({ render, move, active }) => {
    await render();
    assert.deepEqual(active(), ['#constituents']);
    await move({ top: 250, positions: { constituents: -110, dividends: 188, profile: 450 }, event: 'hashchange', hash: '#dividends' });
    assert.deepEqual(active(), ['#dividends']);
    await move({ top: 100, positions: { constituents: 120, dividends: 350, profile: 680 } });
    assert.deepEqual(active(), ['#constituents'], 'the previous hash does not replace the actual reading position');
  });
});

test('the outline recognizes a restored final fragment when the browser reaches its scroll limit', async () => {
  await withOutline('http://localhost/company/samsung/#profile', async ({ render, move, active }) => {
    await move({ top: 500, positions: { constituents: -190, dividends: 150, profile: 420 } });
    await render();
    assert.deepEqual(active(), ['#profile']);
    await move({ top: 260, positions: { constituents: -90, dividends: 188, profile: 640 }, event: 'popstate', hash: '#dividends' });
    assert.deepEqual(active(), ['#dividends']);
    await move({ top: 500, positions: { constituents: -390, dividends: 60, profile: 420 } });
    assert.deepEqual(active(), ['#profile'], 'scrolling to the end also reaches the final visible section');
  });
});
