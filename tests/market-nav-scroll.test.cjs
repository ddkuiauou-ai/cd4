const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');

async function withMarketNav(options, run) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3001/' });
  const layout = { width: 240, scrollWidth: 650, initialScroll: 0, pathname: '/dps', ...options };
  const observers = [], writes = [], scrollValues = new WeakMap();
  let verticalScrolls = 0, root;
  const isNav = element => element.getAttribute('aria-label') === '전체 순위 지표';
  const rect = (left, width) => ({ left, right: left + width, top: 200, bottom: 244, width, height: 44, x: left, y: 200, toJSON() {} });
  Object.defineProperties(dom.window.HTMLElement.prototype, {
    clientWidth: { configurable: true, get() { return isNav(this) ? layout.width : 0; } },
    scrollWidth: { configurable: true, get() { return isNav(this) ? layout.scrollWidth : 0; } },
    scrollLeft: {
      configurable: true,
      get() { return scrollValues.get(this) ?? (isNav(this) ? layout.initialScroll : 0); },
      set(value) {
        const clamped = Math.max(0, Math.min(value, layout.scrollWidth - layout.width));
        scrollValues.set(this, clamped);
        if (isNav(this)) writes.push(clamped);
      },
    },
  });
  dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
    if (isNav(this)) return rect(100, layout.width);
    const nav = this.closest('nav[aria-label="전체 순위 지표"]');
    if (nav && this.tagName === 'A') {
      const index = [...nav.querySelectorAll('a')].indexOf(this);
      return rect(106 + index * 90 - nav.scrollLeft, 80);
    }
    return rect(0, 0);
  };
  const recordVerticalScroll = () => { verticalScrolls++; };
  dom.window.scrollTo = recordVerticalScroll;
  dom.window.scrollBy = recordVerticalScroll;
  dom.window.HTMLElement.prototype.scrollIntoView = recordVerticalScroll;
  class MockResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; observers.push(this); }
    observe(target) { this.targets.add(target); }
    disconnect() { this.targets.clear(); this.disconnected = true; }
    emit() { this.callback([...this.targets].map(target => ({ target }))); }
  }
  const values = {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    ResizeObserver: options?.observerSupported === false ? undefined : MockResizeObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  dom.window.ResizeObserver = values.ResizeObserver;
  const previous = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  try {
    const { MarketNav } = createBusinessPageLoader({
      'next/navigation': { usePathname: () => layout.pathname },
    }).load('components/market-nav.tsx');
    const { createRoot } = require('react-dom/client');
    root = createRoot(document.getElementById('root'));
    await run({
      layout, observers, writes,
      render: props => React.act(async () => root.render(React.createElement(MarketNav, props))),
      nav: () => document.querySelector('nav[aria-label="전체 순위 지표"]'),
      verticalScrolls: () => verticalScrolls,
      unmount: async () => { await React.act(async () => root.unmount()); root = null; },
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

test('the active rightmost metric is revealed horizontally without moving the page', async () => withMarketNav({}, async context => {
  await context.render({ metric: 'dps', scope: 'security' });
  const nav = context.nav();
  const active = nav.querySelector('a[aria-current="page"]');
  assert.equal(nav.querySelectorAll('a').length, 7);
  assert.equal(active.textContent, '주당배당금');
  assert.equal(nav.scrollLeft, 392);
  assert.ok(active.getBoundingClientRect().right <= nav.getBoundingClientRect().right - 6);
  assert.equal(context.verticalScrolls(), 0);
}));

test('left-hidden selection is revealed while visible metrics and manual scrolling are left alone', async () => withMarketNav({ initialScroll: 100, pathname: '/marketcaps' }, async context => {
  await context.render({});
  const nav = context.nav();
  assert.equal(nav.scrollLeft, 0);
  context.layout.pathname = '/per';
  const beforeVisibleSelection = context.writes.length;
  await context.render({});
  assert.equal(nav.scrollLeft, 0);
  assert.equal(context.writes.length, beforeVisibleSelection, 'An already visible selection must not scroll');
  nav.scrollLeft = 120;
  const beforeUnrelatedRender = context.writes.length;
  await context.render({ className: 'updated-presentation' });
  assert.equal(nav.scrollLeft, 120, 'Unrelated rerenders must preserve the user scroll position');
  assert.equal(context.writes.length, beforeUnrelatedRender);
  assert.equal(context.verticalScrolls(), 0);
}));

test('overflow after resize reveals the selection and disconnects its observer on unmount', async () => withMarketNav({ width: 700 }, async context => {
  await context.render({ metric: 'dps', scope: 'security' });
  assert.equal(context.writes.length, 0, 'A navigation bar without overflow needs no scrolling');
  assert.equal(context.observers.length, 1);
  assert.equal(context.observers[0].targets.has(context.nav()), true);
  context.layout.width = 0;
  context.observers[0].emit();
  assert.equal(context.writes.length, 0, 'A hidden navigation bar with no measured width must not scroll');
  context.layout.width = 240;
  context.observers[0].emit();
  assert.equal(context.nav().scrollLeft, 392);
  assert.equal(context.verticalScrolls(), 0);
  await context.unmount();
  assert.equal(context.observers[0].disconnected, true);
}));

test('initial selection reveal also works when ResizeObserver is unavailable', async () => withMarketNav({ observerSupported: false }, async context => {
  await context.render({ metric: 'dps', scope: 'security' });
  assert.equal(context.nav().scrollLeft, 392);
  assert.equal(context.observers.length, 0);
  assert.equal(context.verticalScrolls(), 0);
}));
