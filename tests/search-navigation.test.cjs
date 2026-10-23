const assert = require("node:assert/strict");
const test = require("node:test");
const React = require("react");
const { JSDOM } = require("jsdom");
const { createBusinessPageLoader } = require("./helpers/business-page-loader.cjs");

function securityFixture(type = "보통주", overrides = {}) {
  return {
    securityId: "security-uuid", companyId: "company-uuid",
    korName: "삼성전자", type, exchange: "KOSPI", ticker: "005930",
    ...overrides,
  };
}

// Mount the real dialog, input, result rows, keyboard handlers, and route builders.
// Only the router, theme provider, search data I/O, and geometry are substituted.
async function withMenu(data, run, { status = "success" } = {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: "http://localhost/", pretendToBeVisual: true,
  });
  const saved = new Map();
  const globals = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, HTMLInputElement: dom.window.HTMLInputElement,
    HTMLTextAreaElement: dom.window.HTMLTextAreaElement, HTMLSelectElement: dom.window.HTMLSelectElement,
    Element: dom.window.Element, Node: dom.window.Node, NodeFilter: dom.window.NodeFilter,
    DocumentFragment: dom.window.DocumentFragment, MutationObserver: dom.window.MutationObserver,
    CustomEvent: dom.window.CustomEvent, Event: dom.window.Event, KeyboardEvent: dom.window.KeyboardEvent,
    MouseEvent: dom.window.MouseEvent, FocusEvent: dom.window.FocusEvent,
    getComputedStyle: dom.window.getComputedStyle,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [key, value] of Object.entries(globals)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const navigations = [];
  const themes = [];
  let retries = 0;
  const loader = createBusinessPageLoader({
    "next/link": { default: ({ href, children, prefetch, onClick, ...props }) => {
      void prefetch;
      return React.createElement("a", { href, ...props, onClick: event => {
        onClick?.(event);
        if (!event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault();
          navigations.push(href);
        }
      } }, children);
    } },
    "next/navigation": { useRouter: () => ({ push: url => navigations.push(url) }) },
    "next-themes": { useTheme: () => ({ setTheme: theme => themes.push(theme) }) },
    "@/components/search-data": { useSearchData: () => ({ data, status, retry: () => retries++ }) },
  });
  let mounted;
  try {
    const { createRoot } = require("react-dom/client");
    const { CommandMenu } = loader.load("components/command-menu.tsx");
    mounted = createRoot(document.getElementById("root"));
    await React.act(async () => mounted.render(React.createElement(CommandMenu)));
    const input = () => document.querySelector('input[role="combobox"]');
    const trigger = () => document.querySelector("#root button");
    const open = async () => React.act(async () => trigger().click());
    const rows = () => [...document.querySelectorAll("[data-security-id]")];
    const row = id => rows().find(item => item.dataset.securityId === id);
    const click = async element => React.act(async () => {
      element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    // Synchronous act is intentional: debounce timers must not be needed to make
    // the next query's results visible before the following assertion.
    const search = value => React.act(() => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input(), value);
      input().dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    const key = (value, options = {}) => {
      const event = new dom.window.KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
      React.act(() => { input().dispatchEvent(event); });
      return event;
    };
    await open();
    await run({ dom, input, trigger, open, rows, row, search, key, click, navigations, themes, retries: () => retries });
  } finally {
    if (mounted) await React.act(async () => mounted.unmount());
    // Radix restores focus in an unmount timeout. Drain it before swapping the
    // document globals so its Event comes from the same JSDOM window.
    await React.act(async () => new Promise(resolve => dom.window.setTimeout(resolve, 0)));
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

function securityLink(row) {
  return row.querySelector('a[href^="/security/"]');
}
function companyLink(row) {
  return row.querySelector('a[href^="/company/"]');
}

// A company is an action on a security result, so two destinations must not
// duplicate the stock row or become interactive controls inside an option.
test("one security row exposes its name, code, market and type with separate stock and company links", async () => {
  await withMenu([securityFixture()], async menu => {
    assert.equal(menu.rows().length, 1);
    const row = menu.rows()[0];
    for (const term of ["삼성전자", "005930", "KOSPI", "보통주"]) assert.ok(row.textContent.includes(term), term);
    assert.equal(row.getAttribute("role"), "row");
    assert.equal(row.querySelectorAll('[role="gridcell"]').length, 2);
    assert.equal(securityLink(row).getAttribute("href"), "/security/KOSPI.005930/marketcap");
    assert.equal(companyLink(row).getAttribute("href"), "/company/KOSPI.005930");
    assert.equal(securityLink(row).getAttribute("aria-label"), "삼성전자 005930 KOSPI 보통주 종목 상세");
    assert.equal(companyLink(row).getAttribute("aria-label"), "삼성전자 기업 정보");
    assert.equal(securityLink(row).tabIndex, -1);
    assert.equal(companyLink(row).tabIndex, -1);
    assert.equal(menu.input().getAttribute("aria-haspopup"), "grid");
    const grid = document.getElementById(menu.input().getAttribute("aria-controls"));
    assert.equal(grid.getAttribute("role"), "grid");
    assert.equal(document.querySelector('[role="option"] a, [role="option"] button'), null);
    await menu.click(companyLink(row));
    assert.deepEqual(menu.navigations, ["/company/KOSPI.005930"]);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    await menu.open();
    await menu.click(securityLink(menu.rows()[0]));
    assert.deepEqual(menu.navigations, ["/company/KOSPI.005930", "/security/KOSPI.005930/marketcap"]);
    assert.equal(document.querySelector('[role="dialog"]'), null);
  });
});

test("all security types retain their routes and securities without companies have no company action", async () => {
  const types = ["보통주", "우선주", "전환우선주", "리츠", "펀드", "스팩", null, "원천 기타 유형"];
  const data = types.map((type, i) => securityFixture(type, {
    securityId: `type-${i}`, companyId: null, korName: `유형검증${i}`,
    exchange: "KOSDAQ", ticker: String(i + 1).padStart(6, "0"),
  }));
  await withMenu(data, async menu => {
    for (let i = 0; i < data.length; i++) {
      if (i) await menu.open();
      const row = menu.row(`type-${i}`);
      assert.ok(row, String(types[i]));
      assert.equal(companyLink(row), null);
      await menu.click(securityLink(row));
      assert.equal(menu.navigations.at(-1), `/security/KOSDAQ.${String(i + 1).padStart(6, "0")}/marketcap`);
    }
  });
});

test("name, initials and exact-code queries update immediately and hidden UUIDs do not become matches", async () => {
  const data = [
    securityFixture("보통주", { securityId: "other-005930", companyId: "company-005930", korName: "무관한기업", ticker: "000006" }),
    securityFixture("우선주", { securityId: "preferred", korName: "삼성전자우", ticker: "005935" }),
    securityFixture("보통주", { securityId: "samsung" }),
  ];
  await withMenu(data, async menu => {
    menu.search("삼");
    assert.equal(menu.rows().length, 2);
    menu.search("ㅅㅅㅈㅈ");
    assert.equal(menu.rows().length, 2);
    assert.equal(menu.rows()[0].dataset.securityId, "samsung");
    menu.search("005930");
    assert.deepEqual(menu.rows().map(row => row.dataset.securityId), ["samsung"]);
    menu.search("KOSPI.005930");
    assert.deepEqual(menu.rows().map(row => row.dataset.securityId), ["samsung"]);
    menu.search("00593");
    assert.equal(menu.rows().length, 2);
    menu.search("KOSPI");
    assert.equal(menu.rows().length, 3);
    menu.search("없는검색어");
    assert.equal(menu.rows().length, 0);
    assert.match(document.querySelector('[role="dialog"]').textContent, /검색 결과|일치하는 종목/);
    menu.search("");
    assert.equal(menu.rows().length, 3);
  });
});

test("broad queries and clearing the input render at most 40 results, while exact codes still reach later securities", async () => {
  const data = Array.from({ length: 120 }, (_, i) => securityFixture("보통주", {
    securityId: `security-${i}`, companyId: `company-${i}`, korName: `테스트종목${i}`,
    ticker: String(100000 + i),
  }));
  await withMenu(data, async menu => {
    assert.equal(menu.rows().length, 40);
    menu.search("테");
    assert.equal(menu.rows().length, 40);
    menu.search("ㅌㅅㅌ");
    assert.equal(menu.rows().length, 40);
    menu.search("100119");
    assert.deepEqual(menu.rows().map(row => row.dataset.securityId), ["security-119"]);
    menu.search("10011");
    assert.equal(menu.rows().length, 10);
    menu.search("");
    assert.equal(menu.rows().length, 40);
  });
});

test("keyboard grid navigation distinguishes reused codes and switches between stock and company actions", async () => {
  const data = [
    securityFixture("보통주", { securityId: "old-common", companyId: null, korName: "재사용종목", ticker: "000001", routeCode: null }),
    securityFixture("보통주", { securityId: "new-common", companyId: null, korName: "재사용종목", ticker: "000001", routeCode: null }),
    securityFixture("보통주", { securityId: "samsung" }),
  ];
  await withMenu(data, async menu => {
    menu.search("000001");
    assert.equal(menu.rows().length, 2);
    assert.equal(menu.key("ArrowLeft").defaultPrevented, false, "typing cursor keys work before keyboard row selection");
    menu.key("ArrowDown");
    let cell = document.getElementById(menu.input().getAttribute("aria-activedescendant"));
    assert.equal(cell.getAttribute("role"), "gridcell");
    assert.equal(cell.closest("[data-security-id]"), menu.rows()[0]);
    menu.key("ArrowDown");
    cell = document.getElementById(menu.input().getAttribute("aria-activedescendant"));
    assert.equal(cell.closest("[data-security-id]"), menu.rows()[1], "the second reused-code result has its own keyboard selection");
    const selectedId = cell.closest("[data-security-id]").dataset.securityId;
    menu.key("Enter");
    assert.equal(menu.navigations.at(-1), `/security/${selectedId}/marketcap`);
    assert.equal(document.querySelector('[role="dialog"]'), null);

    await menu.open();
    menu.search("005930");
    menu.key("ArrowDown");
    menu.key("ArrowRight");
    cell = document.getElementById(menu.input().getAttribute("aria-activedescendant"));
    assert.ok(companyLink(cell.closest("[data-security-id]")));
    assert.ok(cell.contains(companyLink(cell.closest("[data-security-id]"))));
    menu.key("Enter");
    assert.equal(menu.navigations.at(-1), "/company/KOSPI.005930");

    await menu.open();
    menu.search("005930");
    menu.key("ArrowDown");
    menu.key("ArrowRight");
    menu.search("삼성");
    menu.key("Enter");
    assert.equal(menu.navigations.at(-1), "/security/KOSPI.005930/marketcap", "a new query resets the company action even when the same stock still matches");
  });
});

test("IME composition and keyCode 229 keep Enter available to the input instead of navigating", async () => {
  await withMenu([securityFixture()], async menu => {
    menu.search("삼성전자");
    assert.equal(menu.key("Enter", { isComposing: true }).defaultPrevented, false);
    assert.equal(menu.key("Enter", { keyCode: 229 }).defaultPrevented, false);
    assert.deepEqual(menu.navigations, []);
    assert.ok(menu.input());
    React.act(() => {
      menu.input().dispatchEvent(new menu.dom.window.CompositionEvent("compositionstart", { bubbles: true, data: "ㅈ" }));
    });
    menu.key("Enter");
    menu.key("Escape");
    assert.deepEqual(menu.navigations, [], "the composition lifecycle also protects browsers omitting isComposing on Enter");
    assert.ok(menu.input(), "Escape during composition must not dismiss the search dialog");
    React.act(() => {
      menu.input().dispatchEvent(new menu.dom.window.CompositionEvent("compositionend", { bubbles: true, data: "자" }));
    });
    menu.key("Enter");
    assert.deepEqual(menu.navigations, ["/security/KOSPI.005930/marketcap"]);
  });
});

test("loading and retry states remain distinct from an empty search", async () => {
  await withMenu([], async menu => {
    assert.match(document.querySelector('[role="status"]').textContent, /불러오는 중/);
    assert.doesNotMatch(document.querySelector('[role="dialog"]').textContent, /검색 결과 없음/);
    assert.equal(menu.rows().length, 0);
  }, { status: "loading" });
  await withMenu([], async menu => {
    assert.match(document.querySelector('[role="status"], [role="alert"]').textContent, /불러오지 못/);
    const retry = [...document.querySelectorAll("button")].find(button => button.textContent === "다시 시도");
    assert.ok(retry);
    await menu.click(retry);
    assert.equal(menu.retries(), 1);
  }, { status: "error" });
});

test("Escape restores the actual opener, external search still opens, and theme controls remain available during a query", async () => {
  await withMenu([securityFixture()], async menu => {
    menu.key("Escape");
    await React.act(async () => new Promise(resolve => menu.dom.window.setTimeout(resolve, 0)));
    assert.equal(document.activeElement, menu.trigger());
    const bottomAction = document.createElement("button");
    bottomAction.textContent = "검색";
    document.body.append(bottomAction);
    bottomAction.focus();
    await React.act(async () => window.dispatchEvent(new Event("app:open-search")));
    assert.ok(menu.input());
    menu.key("Escape");
    await React.act(async () => new Promise(resolve => menu.dom.window.setTimeout(resolve, 0)));
    assert.equal(document.activeElement, bottomAction);
    await menu.open();
    menu.search("일치하지않는종목");
    const dark = document.querySelector('button[aria-label="다크"]');
    assert.ok(dark);
    await menu.click(dark);
    assert.deepEqual(menu.themes, ["dark"]);
  });
});

// The approximate name engine is real here: these tests exercise the boundary
// between direct results, typo suggestions, and the existing navigation grid.
test("typo suggestions appear only after direct results are exhausted and disappear for exact names and codes", async () => {
  const data = [
    securityFixture("보통주", { securityId: "samsung" }),
    securityFixture("우선주", { securityId: "preferred", korName: "삼성전자우", ticker: "005935" }),
    securityFixture("보통주", { securityId: "electromechanics", companyId: null, korName: "삼성전기", ticker: "009150" }),
  ];
  await withMenu(data, async menu => {
    menu.search("삼성전쟈");
    assert.ok(menu.row("samsung"), "a name typo can suggest the intended security");
    assert.match(document.querySelector('[role="status"]').textContent, /일치하는 종목 없음/);
    assert.match(document.querySelector('[role="status"]').textContent, /비슷한 이름 \d+개/);

    menu.search("삼성전기");
    assert.deepEqual(menu.rows().map(row => row.dataset.securityId), ["electromechanics"], "an exact name excludes other similar names");
    assert.doesNotMatch(document.querySelector('[role="status"]').textContent, /비슷한 이름/);
    menu.search("005930");
    assert.deepEqual(menu.rows().map(row => row.dataset.securityId), ["samsung"]);
    assert.doesNotMatch(document.querySelector('[role="status"]').textContent, /비슷한 이름/);
    for (const query of ["005931", "KOSPI.005931", "ㅅㅅㅈㅎ"]) {
      menu.search(query);
      assert.equal(menu.rows().length, 0, `a failed code or initials query must not produce guessed names: ${query}`);
      assert.doesNotMatch(document.querySelector('[role="status"]').textContent, /비슷한 이름/);
    }
    menu.search("삼성전자");
    assert.deepEqual(menu.rows().map(row => row.dataset.securityId), ["samsung", "preferred"]);
    assert.doesNotMatch(document.querySelector('[role="status"]').textContent, /비슷한 이름/);
  });
});

test("typo fallback renders at most five distinct securities and keeps the regular result limit for direct matches", async () => {
  // Reused historical names are separate destinations, not duplicate row keys.
  const data = Array.from({ length: 8 }, (_, i) => securityFixture("보통주", {
    securityId: `similar-${i}`, companyId: `company-${i}`, ticker: String(200000 + i),
  }));
  await withMenu(data, async menu => {
    menu.search("삼성전쟈");
    assert.equal(menu.rows().length, 5);
    assert.equal(new Set(menu.rows().map(row => row.dataset.securityId)).size, 5);
    assert.match(document.querySelector('[role="status"]').textContent, /비슷한 이름 5개/);
    assert.equal(menu.input().hasAttribute("aria-activedescendant"), false, "suggestions do not start with an implicit selection");
    menu.key("Enter");
    assert.deepEqual(menu.navigations, []);
    assert.ok(menu.input());
    menu.search("삼성전자");
    assert.equal(menu.rows().length, 8);
    assert.doesNotMatch(document.querySelector('[role="status"]').textContent, /비슷한 이름/);
  });
});

test("typo suggestions require explicit keyboard selection but support stock, company and pointer navigation", async () => {
  await withMenu([securityFixture()], async menu => {
    menu.search("삼성전쟈");
    assert.equal(menu.rows().length, 1);
    menu.key("Enter");
    assert.deepEqual(menu.navigations, [], "Enter cannot silently accept a guessed security");
    menu.key("ArrowDown");
    menu.key("Enter");
    assert.deepEqual(menu.navigations, ["/security/KOSPI.005930/marketcap"]);
    assert.equal(document.querySelector('[role="dialog"]'), null);

    await menu.open();
    menu.search("삼성전쟈");
    menu.key("ArrowDown");
    menu.key("ArrowRight");
    menu.key("Enter");
    assert.equal(menu.navigations.at(-1), "/company/KOSPI.005930");
    assert.equal(document.querySelector('[role="dialog"]'), null);

    await menu.open();
    menu.search("삼성전쟈");
    menu.key("ArrowDown");
    menu.key("ArrowRight");
    menu.search("삼성전쟈 ");
    assert.equal(menu.input().hasAttribute("aria-activedescendant"), false, "editing a typo resets its previous company selection even if the suggestion stays the same");
    menu.key("Enter");
    assert.equal(menu.navigations.length, 2);
    assert.ok(menu.input());
    await menu.click(securityLink(menu.rows()[0]));
    assert.equal(menu.navigations.at(-1), "/security/KOSPI.005930/marketcap");

    await menu.open();
    menu.search("삼성전쟈");
    await menu.click(companyLink(menu.rows()[0]));
    assert.equal(menu.navigations.at(-1), "/company/KOSPI.005930");
    assert.equal(menu.navigations.length, 4);
    assert.equal(document.querySelector('[role="dialog"]'), null);
  });
});

test("IME composition suppresses typo suggestions and compositionend restores them without accepting one", async () => {
  await withMenu([securityFixture()], async menu => {
    React.act(() => {
      menu.input().dispatchEvent(new menu.dom.window.CompositionEvent("compositionstart", { bubbles: true, data: "ㅈ" }));
    });
    menu.search("삼성전쟈");
    assert.equal(menu.rows().length, 0, "unfinished Korean input must not trigger approximate names");
    assert.doesNotMatch(document.querySelector('[role="status"]').textContent, /비슷한 이름/);
    menu.key("Enter", { isComposing: true });
    assert.deepEqual(menu.navigations, []);
    React.act(() => {
      menu.input().dispatchEvent(new menu.dom.window.CompositionEvent("compositionend", { bubbles: true, data: "쟈" }));
    });
    assert.equal(menu.rows().length, 1, "the completed query is searched even without another input event");
    assert.match(document.querySelector('[role="status"]').textContent, /비슷한 이름 1개/);
    menu.key("Enter");
    assert.deepEqual(menu.navigations, [], "ending composition does not select a guessed result");

    React.act(() => {
      menu.input().dispatchEvent(new menu.dom.window.CompositionEvent("compositionstart", { bubbles: true, data: "ㅈ" }));
    });
    assert.equal(menu.rows().length, 0, "starting a new composition hides existing suggestions immediately");
    menu.search("삼성전자");
    assert.equal(menu.rows().length, 1, "direct matches remain available during composition");
    assert.doesNotMatch(document.querySelector('[role="status"]').textContent, /비슷한 이름/);
    React.act(() => {
      menu.input().dispatchEvent(new menu.dom.window.CompositionEvent("compositionend", { bubbles: true, data: "자" }));
    });
    menu.key("Enter");
    assert.deepEqual(menu.navigations, ["/security/KOSPI.005930/marketcap"]);
  });
});

test("loading or failed data revalidation never labels stale data as typo suggestions", async () => {
  for (const status of ["loading", "error"]) {
    await withMenu([securityFixture()], async menu => {
      menu.search("삼성전쟈");
      assert.equal(menu.rows().length, 0);
      assert.doesNotMatch(document.querySelector('[role="status"]').textContent, /비슷한 이름/);
      menu.key("Enter");
      assert.deepEqual(menu.navigations, []);
    }, { status });
  }
});
