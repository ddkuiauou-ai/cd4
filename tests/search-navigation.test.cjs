const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const React = require("react");
const ts = require("typescript");

// Execute the actual menu's selection handlers. Only hooks/router/UI shells are
// replaced; URL construction and the existing search category filters stay real.
function loadMenu(data, status = "success") {
  const navigations = [];
  const openStates = [];
  let retries = 0;
  const icon = () => null;
  const component = () => null;
  const hooks = {
    ...React,
    useState: () => [true, (value) => openStates.push(value)],
    useEffect: () => {},
    useCallback: (callback) => callback,
  };
  const commandComponents = Object.fromEntries([
    "CommandDialog", "CommandEmpty", "CommandGroup", "CommandInput",
    "CommandItem", "CommandList", "CommandSeparator",
  ].map((name) => [name, () => null]));
  const stubs = {
    react: hooks,
    "next/navigation": { useRouter: () => ({ push: (url) => navigations.push(url) }) },
    "next-themes": { useTheme: () => ({ setTheme: () => {} }) },
    "@radix-ui/react-icons": new Proxy({}, { get: () => icon }),
    "@/lib/entity-paths": require("./helpers/business-page-loader.cjs").createBusinessPageLoader().load("lib/entity-paths.ts"),
    "@/lib/utils": { cn: (...values) => values.filter(Boolean).join(" ") },
    "@/components/ui/button": { Button: component },
    "@/components/ui/command": commandComponents,
    "@/components/ui/dialog": { DialogTitle: component, DialogDescription: component },
    "@/components/search-data": { useSearchData: () => ({ data, status, retry: () => retries++ }) },
  };
  const filename = path.join(__dirname, "../components/command-menu.tsx");
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => stubs[name] ?? require(name);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  loaded._compile(outputText, filename);
  const selections = [];
  const elements = [];
  function visit(element) {
    if (Array.isArray(element)) return element.forEach(visit);
    if (!React.isValidElement(element)) return;
    elements.push(element);
    if (element.type === commandComponents.CommandItem && element.props.value) {
      selections.push(element.props);
    }
    visit(element.props.children);
  }
  visit(loaded.exports.CommandMenu());
  return { selections, navigations, openStates, elements, retries: () => retries };
}

function securityFixture(type, overrides = {}) {
  return {
    securityId: "security-uuid", companyId: "company-uuid",
    korName: "삼성전자", type, exchange: "KOSPI", ticker: "005930",
    ...overrides,
  };
}

test("company and common-stock selections reach different real routes and close the menu", () => {
  const menu = loadMenu([securityFixture("보통주")]);
  assert.equal(menu.selections.length, 2);
  menu.selections.find((item) => item.value.startsWith("company:")).onSelect();
  menu.selections.find((item) => item.value.startsWith("security:")).onSelect();
  assert.deepEqual(menu.navigations, [
    "/company/KOSPI.005930",
    "/security/KOSPI.005930/marketcap",
  ]);
  assert.deepEqual(menu.openStates, [false, false]);
});

test("preferred stocks and every other search security category retain unique legacy URLs", () => {
  for (const type of ["우선주", "전환우선주", "리츠", "펀드", "스팩"]) {
    const menu = loadMenu([securityFixture(type, {
      companyId: null, korName: "표시 이름, 경로와 다름", exchange: "KOSDAQ", ticker: "005935",
    })]);
    assert.equal(menu.selections.length, 1, type);
    menu.selections[0].onSelect();
    assert.deepEqual(menu.navigations, ["/security/KOSDAQ.005935/marketcap"], type);
    assert.deepEqual(menu.openStates, [false], type);
  }
});

test("a common stock without a company only exposes the security destination", () => {
  const menu = loadMenu([securityFixture("보통주", { companyId: null })]);
  assert.equal(menu.selections.length, 1);
  menu.selections[0].onSelect();
  assert.deepEqual(menu.navigations, ["/security/KOSPI.005930/marketcap"]);
});

test("unclassified historical securities remain searchable and reused codes keep distinct destinations", () => {
  const menu = loadMenu([
    securityFixture(null, { securityId: "old-security", companyId: null }),
    securityFixture("원천 기타 유형", { securityId: "new-security", companyId: null }),
  ]);
  assert.equal(menu.selections.length, 2);
  for (const selection of menu.selections) selection.onSelect();
  assert.deepEqual(menu.navigations, ["/security/old-security/marketcap", "/security/new-security/marketcap"]);
});

test("search shows loading and a usable retry instead of an empty-result message on failure", () => {
  const loading = loadMenu([], "loading");
  assert.ok(loading.elements.some((element) => element.props.role === "status"));
  assert.ok(!loading.elements.some((element) => element.props.children === "검색 결과 없음."));
  const failed = loadMenu([], "error");
  assert.ok(failed.elements.some((element) => element.props.role === "alert"));
  const retry = failed.elements.find((element) => element.props.children === "다시 시도");
  assert.ok(retry);
  retry.props.onClick();
  assert.equal(failed.retries(), 1);
});

test("the actual CMDK menu searches names, tickers and exchanges, and keyboard selection distinguishes reused identities", async () => {
  const { JSDOM } = require("jsdom");
  const { createBusinessPageLoader } = require("./helpers/business-page-loader.cjs");
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
    // Geometry observation is outside this filtering/selection test. Keep the
    // real dialog, focus handling, CMDK input, items and keyboard handlers.
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  for (const [key, value] of Object.entries(globals)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const navigations = [];
  const data = [
    securityFixture("보통주", { securityId: "old-common", companyId: null, korName: "재사용종목", ticker: "000001", routeCode: null }),
    securityFixture("보통주", { securityId: "new-common", companyId: null, korName: "재사용종목", ticker: "000001", routeCode: null }),
    securityFixture("우선주", { securityId: "preferred", companyId: null, korName: "우선검색기업", exchange: "KOSDAQ", ticker: "005935", routeCode: "KOSDAQ.005935" }),
  ];
  const loader = createBusinessPageLoader({
    "next/navigation": { useRouter: () => ({ push: url => navigations.push(url) }) },
    "next-themes": { useTheme: () => ({ setTheme() {} }) },
    "@/components/search-data": { useSearchData: () => ({ data, status: "success", retry() {} }) },
  });
  let mounted;
  try {
    const { createRoot } = require("react-dom/client");
    const { CommandMenu } = loader.load("components/command-menu.tsx");
    mounted = createRoot(document.getElementById("root"));
    await React.act(async () => mounted.render(React.createElement(CommandMenu)));
    const open = async () => React.act(async () => document.querySelector("#root button").click());
    await open();
    const input = () => document.querySelector("[cmdk-input]");
    const visibleItems = () => [...document.querySelectorAll('[cmdk-item]')].filter(item => !item.closest('[cmdk-group][hidden]'));
    const setSearch = async value => React.act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(input(), value);
      input().dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    const key = async value => React.act(async () => input().dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: value, bubbles: true })));
    await setSearch("재사용종목");
    assert.equal(visibleItems().length, 2);
    assert.deepEqual(visibleItems().map(item => item.dataset.value.split(" ")[0]), ["security:old-common", "security:new-common"]);
    assert.equal(document.querySelectorAll('[cmdk-item][aria-selected="true"]').length, 1);
    await key("ArrowDown");
    assert.match(document.querySelector('[cmdk-item][aria-selected="true"]').dataset.value, /^security:new-common /);
    await key("Enter");
    assert.deepEqual(navigations, ["/security/new-common/marketcap"]);
    assert.equal(document.querySelector('[role="dialog"]'), null, "selection closes the actual dialog");

    await open();
    await setSearch("000001");
    assert.equal(visibleItems().length, 2);
    await key("Enter");
    assert.deepEqual(navigations, ["/security/new-common/marketcap", "/security/old-common/marketcap"]);

    await open();
    await setSearch("005935");
    assert.equal(visibleItems().length, 1); assert.match(visibleItems()[0].textContent, /우선검색기업/);
    await setSearch("KOSDAQ");
    assert.equal(visibleItems().length, 1); assert.match(visibleItems()[0].textContent, /우선검색기업/);
    await key("Enter");
    assert.equal(navigations.at(-1), "/security/KOSDAQ.005935/marketcap");
  } finally {
    if (mounted) await React.act(async () => mounted.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
