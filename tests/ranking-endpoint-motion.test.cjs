const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { JSDOM } = require('jsdom');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');

function endpointComponent() {
  return createBusinessPageLoader().load('components/ranking-sparkline-endpoint.tsx').RankingSparklineEndpoint;
}

async function withEndpoints({ observerSupported = true } = {}, run) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost:3001/' });
  const observers = [], visibility = { state: 'visible', adds: 0, removes: 0 };
  let requests = 0, root;
  Object.defineProperty(dom.window.document, 'visibilityState', { get: () => visibility.state, configurable: true });
  const add = dom.window.document.addEventListener.bind(dom.window.document);
  const remove = dom.window.document.removeEventListener.bind(dom.window.document);
  dom.window.document.addEventListener = (type, listener, ...args) => {
    if (type === 'visibilitychange') visibility.adds++;
    return add(type, listener, ...args);
  };
  dom.window.document.removeEventListener = (type, listener, ...args) => {
    if (type === 'visibilitychange') visibility.removes++;
    return remove(type, listener, ...args);
  };
  class MockIntersectionObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; observers.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); this.disconnected = true; }
    emit(target, isIntersecting, intersectionRatio = isIntersecting ? 1 : 0) {
      this.callback([{ target, isIntersecting, intersectionRatio }]);
    }
  }
  const values = {
    window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement,
    IntersectionObserver: observerSupported ? MockIntersectionObserver : undefined,
    IS_REACT_ACT_ENVIRONMENT: true,
    fetch: async () => { requests++; throw new Error('Chart endpoint motion must not fetch'); },
  };
  dom.window.IntersectionObserver = values.IntersectionObserver;
  const previous = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  try {
    const Endpoint = endpointComponent();
    const { createRoot } = require('react-dom/client');
    root = createRoot(document.getElementById('root'));
    await run({
      Endpoint, observers, visibility, requests: () => requests,
      render: async children => React.act(async () => root.render(children)),
      unmount: async () => { await React.act(async () => root.unmount()); root = null; },
      setVisibility: state => { visibility.state = state; document.dispatchEvent(new dom.window.Event('visibilitychange')); },
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

test('server HTML includes a static positioned decorative endpoint before client effects run', () => {
  const Endpoint = endpointComponent();
  const html = renderToStaticMarkup(React.createElement(Endpoint, { left: 37.5, top: 62 }));
  const dom = new JSDOM(html);
  try {
    const marker = dom.window.document.querySelector('span.sparklineEndpoint');
    assert.ok(marker);
    assert.equal(marker.getAttribute('aria-hidden'), 'true');
    assert.equal(marker.style.left, '37.5%');
    assert.equal(marker.style.top, '62%');
    assert.notEqual(marker.dataset.animate, 'true', 'Static exports must not start animation before viewport observation');
  } finally { dom.window.close(); }
});

test('identity-based endpoint variation is stable across repeated static renders and coordinate changes', () => {
  const Endpoint = endpointComponent();
  const props = { identity: 'KOSPI.005930', left: 37.5, top: 62 };
  const html = renderToStaticMarkup(React.createElement(Endpoint, props));
  assert.equal(renderToStaticMarkup(React.createElement(Endpoint, props)), html);
  const dom = new JSDOM(html + renderToStaticMarkup(React.createElement(Endpoint, { ...props, left: 90, top: 25 })));
  try {
    const [desktop, mobile] = dom.window.document.querySelectorAll('.sparklineEndpoint');
    assert.match(desktop.style.animationDelay, /^-\d+ms$/);
    assert.match(desktop.style.getPropertyValue('--endpoint-angle'), /^\d+deg$/);
    assert.equal(mobile.style.animationDelay, desktop.style.animationDelay);
    assert.equal(mobile.style.getPropertyValue('--endpoint-angle'), desktop.style.getPropertyValue('--endpoint-angle'));
    assert.equal(desktop.style.left, '37.5%');
    assert.equal(desktop.style.top, '62%');
    assert.equal(mobile.style.left, '90%');
    assert.equal(mobile.style.top, '25%');
    assert.equal(desktop.hasAttribute('identity'), false);
  } finally { dom.window.close(); }
});

test('different ranking identities spread static animation phases and angles within their bounds', () => {
  const Endpoint = endpointComponent();
  const identities = ['KOSPI.005930', 'KOSPI.000660', 'KOSPI.402340', 'KOSPI.009150', 'KOSPI.373220'];
  const html = renderToStaticMarkup(React.createElement('div', null,
    ...identities.map(identity => React.createElement(Endpoint, { key: identity, identity, left: 75, top: 25 }))));
  const dom = new JSDOM(html);
  try {
    const markers = [...dom.window.document.querySelectorAll('.sparklineEndpoint')];
    const delays = markers.map(marker => parseInt(marker.style.animationDelay, 10));
    const angles = markers.map(marker => parseInt(marker.style.getPropertyValue('--endpoint-angle'), 10));
    assert.equal(delays.every(delay => Number.isInteger(delay) && delay <= 0 && delay > -1800), true);
    assert.equal(angles.every(angle => Number.isInteger(angle) && angle >= 0 && angle < 30), true);
    assert.ok(new Set(delays).size > 1, 'Ranking rows must not all pulse in phase');
    assert.ok(new Set(angles).size > 1, 'Dotted endpoint orientations must vary across rows');
    assert.equal(markers.every(marker => marker.style.left === '75%' && marker.style.top === '25%'), true);
  } finally { dom.window.close(); }
});

test('endpoints share one observer and pause offscreen or in a hidden document', async () => withEndpoints({}, async context => {
  const { Endpoint, observers, visibility, render, unmount, setVisibility } = context;
  const markers = count => React.createElement('div', null, ...Array.from({ length: count }, (_, index) =>
    React.createElement(Endpoint, { key: index, left: index * 20, top: 50 })));
  await render(markers(2));
  const [first, second] = document.querySelectorAll('.sparklineEndpoint');
  assert.equal(observers.length, 1);
  assert.equal(observers[0].targets.size, 2);
  assert.equal(visibility.adds, 1);
  assert.notEqual(first.dataset.animate, 'true');

  observers[0].emit(first, true);
  observers[0].emit(second, true, 0);
  assert.equal(first.dataset.animate, 'true');
  assert.equal(second.dataset.animate, 'false', 'Zero visible area cannot animate even when isIntersecting is true');
  setVisibility('hidden');
  assert.equal(first.dataset.animate, 'false');
  observers[0].emit(second, true);
  assert.equal(second.dataset.animate, 'false', 'An observer callback queued before hiding must not resume animation');
  setVisibility('visible');
  assert.equal(first.dataset.animate, 'true');
  assert.equal(second.dataset.animate, 'true');
  observers[0].emit(first, false);
  assert.equal(first.dataset.animate, 'false');
  setVisibility('prerender');
  assert.equal(second.dataset.animate, 'false');
  setVisibility('visible');
  assert.equal(first.dataset.animate, 'false', 'Returning to a visible document must keep offscreen endpoints paused');
  assert.equal(second.dataset.animate, 'true');

  await render(markers(1));
  assert.equal(observers[0].targets.size, 1);
  assert.equal(second.hasAttribute('data-animate'), false, 'Unmounted targets lose their animation attribute');
  observers[0].emit(second, true);
  assert.equal(second.hasAttribute('data-animate'), false, 'A queued callback cannot animate an unmounted target');
  assert.equal(observers[0].disconnected, false, 'Remaining rows keep the shared observer alive');
  await unmount();
  assert.equal(observers[0].disconnected, true);
  assert.equal(observers[0].targets.size, 0);
  assert.equal(visibility.removes, 1);
  assert.equal(first.hasAttribute('data-animate'), false);
  observers[0].emit(first, true);
  assert.equal(first.hasAttribute('data-animate'), false);
  assert.equal(context.requests(), 0);
}));

test('StrictMode remounts leave only one live observer and clean up every subscription', async () => withEndpoints({}, async context => {
  const { Endpoint, observers, visibility, render, unmount } = context;
  const markers = left => React.createElement(React.StrictMode, null,
    React.createElement(Endpoint, { identity: 'KOSPI.005930', left, top: 10 }),
    React.createElement(Endpoint, { identity: 'KOSPI.000660', left: 80, top: 20 }));
  await render(markers(90));
  const live = observers.filter(observer => !observer.disconnected);
  assert.equal(live.length, 1);
  assert.equal(live[0].targets.size, 2);
  assert.equal(visibility.adds - visibility.removes, 1);
  const first = document.querySelector('.sparklineEndpoint');
  const variation = [first.style.animationDelay, first.style.getPropertyValue('--endpoint-angle')];
  const observerCount = observers.length;
  await render(markers(70));
  assert.deepEqual([first.style.animationDelay, first.style.getPropertyValue('--endpoint-angle')], variation);
  assert.equal(first.style.left, '70%');
  assert.equal(observers.length, observerCount, 'Coordinate updates must not add observers or change animation variation');
  await unmount();
  assert.equal(observers.every(observer => observer.disconnected && observer.targets.size === 0), true);
  assert.equal(visibility.adds, visibility.removes);
  assert.equal(context.requests(), 0);
}));

test('browsers without IntersectionObserver retain the static endpoint without subscriptions or requests', async () => withEndpoints({ observerSupported: false }, async context => {
  await context.render(React.createElement(context.Endpoint, { left: 75, top: 25 }));
  const marker = document.querySelector('.sparklineEndpoint');
  assert.ok(marker);
  assert.equal(marker.style.left, '75%');
  assert.equal(marker.style.top, '25%');
  assert.notEqual(marker.dataset.animate, 'true');
  assert.equal(context.observers.length, 0);
  assert.equal(context.visibility.adds, 0);
  assert.equal(context.requests(), 0);
}));
