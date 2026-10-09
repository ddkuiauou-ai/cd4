const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");

async function withChartEnvironment(run, stubs = {}) {
  const dom = new JSDOM("<!doctype html><div id='root'></div>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  const pendingFrames = new Map();
  let frameId = 0;
  const requestFrame = (callback) => {
    pendingFrames.set(++frameId, callback);
    return frameId;
  };
  const cancelFrame = (id) => pendingFrames.delete(id);
  // Recharts' Redux store couples every RAF with a fallback timer. Run queued
  // frames before restoring globals so each callback also clears its timer.
  dom.window.requestAnimationFrame = requestFrame;
  dom.window.cancelAnimationFrame = cancelFrame;
  const globals = {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    SVGElement: dom.window.SVGElement,
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    requestAnimationFrame: requestFrame,
    cancelAnimationFrame: cancelFrame,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map();
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  dom.window.ResizeObserver = globals.ResizeObserver;

  const { createRoot } = require("react-dom/client");
  const recharts = require("recharts");
  const heatmap = require("@nivo/heatmap");
  // JSDOM has no layout. Supply only dimensions; use the real Recharts chart,
  // axes, public hooks, legend and SVG rendering to exercise the migration.
  const chartModules = {
    ...recharts,
    ResponsiveContainer: ({ children }) => React.cloneElement(children, { width: 640, height: 350 }),
  };
  // Complete animations synchronously with Recharts' public test controller,
  // so geometry assertions do not depend on wall-clock frames or leftover RAFs.
  const finishAnimation = (_timeoutController, animation, listener) => {
    animation.complete();
    listener(animation.getTo());
    return () => {};
  };
  const loaded = new Map();
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = (name) => {
      if (name in stubs) return stubs[name];
      if (name === "recharts") return chartModules;
      if (name === "@nivo/heatmap") return {
        ...heatmap,
        ResponsiveHeatMap: (props) => React.createElement(heatmap.HeatMap, {
          ...props, width: 640, height: 350, animate: false,
        }),
      };
      const local = name.startsWith("@/")
        ? path.join(root, name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (!local) return require(name);
      const resolved = [local, `${local}.ts`, `${local}.tsx`].find(existsSync);
      assert.ok(resolved, `Local module not found: ${name}`);
      return load(resolved);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  const container = dom.window.document.getElementById("root");
  const chartRoot = createRoot(container);
  const flushFrames = async () => {
    let flushCount = 0;
    while (pendingFrames.size) {
      assert.ok(++flushCount < 100, "Chart animation frames must settle");
      await React.act(async () => {
        const callbacks = [...pendingFrames.values()];
        pendingFrames.clear();
        for (const callback of callbacks) callback(dom.window.performance.now());
      });
    }
  };
  const render = async (Component, data) => {
    await React.act(async () => {
      chartRoot.render(React.createElement(recharts.AnimationControllerProvider, { value: finishAnimation },
        React.createElement(Component, {
          data,
          format: "formatNumber",
          formatTooltip: "formatNumberTooltip",
        }),
      ));
    });
    await flushFrames();
  };
  try {
    await run({ container, render, load, flushFrames });
  } finally {
    await React.act(async () => chartRoot.unmount());
    await flushFrames();
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

for (const filename of ["chart-company-marketcap.tsx", "chart-marketcap.tsx"]) {
  test(`${filename}: empty → populated → empty data preserves hook order`, async () => {
    await withChartEnvironment(async ({ container, render, load }) => {
      const Chart = load(path.join(root, "components", filename)).default;
      await render(Chart, []);
      assert.match(container.textContent, /차트 데이터/);
      assert.equal(container.querySelector("svg.recharts-surface"), null);

      const data = Object.freeze([
        Object.freeze({ date: "2026-10-02", totalValue: 120_000_000_000 }),
        Object.freeze({ date: "2026-10-01", totalValue: 110_000_000_000 }),
      ]);
      await render(Chart, data);
      assert.ok(container.querySelector("svg.recharts-surface"));
      assert.ok(container.querySelector(".recharts-line"));
      assert.deepEqual(data.map(({ date }) => date), ["2026-10-02", "2026-10-01"]);

      await render(Chart, []);
      assert.match(container.textContent, /차트 데이터/);
      assert.equal(container.querySelector("svg.recharts-surface"), null);
    });
  });
}

test("company chart renders the axis break at finite coordinates using the Recharts 3 chart context", async () => {
  await withChartEnvironment(async ({ container, render, load }) => {
    const Chart = load(path.join(root, "components/chart-company-marketcap.tsx")).default;
    await render(Chart, [
      { date: "2026-10-01", "총합계": 1_000_000_000_000, "보통주": 100_000_000_000, "우선주": 10_000_000_000 },
      { date: "2026-10-02", "총합계": 1_200_000_000_000, "보통주": 110_000_000_000, "우선주": 12_000_000_000 },
    ]);
    const label = Array.from(container.querySelectorAll("svg text"))
      .find((element) => element.textContent.trim() === "축 생략");
    assert.ok(label, "The compressed axis must retain its visible annotation after the major upgrade");
    for (const [coordinate, maximum] of [["x", 640], ["y", 350]]) {
      const value = Number(label.getAttribute(coordinate));
      assert.ok(Number.isFinite(value) && value > 0 && value < maximum, `${coordinate} must be inside the chart`);
    }
    assert.equal(label.parentElement.querySelectorAll("path").length, 2);
    assert.deepEqual(
      Array.from(container.querySelectorAll(".recharts-legend-wrapper span"), (element) => element.textContent),
      ["전체 시총", "보통주", "우선주"],
      "Keep the application series order despite Recharts 3's alphabetical legend default",
    );

    await render(Chart, [
      { date: "2026-10-01", "총합계": 110_000_000_000, "보통주": 100_000_000_000 },
      { date: "2026-10-02", "총합계": 120_000_000_000, "보통주": 110_000_000_000 },
    ]);
    assert.ok(!container.textContent.includes("축 생략"), "Comparable series must keep a continuous axis");
  });
});

test("DPS growth chart keeps horizontal grid lines and dividend-first legend with named axes", async () => {
  await withChartEnvironment(async ({ container, render, load }) => {
    const Chart = load(path.join(root, "components/chart-dps-growth.tsx")).default;
    await render(Chart, [
      { date: "2024-12-31", value: 1_000, growthRate: null },
      { date: "2025-12-31", value: 1_200, growthRate: 20 },
      { date: "2026-12-31", value: 1_500, growthRate: 25 },
    ]);
    assert.ok(container.querySelectorAll(".recharts-cartesian-grid-horizontal line").length > 0);
    assert.deepEqual(
      Array.from(container.querySelectorAll(".recharts-legend-item-text"), (element) => element.textContent),
      ["주당배당금 (DPS)", "직전 제공 기록 대비 (%)"],
    );
  });
});

for (const metric of ["per", "bps", "dps"]) {
  test(`${metric} heatmap keeps missing cells renderable with themed axes and legible cell text`, async () => {
    await withChartEnvironment(async ({ container, render, load }) => {
      const Heatmap = load(path.join(root, `components/chart-${metric}-heatmap.tsx`)).default;
      const Chart = ({ data }) => React.createElement(Heatmap, { data, minValue: 1, maxValue: 100 });
      await render(Chart, [{ id: "1", data: [{ x: "2025", y: null }, { x: "2026", y: 10 }] }]);
      assert.ok(container.querySelector("svg"));
      const axis = [...container.querySelectorAll("svg text")].find((node) => node.textContent === "2026");
      assert.ok(axis);
      assert.equal(axis.style.fill, "var(--muted-foreground)");
      const cellLabel = [...container.querySelectorAll("svg text")].find((node) => node.textContent === "10");
      assert.ok(cellLabel);
      assert.match(cellLabel.style.fill || cellLabel.getAttribute("fill"), /^#(?:000000|ffffff)$/);
    });
  });
}


test('restored single financial observations keep a real dot for positive, zero and negative source values',async()=>{
  await withChartEnvironment(async({container,render,load})=>{
    const History=load(path.join(root,'components/detail-history-chart.tsx')).DetailHistoryChart;
    const Chart=({data})=>React.createElement(History,{rows:data,metric:'per',label:'PER',unit:'배'});
    for(const value of ['10','0','-3']){
      await render(Chart,[{date:'2026-10-08',value}]);
      const point=container.querySelector('.recharts-line-dot');assert.ok(point,'single supplied value needs a point');
      assert.ok(Number.isFinite(Number(point.getAttribute('cx'))));assert.ok(Number.isFinite(Number(point.getAttribute('cy'))));
      assert.match(container.textContent,/추이를 그릴 이력이 부족/);assert.match(container.textContent,new RegExp(value+'배'));
    }
    await render(Chart,[{date:'2026-10-08',value:null}]);assert.equal(container.querySelector('.recharts-line-dot'),null);
  });
});

test('monthly chart states raw count separately from its one displayed average point',async()=>{
  await withChartEnvironment(async({container,render,load})=>{
    const History=load(path.join(root,'components/detail-history-chart.tsx')).DetailHistoryChart;
    const Chart=({data})=>React.createElement(History,{rows:data,metric:'per',label:'PER',unit:'배'});
    await render(Chart,[{date:'2026-10-01',value:'1'},{date:'2026-10-02',value:'2'},{date:'2026-10-08',value:'3'}]);
    assert.match(container.textContent,/선택 원천 관측 2026-10-01 ~ 2026-10-08 · 3개 기록/);
    assert.ok(container.querySelector('.recharts-line-dot'));
    assert.match(container.querySelector('[role="img"]').getAttribute('aria-label'),/표시 관측 1개/);
  });
});

test('DPS period follows the supplied asOf while BPS keeps the latest actual year-end anchor',async()=>{
  await withChartEnvironment(async({container,render,load})=>{
    const History=load(path.join(root,'components/detail-history-chart.tsx')).DetailHistoryChart;
    const DPS=({data})=>React.createElement(History,{rows:data,metric:'dps',label:'DPS',unit:'원',annual:true,selectedEnd:'2026-10-08'});
    await render(DPS,[{date:'2020-01-01',value:'100'}]);
    assert.match(container.textContent,/선택 기간에 제공된 관측값이 없습니다/);assert.equal(container.querySelector('.recharts-line-dot'),null);
    const BPS=({data})=>React.createElement(History,{rows:data,metric:'bps',label:'BPS',unit:'원',annual:true,selectedEnd:'2026-10-08'});
    await render(BPS,[{date:'2024-12-30',value:'100'}]);
    assert.ok(container.querySelector('.recharts-line-dot'));assert.match(container.textContent,/2024-12-30/);
  });
});

test('DPS keyboard tooltips preserve real zero percent and explain exact nonpositive-baseline differences',async()=>{
  await withChartEnvironment(async({container,render,load,flushFrames})=>{
    const History=load(path.join(root,'components/detail-history-chart.tsx')).DetailHistoryChart;
    const Chart=({data})=>React.createElement(History,{rows:data,metric:'dps',label:'DPS',unit:'원'});
    const move=async key=>{
      await React.act(async()=>container.querySelector('.recharts-wrapper').dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true})));
      await flushFrames();
      const tooltip=container.querySelector('.recharts-tooltip-wrapper');assert.ok(tooltip,'keyboard must expose the real Recharts tooltip');return tooltip.textContent;
    };
    for(const [previous,current,reason]of [['0','9007199254740994','0'],['-9007199254740993','1','음수']]){
      await render(Chart,[{date:'2026-10-01',value:previous},{date:'2026-10-08',value:current}]);
      await move('ArrowLeft');const first=await move('ArrowLeft');assert.match(first,/직전 제공 기록이 없습니다/);assert.doesNotMatch(first,/—%/);
      const second=await move('ArrowRight');assert.match(second,/직전 제공 기록 대비 차이 9,007,199,254,740,994원/);assert.ok(second.includes(`이전 값이 ${reason}라 증감률 계산 불가`));assert.doesNotMatch(second,/—%|Infinity|NaN/);
    }
    await render(Chart,[{date:'2026-10-01',value:'100'},{date:'2026-10-08',value:'100'}]);
    await move('ArrowLeft');const zero=await move('ArrowRight');assert.match(zero,/직전 제공 기록 대비 0%/);assert.doesNotMatch(zero,/계산 불가|차이/);
    await render(Chart,[{date:'2026-10-01',value:'0',observedSecurityIds:['a']},{date:'2026-10-08',value:'100',observedSecurityIds:['a','b']}]);
    await move('ArrowLeft');const changed=await move('ArrowRight');assert.match(changed,/관측 종목 구성이 달라/);assert.doesNotMatch(changed,/차이|0%|계산 불가/);
  });
});

test('actual price history applies end-only bounds to candles and close fallback while preserving nine warmup records',async()=>{
  const candleProps=[];
  await withChartEnvironment(async({container,render,load})=>{
    const Prices=load(path.join(root,'components/restored-detail-charts.tsx')).DetailPriceHistory;
    const data=[{date:'2024-01-01',open:'1',high:'2',low:'1',close:'1',volume:'9007199254740993'},
      ...Array.from({length:11},(_,index)=>({date:`2026-10-${String(index+1).padStart(2,'0')}`,open:String(index+2),high:String(index+3),low:String(index+1),close:String(index+2),volume:'9007199254740993'}))];
    const Default=({data})=>React.createElement(Prices,{rows:data});
    await render(Default,data);assert.match(container.textContent,/실제 거래 범위 2026-10-01 ~ 2026-10-11 · 11개 기록/);assert.equal(candleProps.at(-1).data.filter(row=>!row.warmupOnly).length,11);
    const EndOnly=({data})=>React.createElement(Prices,{rows:data,end:'2026-10-11'});
    await render(EndOnly,data);assert.match(container.textContent,/실제 거래 범위 2024-01-01 ~ 2026-10-11 · 12개 기록/);assert.equal(candleProps.at(-1).data.length,12);assert.equal(candleProps.at(-1).data[0].source.volume,'9007199254740993');
    const Explicit=({data})=>React.createElement(Prices,{rows:data,start:'2026-10-10',end:'2026-10-11'});
    await render(Explicit,data);const explicit=candleProps.at(-1);assert.equal(explicit.data.filter(row=>row.warmupOnly).length,9);assert.equal(explicit.data.filter(row=>!row.warmupOnly).length,2);assert.equal(explicit.data.length,11);
    const closeOnly=data.map(row=>({date:row.date,close:row.close}));
    await render(EndOnly,closeOnly);assert.match(container.textContent,/선택 원천 관측 2024-01-01 ~ 2026-10-11 · 12개 기록/);assert.equal(container.querySelectorAll('.recharts-line-dot').length,12);
  },{'next/dynamic':()=>props=>{candleProps.push(props);return React.createElement('div',{'data-candlestick':true});}});
});
