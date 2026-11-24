const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { renderToString } = require('react-dom/server');
const { JSDOM } = require('jsdom');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');

async function withQuote(options, run) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3001/' });
  const dimensions = { width: 280, height: 44 };
  const observers = [], frames = new Map(), cancelled = [], resizeListeners = new Set(), hydrationErrors = [];
  let frameId = 0, root, requests = 0;
  const nativeAdd = dom.window.addEventListener.bind(dom.window), nativeRemove = dom.window.removeEventListener.bind(dom.window);
  dom.window.addEventListener = (type, listener, ...args) => {
    if (type === 'resize') resizeListeners.add(listener);
    return nativeAdd(type, listener, ...args);
  };
  dom.window.removeEventListener = (type, listener, ...args) => {
    if (type === 'resize') resizeListeners.delete(listener);
    return nativeRemove(type, listener, ...args);
  };
  class MockResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; observers.push(this); }
    observe(target) { this.targets.add(target); }
    disconnect() { this.targets.clear(); this.disconnected = true; }
    emit() { this.callback([...this.targets].map(target => ({ target }))); }
  }
  const requestFrame = callback => { frames.set(++frameId, callback); return frameId; };
  const cancelFrame = id => { cancelled.push(id); frames.delete(id); };
  const values = {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    ResizeObserver: options.observerSupported === false ? undefined : MockResizeObserver,
    IntersectionObserver: undefined, requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame,
    getComputedStyle: element => {
      assert.ok(element.classList.contains('quotePlot'));
      return { width: `${dimensions.width}px`, height: `${dimensions.height}px` };
    },
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => { requests++; throw new Error('Quote layout must not fetch'); },
  };
  Object.assign(dom.window, { ResizeObserver: values.ResizeObserver, requestAnimationFrame: requestFrame, cancelAnimationFrame: cancelFrame });
  const previous = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  try {
    const loader = createBusinessPageLoader();
    const { RankingQuote } = loader.load('components/ranking-quote.tsx');
    const { createRankingRows } = loader.load('lib/ranking-view.ts');
    const { createRoot, hydrateRoot } = require('react-dom/client');
    const element = row => {
      const quote = React.createElement(RankingQuote, { row });
      return options.strict ? React.createElement(React.StrictMode, null, quote) : quote;
    };
    const container = document.getElementById('root');
    await run({
      dimensions, observers, frames, cancelled, resizeListeners, hydrationErrors,
      row: (prices = ['100', '200']) => createRankingRows([{ securityId: 'security-1', korName: '예시종목', ticker: '005930', exchange: 'KOSPI',
        currentRank: 1, value: '1000', prices: prices.map((close, index) => ({ date: `2026-10-0${index + 1}`, close, rate: '2' })) }], 'marketcap', 'security')[0],
      render: async row => { if (!root) root = createRoot(container); await React.act(async () => root.render(element(row))); },
      hydrate: async row => {
        container.innerHTML = renderToString(element(row));
        const html = container.innerHTML;
        await React.act(async () => { root = hydrateRoot(container, element(row), { onRecoverableError: error => hydrationErrors.push(error) }); });
        return html;
      },
      quote: () => container.querySelector('.responsiveQuote'),
      flush: async () => React.act(async () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0)); }),
      resize: () => dom.window.dispatchEvent(new dom.window.Event('resize')),
      unmount: async () => { await React.act(async () => root.unmount()); root = null; },
      requests: () => requests,
    });
  } finally {
    if (root) await React.act(async () => root.unmount());
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    dom.window.close();
  }
}

test('SSR quote content hydrates unchanged and measurements wait for a scheduled frame', async () => withQuote({}, async context => {
  const html = await context.hydrate(context.row());
  assert.match(html, /200원/);
  assert.match(html, /\+2\.00%/);
  assert.match(html, /polyline/);
  assert.equal(context.quote().outerHTML, html);
  assert.equal(context.quote().querySelector('svg').getAttribute('viewBox'), '0 0 108 44');
  assert.equal(context.frames.size, 1);
  assert.deepEqual([...context.observers[0].targets], [context.quote().querySelector('.quotePlot')]);
  await context.flush();
  assert.equal(context.quote().querySelector('svg').getAttribute('viewBox'), '0 0 280 44');
  assert.deepEqual(context.hydrationErrors, []);
  assert.equal(context.requests(), 0);
}));

test('coalesced measurements resize only the plot while quote labels stay in flow', async () => withQuote({}, async context => {
  await context.render(context.row());
  await context.flush();
  Object.assign(context.dimensions, { width: 110, height: 30 });
  context.observers[0].emit(); context.observers[0].emit(); context.resize();
  assert.equal(context.frames.size, 1);
  await context.flush();
  assert.equal(context.quote().querySelector('svg').getAttribute('viewBox'), '0 0 110 30');
  assert.equal(context.quote().getAttribute('style'), null);

  Object.assign(context.dimensions, { width: 322, height: 46 });
  context.observers[0].emit();
  await context.flush();
  assert.equal(context.quote().querySelector('svg').getAttribute('viewBox'), '0 0 322 46');
  assert.equal(context.observers.length, 1);
}));

test('new row observations replace the series immediately and reuse the plot observer', async () => withQuote({}, async context => {
  await context.render(context.row());
  await context.flush();
  const observer = context.observers[0];
  observer.emit();
  await context.render(context.row(['100', null]));
  assert.equal(observer.disconnected, false);
  assert.equal(context.observers.length, 1);
  assert.match(context.quote().textContent, /가격 정보 없음/);
  assert.equal(context.quote().querySelector('.sparklineEndpoint'), null);
  assert.equal(context.quote().querySelectorAll('polyline').length, 1);
  await context.flush();
  assert.equal(context.quote().querySelector('.sparklineEndpoint'), null);
  assert.equal(context.quote().querySelector('svg').getAttribute('viewBox'), '0 0 280 44');
}));

test('StrictMode unmount cancels frames, disconnects observers and ignores late callbacks', async () => withQuote({ strict: true }, async context => {
  await context.render(context.row());
  const live = context.observers.filter(observer => !observer.disconnected);
  assert.equal(live.length, 1);
  assert.equal(context.resizeListeners.size, 0);
  assert.equal(context.frames.size, 1);
  const frame = [...context.frames.values()][0];
  await context.unmount();
  assert.equal(context.observers.every(observer => observer.disconnected && observer.targets.size === 0), true);
  assert.equal(context.frames.size, 0);
  assert.equal(context.resizeListeners.size, 0);
  assert.ok(context.cancelled.length >= 2, 'StrictMode replay and final cleanup each cancel their pending measurement');
  frame(0); live[0].emit(); context.resize();
  assert.equal(context.frames.size, 0);
  assert.equal(context.requests(), 0);
}));

test('window resize still updates the quote when ResizeObserver is unavailable', async () => withQuote({ observerSupported: false }, async context => {
  await context.render(context.row());
  await context.flush();
  assert.equal(context.observers.length, 0);
  context.dimensions.width = 180;
  context.resize();
  await context.flush();
  assert.equal(context.quote().querySelector('svg').getAttribute('viewBox'), '0 0 180 44');
}));
