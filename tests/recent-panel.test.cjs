const assert = require('node:assert/strict');
const test = require('node:test');
const React = require('react');
const { JSDOM } = require('jsdom');
const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');

async function withRecentPanel(options, run) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost/' });
  const focusCalls = [], openListeners = new Set(), outsideListeners = new Set(), escapeListeners = new Set();
  const nativeFocus = dom.window.HTMLElement.prototype.focus;
  dom.window.HTMLElement.prototype.focus = function (settings) {
    focusCalls.push({ element: this, settings });
    return nativeFocus.call(this, settings);
  };
  for (const [target, type, listeners] of [
    [dom.window, 'app:open-recent', openListeners],
    [dom.window.document, 'click', outsideListeners],
    [dom.window.document, 'keydown', escapeListeners],
  ]) {
    const add = target.addEventListener.bind(target), remove = target.removeEventListener.bind(target);
    target.addEventListener = (event, callback, settings) => {
      if (event === type && (type !== 'click' || settings === true)) listeners.add(callback);
      return add(event, callback, settings);
    };
    target.removeEventListener = (event, callback, settings) => {
      if (event === type && (type !== 'click' || settings === true)) listeners.delete(callback);
      return remove(event, callback, settings);
    };
  }
  const globals = {
    window: dom.window, document: dom.window.document, Event: dom.window.Event,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  let root;
  try {
    const loader = createBusinessPageLoader({
      '@/components/recent-securities-sidebar': { RecentSecuritiesSidebar: function RecentSecuritiesSidebar() {
        const [empty, setEmpty] = React.useState(options.empty);
        return empty ? React.createElement('p', null, '종목을 둘러보면 이곳에 표시됩니다.')
          : React.createElement(React.Fragment, null,
            React.createElement('button', { type: 'button', onClick: () => setEmpty(true) }, '전체 삭제'),
            React.createElement('a', { href: '#company' }, '삼성전자'),
            React.createElement('a', { href: '#second' }, '현대차'));
      } },
    });
    const { RecentPanel } = loader.load('components/recent-panel.tsx');
    const { RecentPanelTrigger } = loader.load('components/recent-panel-trigger.tsx');
    root = require('react-dom/client').createRoot(document.getElementById('root'));
    const render = async ({ showTriggers = true } = {}) => {
      const contents = React.createElement(React.Fragment, null,
        React.createElement(RecentPanel),
        showTriggers && React.createElement(RecentPanelTrigger, { className: 'rail-trigger' }, '전체 기록 보기'),
        showTriggers && React.createElement(RecentPanelTrigger, { className: 'footer-trigger' }, '최근 본 종목'),
        React.createElement('button', { type: 'button', className: 'outside' }, '다른 작업'));
      await React.act(async () => root.render(options.strict ? React.createElement(React.StrictMode, null, contents) : contents));
    };
    await render();
    await run({
      document, focusCalls, openListeners, outsideListeners, escapeListeners, render,
      panel: () => document.querySelector('details'),
      summary: () => document.querySelector('summary'),
      content: () => document.querySelector('.recent-panel-content'),
      rail: () => document.querySelector('.rail-trigger'),
      footer: () => document.querySelector('.footer-trigger'),
      outside: () => document.querySelector('.outside'),
      click: element => React.act(async () => element.click()),
      escape: element => React.act(async () => element.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))),
      dispatchOpen: () => window.dispatchEvent(new Event('app:open-recent')),
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

test('external recent triggers remain open after the same click and focus the first history link without scrolling', async () => withRecentPanel({}, async context => {
  assert.equal(context.panel().open, false);
  await context.click(context.rail());
  assert.equal(context.panel().open, true);
  assert.equal(document.activeElement, context.content().querySelector('a'));
  assert.deepEqual(context.focusCalls.map(({ settings }) => settings), [{ preventScroll: true }, { preventScroll: true }]);
  await context.escape(document.activeElement);
  assert.equal(context.panel().open, false);
  assert.equal(document.activeElement, context.rail());

  await context.click(context.footer());
  assert.equal(context.panel().open, true);
  await context.click(context.rail());
  assert.equal(context.panel().open, true, 'A second external trigger reopens after capture-phase dismissal');
  await context.escape(document.activeElement);
  assert.equal(document.activeElement, context.rail());
}));

test('the header summary keeps native toggling and Escape returns to that summary', async () => withRecentPanel({}, async context => {
  await context.click(context.summary());
  assert.equal(context.panel().open, true);
  await context.escape(context.summary());
  assert.equal(context.panel().open, false);
  assert.equal(document.activeElement, context.summary());
  await context.click(context.summary());
  await context.click(context.summary());
  assert.equal(context.panel().open, false);
}));

test('empty history has a focusable fallback and Escape returns to its external opener', async () => withRecentPanel({ empty: true }, async context => {
  await context.click(context.footer());
  assert.equal(context.panel().open, true);
  assert.equal(document.activeElement, context.content());
  await context.escape(document.activeElement);
  assert.equal(document.activeElement, context.footer());
  assert.equal(context.panel().open, false);
}));

test('outside clicks and history navigation close without stealing the destination focus or preventing links', async () => withRecentPanel({}, async context => {
  await context.click(context.rail());
  context.outside().focus();
  await context.click(context.outside());
  assert.equal(context.panel().open, false);
  assert.equal(document.activeElement, context.outside());

  await context.click(context.rail());
  const link = context.content().querySelector('a');
  let prevented;
  document.addEventListener('click', event => { prevented = event.defaultPrevented; }, { once: true });
  await context.click(link);
  assert.equal(context.panel().open, false);
  assert.equal(prevented, false);
  assert.equal(document.activeElement, link, 'Closing for navigation does not force focus back to the opener');
}));

test('Escape falls back to the header when its external opener was removed', async () => withRecentPanel({}, async context => {
  await context.click(context.rail());
  await context.render({ showTriggers: false });
  await context.escape(document.activeElement);
  assert.equal(context.panel().open, false);
  assert.equal(document.activeElement, context.summary());
}));

test('a nonfocusable outside click restores focus only when it would otherwise remain hidden in the closed panel', async () => withRecentPanel({}, async context => {
  await context.click(context.rail());
  assert.equal(document.activeElement, context.content().querySelector('a'));
  await context.click(document.body);
  assert.equal(context.panel().open, false);
  assert.equal(document.activeElement === context.rail(), true);
  assert.deepEqual(context.focusCalls.at(-1).settings, { preventScroll: true });
}));

test('Escape still closes after clearing history removes the focused control', async () => withRecentPanel({}, async context => {
  await context.click(context.footer());
  const clear = context.content().querySelector('button');
  clear.focus();
  await context.click(clear);
  assert.equal(clear.isConnected, false);
  assert.equal(document.activeElement, document.body, 'Removing the focused control loses focus outside the details element');
  assert.equal(context.panel().open, true);
  await context.escape(document.activeElement);
  assert.equal(context.panel().open, false);
  assert.equal(document.activeElement, context.footer());
}));

test('StrictMode and unmount leave no duplicate external-open or outside-click listeners', async () => withRecentPanel({ strict: true }, async context => {
  assert.equal(context.openListeners.size, 1);
  assert.equal(context.outsideListeners.size, 1);
  assert.equal(context.escapeListeners.size, 1);
  const panel = context.panel();
  await context.unmount();
  assert.equal(context.openListeners.size, 0);
  assert.equal(context.outsideListeners.size, 0);
  assert.equal(context.escapeListeners.size, 0);
  context.dispatchOpen();
  assert.equal(panel.open, false);
}));
