const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync, existsSync } = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { JSDOM } = require('jsdom');
const project = path.resolve(__dirname, '..');

test('the real toast renderer exposes copy/share failures and pinning keeps a single control group', async (t) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/detail/' });
  const saved = new Map();
  const modules = new Map(Object.entries(require.cache));
  const pending = new Map();
  let timer = 0;
  let mounted;
  let rejectCopy = true;
  const copied = [];
  Object.defineProperties(dom.window.navigator, {
    clipboard: { configurable: true, value: { writeText: async value => {
      if (rejectCopy) throw new Error('fixture-copy-denied');
      copied.push(value);
    } } },
    share: { configurable: true, value: async () => { throw new Error('fixture-share-failed'); } },
  });
  const globals = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement,
    DocumentFragment: dom.window.DocumentFragment, CustomEvent: dom.window.CustomEvent,
    DOMException: dom.window.DOMException, MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle, IS_REACT_ACT_ENVIRONMENT: true,
    requestAnimationFrame: callback => { pending.set(++timer, () => callback(0)); return timer; },
    cancelAnimationFrame: id => pending.delete(id),
    setTimeout: callback => { pending.set(++timer, callback); return timer; },
    clearTimeout: id => pending.delete(id),
  };
  for (const [key, value] of Object.entries(globals)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  dom.window.requestAnimationFrame = globals.requestAnimationFrame;
  dom.window.cancelAnimationFrame = globals.cancelAnimationFrame;
  dom.window.setTimeout = globals.setTimeout;
  dom.window.clearTimeout = globals.clearTimeout;
  t.mock.method(console, 'error', () => {});
  const loaded = new Map();
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => {
      // Animation is outside this behavioral test. Keep ShareButton, Toast,
      // useToast, Radix, and the actual copy/share event handlers real.
      if (name.includes('/animate-ui/icons/')) return new Proxy({}, { get: (_, key) =>
        key === 'AnimateIcon' ? ({ children }) => React.createElement('span', null, children) : () => React.createElement('svg') });
      const local = name.startsWith('@/') ? path.join(project, name.slice(2))
        : name.startsWith('.') ? path.resolve(path.dirname(filename), name) : null;
      if (!local) return require(name);
      const resolved = [local, `${local}.ts`, `${local}.tsx`].find(existsSync);
      assert.ok(resolved, `Missing ${name}`);
      return load(resolved);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
      fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  try {
    const { createRoot } = require('react-dom/client');
    const { ShareButton } = load(path.join(project, 'components/share-button.tsx'));
    const { Toaster } = load(path.join(project, 'components/ui/toaster.tsx'));
    mounted = createRoot(document.getElementById('root'));
    await React.act(async () => mounted.render(React.createElement(React.Fragment, null,
      React.createElement(ShareButton, { url: 'http://localhost/detail/' }), React.createElement(Toaster))));
    const click = async label => React.act(async () => document.querySelector(`button[aria-label="${label}"]`).click());
    await click('링크 복사');
    assert.match(document.body.textContent, /링크를 복사하지 못했습니다/);
    await click('공유하기');
    assert.match(document.body.textContent, /공유에 실패했습니다/);
    await React.act(async () => window.dispatchEvent(new window.CustomEvent('company-header-pin-change', { detail: { pinned: true } })));
    assert.equal(document.querySelectorAll('[data-share-actions]').length, 1);
    assert.equal(document.querySelector('[data-share-actions]').dataset.pinned, 'true');
    assert.equal(document.querySelectorAll('button[aria-label="링크 복사"]').length, 1);
    rejectCopy = false;
    await click('링크 복사');
    assert.deepEqual(copied, ['http://localhost/detail/']);
    assert.match(document.body.textContent, /페이지 링크가 복사되었습니다/);
    assert.ok(document.querySelector('button[aria-label="복사 완료"]'));
  } finally {
    if (mounted) await React.act(async () => mounted.unmount());
    pending.clear();
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    for (const key of Object.keys(require.cache)) if (!modules.has(key)) delete require.cache[key];
    for (const [key, value] of modules) require.cache[key] = value;
  }
});
