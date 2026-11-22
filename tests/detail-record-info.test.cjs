const test = require('node:test');
const assert = require('node:assert/strict');
const { act, createElement: h } = require('react');
const { hydrateRoot } = require('react-dom/client');
const { renderToString } = require('react-dom/server');
const { JSDOM } = require('jsdom');
const { loader } = require('./helpers/detail-presentation-loader.cjs');

const { DetailRecordInfo } = loader()('components/detail-record-info.tsx');

test('record and unavailable metric help hydrate and dismiss for the intended interaction', async () => {
  const content = h('div', { style: { overflow: 'hidden' } },
    h(DetailRecordInfo, { label: '관측 기준', text: '그해의 마지막 관측' }),
    h(DetailRecordInfo, { label: '2026년 전년 대비 0.00% 설명', text: '두 값이 모두 0원입니다.' }, '0.00%'),
    h('div', { role: 'dialog' },
      h(DetailRecordInfo, { asChild: true, dismissOnDialogTap: true, label: 'PER', text: '이 종목은 해당 지표를 제공하지 않아요' },
        h('span', { role: 'link', 'aria-disabled': 'true' }, 'PER')),
      h('a', { href: '#price', id: 'nearby' }, '주가·거래'),
      h('div', { id: 'menu-blank' }),
    ),
  );
  const dom = new JSDOM(`<!doctype html><main>${renderToString(content)}</main><button id="outside">밖</button>`);
  const { window } = dom;
  const { document } = window;
  const globals = { window, document, Node: window.Node, IS_REACT_ACT_ENVIRONMENT: true };
  const previousGlobals = Object.fromEntries(Object.keys(globals).map(key => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  const rootNode = document.querySelector('main');
  const [header, value] = rootNode.querySelectorAll('button');
  const unavailable = rootNode.querySelector('[aria-disabled="true"]');
  const note = () => document.body.querySelector('.note');
  const matches = window.Element.prototype.matches;
  window.Element.prototype.matches = function (selector) {
    // jsdom cannot reproduce the browser's keyboard modality heuristics.
    return selector === ':focus-visible' ? document.activeElement === this : matches.call(this, selector);
  };
  let root;
  let documentListeners = 0;
  const addEventListener = document.addEventListener.bind(document);
  const removeEventListener = document.removeEventListener.bind(document);
  document.addEventListener = (type, ...args) => {
    if (type === 'pointerdown' || type === 'keydown') documentListeners++;
    addEventListener(type, ...args);
  };
  document.removeEventListener = (type, ...args) => {
    if (type === 'pointerdown' || type === 'keydown') documentListeners--;
    removeEventListener(type, ...args);
  };

  const pointer = (element, type, pointerType = 'mouse', relatedTarget = null) => {
    element.dispatchEvent(new window.PointerEvent(type, { bubbles: true, pointerType, relatedTarget }));
  };

  try {
    assert.equal(value.textContent, '0.00%');
    assert.equal(document.getElementById(value.getAttribute('aria-describedby')).textContent, '두 값이 모두 0원입니다.');
    assert.notEqual(value.getAttribute('aria-describedby'), header.getAttribute('aria-describedby'));
    assert.equal(note(), null);

    const hydrationErrors = [];
    await act(() => { root = hydrateRoot(rootNode, content, { onRecoverableError: error => hydrationErrors.push(error) }); });
    assert.deepEqual(hydrationErrors, []);
    assert.equal(documentListeners, 0);

    Object.defineProperties(document.documentElement, {
      clientWidth: { value: 320 },
      clientHeight: { value: 480 },
    });
    header.getBoundingClientRect = () => ({ top: 430, bottom: 470, left: 270, right: 310 });
    const getBoundingClientRect = window.HTMLElement.prototype.getBoundingClientRect;
    window.HTMLElement.prototype.getBoundingClientRect = function () {
      return this.classList.contains('note') ? { width: 170, height: 44 } : getBoundingClientRect.call(this);
    };

    await act(() => pointer(header, 'pointerover'));
    assert.equal(note().parentElement, document.body);
    assert.equal(note().style.left, '138px');
    assert.equal(note().style.top, '380px');

    await act(() => pointer(header, 'pointerout', 'mouse', note()));
    await act(() => pointer(note(), 'pointerover', 'mouse', header));
    await act(() => new Promise(resolve => setTimeout(resolve, 170)));
    assert.equal(header.getAttribute('aria-expanded'), 'true');
    await act(() => pointer(note(), 'pointerout'));
    await act(() => new Promise(resolve => setTimeout(resolve, 170)));
    assert.equal(note(), null);

    await act(() => header.focus());
    assert.equal(header.getAttribute('aria-expanded'), 'true');
    await act(() => header.click());
    await act(() => pointer(header, 'pointerout'));
    assert.equal(header.getAttribute('aria-expanded'), 'true');
    await act(() => header.click());
    assert.equal(note(), null);

    await act(() => header.blur());
    await act(() => header.focus());
    await act(() => document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(note(), null);
    assert.equal(document.activeElement, header);
    await act(() => header.blur());

    await act(() => header.focus());
    assert.equal(header.getAttribute('aria-expanded'), 'true');
    await act(() => header.blur());
    assert.equal(note(), null);

    await act(() => pointer(value, 'pointerover', 'touch'));
    assert.equal(note(), null);
    await act(() => value.click());
    assert.equal(note().textContent, '두 값이 모두 0원입니다.');
    await act(() => pointer(document.querySelector('#outside'), 'pointerdown', 'touch'));
    assert.equal(note(), null);

    await act(() => pointer(unavailable, 'pointerover'));
    assert.equal(note().textContent, '이 종목은 해당 지표를 제공하지 않아요');
    await act(() => pointer(unavailable, 'pointerout'));
    await act(() => new Promise(resolve => setTimeout(resolve, 170)));
    assert.equal(note(), null);
    await act(() => pointer(unavailable, 'pointerover', 'touch'));
    assert.equal(note(), null);
    await act(() => unavailable.click());
    assert.equal(note().textContent, '이 종목은 해당 지표를 제공하지 않아요');
    assert.equal(unavailable.hasAttribute('href'), false);
    assert.equal(unavailable.tabIndex, -1);
    await act(() => unavailable.click());
    assert.equal(note(), null);

    const blank = rootNode.querySelector('#menu-blank');
    const nearby = rootNode.querySelector('#nearby');
    document.elementFromPoint = () => blank;
    await act(() => unavailable.click());
    await act(() => document.querySelector('#outside').click());
    assert.equal(unavailable.getAttribute('aria-expanded'), 'true');
    await act(() => pointer(blank, 'pointerdown', 'touch'));
    assert.equal(unavailable.getAttribute('aria-expanded'), 'true');
    await act(() => pointer(blank, 'pointercancel', 'touch'));
    assert.equal(unavailable.getAttribute('aria-expanded'), 'true');
    await act(() => blank.click());
    assert.equal(unavailable.getAttribute('aria-expanded'), 'false');
    assert.equal(note(), null);

    await act(() => unavailable.click());
    await act(() => pointer(nearby, 'pointerdown', 'touch'));
    const click = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    await act(() => nearby.dispatchEvent(click));
    assert.equal(click.defaultPrevented, true);
    assert.equal(note(), null);

    document.elementFromPoint = () => nearby;
    await act(() => unavailable.click());
    await act(() => pointer(nearby, 'pointerdown', 'touch'));
    const linkClick = new window.MouseEvent('click', { bubbles: true, cancelable: true });
    await act(() => nearby.dispatchEvent(linkClick));
    assert.equal(linkClick.defaultPrevented, false);
    assert.equal(note(), null);
    assert.equal(documentListeners, 0);
  } finally {
    if (root) await act(() => root.unmount());
    dom.window.close();
    Object.assign(globalThis, previousGlobals);
  }
});
