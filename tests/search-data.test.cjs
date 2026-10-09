const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const fixture = [{
  securityId: "security-uuid", companyId: "company-uuid", korName: "삼성전자",
  type: "보통주", exchange: "KOSPI", ticker: "005930",
}];

function loadSource(relativePath, stubs) {
  const filename = path.join(__dirname, "..", relativePath);
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded.require = (name) => stubs[name] ?? require(name);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  loaded._compile(outputText, filename);
  return loaded.exports;
}

function createSearchClient() {
  const effects = [];
  let subscribe;
  const client = loadSource("components/search-data.ts", {
    react: {
      useEffect: (effect) => effects.push(effect),
      useSyncExternalStore: (listen, getSnapshot) => {
        subscribe = listen;
        return getSnapshot();
      },
    },
  });
  return {
    load: client.loadSearchData,
    snapshot: () => client.useSearchData(false),
    open: () => {
      const value = client.useSearchData(true);
      for (const effect of effects.splice(0)) effect();
      return value;
    },
    subscribe: (listener) => subscribe(listener),
  };
}

async function withFetch(mock, run) {
  const previous = globalThis.fetch;
  globalThis.fetch = mock;
  try { await run(); }
  finally { globalThis.fetch = previous; }
}

test("search waits for menu activation and deduplicates concurrent requests and reopenings", async () => {
  let calls = 0;
  let finish;
  await withFetch((url, options) => {
    calls++;
    assert.equal(url, "/search-data.json");
    assert.equal(options.cache, "no-cache");
    return new Promise((resolve) => { finish = resolve; });
  }, async () => {
    const client = createSearchClient();
    assert.equal(client.snapshot().status, "idle");
    assert.equal(calls, 0, "A closed menu must not download the search list");
    client.open();
    assert.equal(calls, 1);
    const first = client.load();
    assert.equal(client.load(), first, "All menus share the in-flight request");
    finish(Response.json(fixture));
    assert.deepEqual(await first, fixture);
    client.open();
    assert.deepEqual(await client.load(), fixture);
    assert.equal(calls, 1, "A warm menu reuses the shared dataset");
  });
});

test("recent histories do not download the unopened search index and migrate when a menu loads it", async () => {
  const React = require('react');
  const { JSDOM } = require('jsdom');
  const { createBusinessPageLoader } = require('./helpers/business-page-loader.cjs');
  const dom = new JSDOM('<!doctype html><div id="root"></div>', {url:'http://localhost/security/KOSPI.005930/pbr'});
  const values = {window:dom.window,document:dom.window.document,localStorage:dom.window.localStorage,StorageEvent:dom.window.StorageEvent,IS_REACT_ACT_ENVIRONMENT:true};
  const prior = new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value] of Object.entries(values))Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
  let root,calls=0;
  try {
    localStorage.setItem('recently-viewed-securities', JSON.stringify([{secCode:'KOSPI.005930',name:'Samsung',korName:'삼성전자',ticker:'005930',exchange:'KOSPI',lastViewed:1,lastMetric:'pbr',metrics:{pbr:{value:'0',lastViewed:1}}}]));
    await withFetch(async()=>{calls++;return Response.json(fixture);},async()=>{
      const {load}=createBusinessPageLoader();
      const {RecentSecuritiesSidebar}=load('components/recent-securities-sidebar.tsx');
      const {useSearchData}=load('components/search-data.ts');
      function MenuActivation(){
        const [open,setOpen]=React.useState(false);
        const {status}=useSearchData(open);
        return React.createElement('button',{'data-search-toggle':'',onClick:()=>setOpen(true)},status);
      }
      const {createRoot}=require('react-dom/client');root=createRoot(document.getElementById('root'));
      await React.act(async()=>root.render(React.createElement(React.Fragment,null,React.createElement(RecentSecuritiesSidebar),React.createElement(MenuActivation))));
      assert.equal(calls,0,'existing recent records must not cause a search-index request');
      assert.equal(JSON.parse(localStorage.getItem('recently-viewed-securities'))[0].securityId,undefined);
      await React.act(async()=>document.querySelector('[data-search-toggle]').click());
      assert.equal(calls,1);
      const recent=JSON.parse(localStorage.getItem('recently-viewed-securities'))[0];
      assert.equal(recent.securityId,'security-uuid');assert.equal(recent.metrics.pbr.value,'0');
      assert.equal(document.querySelector('.recent-securities a').getAttribute('href'),'/security/KOSPI.005930/pbr');
    });
  }finally{
    if(root)await React.act(async()=>root.unmount());
    for(const [key,descriptor] of prior)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
    dom.window.close();
  }
});

test("the client revalidates after 300 seconds instead of retaining old search data forever", async () => {
  const previousNow = Date.now;
  let now = 1_000_000;
  let calls = 0;
  Date.now = () => now;
  try {
    await withFetch(async () => {
      calls++;
      return Response.json(fixture.map((item) => ({ ...item, korName: `검색 버전 ${calls}` })));
    }, async () => {
      const client = createSearchClient();
      assert.equal((await client.load())[0].korName, "검색 버전 1");
      now += 299_999;
      await client.load();
      assert.equal(calls, 1);
      now += 1;
      assert.equal((await client.load())[0].korName, "검색 버전 2");
      assert.equal(calls, 2);
    });
  } finally { Date.now = previousNow; }
});

test("HTTP errors and malformed JSON evict failed requests and allow retry", async () => {
  for (const response of [new Response("unavailable", { status: 503 }), Response.json({ data: fixture })]) {
    let calls = 0;
    await withFetch(async () => ++calls === 1 ? response : Response.json(fixture), async () => {
      const client = createSearchClient();
      await assert.rejects(client.load());
      assert.equal(client.snapshot().status, "error");
      assert.deepEqual(await client.load(), fixture);
      assert.equal(calls, 2);
      assert.equal(client.snapshot().status, "success");
    });
  }
});

test("unsubscribing one menu does not abort the request or prevent another menu receiving data", async () => {
  let finish;
  await withFetch((_url, options) => {
    assert.equal(options.signal, undefined, "A consumer must not own the shared request's abort signal");
    return new Promise((resolve) => { finish = resolve; });
  }, async () => {
    const client = createSearchClient();
    client.snapshot();
    let firstUpdates = 0;
    let secondUpdates = 0;
    const unsubscribeFirst = client.subscribe(() => firstUpdates++);
    const unsubscribeSecond = client.subscribe(() => secondUpdates++);
    const pending = client.load();
    unsubscribeFirst();
    finish(Response.json(fixture));
    await pending;
    assert.equal(firstUpdates, 1, "Unmounted consumer receives no completion notification");
    assert.equal(secondUpdates, 2, "Remaining consumer receives loading and success");
    assert.deepEqual(client.snapshot().data, fixture);
    unsubscribeSecond();
  });
});

test("the static GET exports only the search fields and preserves the ticker route identity", async () => {
  const route = loadSource("app/search-data.json/route.ts", {
    "@/lib/getSearch": { getSecuritySearchNames: async () => fixture.map((item) => ({ ...item, name: "unused name" })) },
  });
  assert.equal(route.dynamic, "force-static");
  assert.equal(route.revalidate, 300, "Server Full Route Cache must also revalidate");
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await response.json(), fixture);
});
