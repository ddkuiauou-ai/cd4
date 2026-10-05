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
  menu.selections.find((item) => item.value === "삼성전자").onSelect();
  menu.selections.find((item) => item.value === "보통주삼성전자").onSelect();
  assert.deepEqual(menu.navigations, [
    "/company/KOSPI.005930/marketcap",
    "/security/KOSPI.005930/marketcap",
  ]);
  assert.deepEqual(menu.openStates, [false, false]);
});

test("preferred stocks and every other search security category use the exchange and ticker", () => {
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
