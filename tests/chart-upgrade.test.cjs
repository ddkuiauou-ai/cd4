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
      if (name.endsWith(".module.css")) return {__esModule: true, default: new Proxy({}, {get: (_, key) => String(key)})};
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

test("compact marketcap composition keeps the donut and percentages without the stacked bar", async () => {
  await withChartEnvironment(async ({ container, render, load }) => {
    const Chart = load(path.join(root, "components/chart-pie-marketcap.tsx")).default;
    const data = [
      { securityId: "common", ticker: "005930", name: "삼성전자", type: "보통주", value: 9078, percentage: 90.78 },
      { securityId: "preferred", ticker: "005935", name: "삼성전자우", type: "우선주", value: 922, percentage: 9.22 },
    ];
    const CompactChart = ({ data }) => React.createElement(Chart, { data, compact: true });
    await render(CompactChart, data);
    assert.equal(container.querySelectorAll(".recharts-pie-sector").length, 2);
    assert.equal(container.querySelector(".recharts-bar"), null);
    const legend = container.querySelector('[aria-label="시가총액 구성 종목"]').textContent;
    assert.match(legend, /보통주 · 00593090\.78%/);
    assert.match(legend, /우선주 · 0059359\.22%/);

    await render(Chart, data);
    assert.equal(container.querySelectorAll(".recharts-bar").length, 2);
  });
});

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

test('registered cap charts show exact registered values, coverage and missing observations, with a table for one date', async () => {
  await withChartEnvironment(async ({container,render,load,flushFrames}) => {
    const {InteractiveChartSection}=load(path.join(root,'components/interactive-chart-section.tsx'));
    const company={totalMarketcap:'77777777777777777',securities:[
      {securityId:'common',ticker:'000001',korName:'기업',type:'보통주',marketcapHistory:[{date:'2026-10-08',marketcap:'9007199254740993'}]},
      {securityId:'preferred',ticker:'000002',korName:'기업우',type:'우선주',marketcapHistory:[{date:'2026-10-08',marketcap:'0'}]},
    ],aggregatedHistory:[
      {date:'2025-10-08',totalMarketcap:'12',observedCount:2,targetCount:2,securitiesBreakdown:{common:'10',preferred:'2'}},
      {date:'2026-08-20',totalMarketcap:'9007199254740994',observedCount:1,targetCount:2,securitiesBreakdown:{common:'9007199254740994',preferred:null}},
      {date:'2026-09-14',totalMarketcap:null,observedCount:0,targetCount:2,securitiesBreakdown:{common:null,preferred:null}},
      {date:'2026-10-08',totalMarketcap:'9007199254740993',observedCount:2,targetCount:2,securitiesBreakdown:{common:'9007199254740993',preferred:'0'}},
    ]};
    const Chart=({data})=>React.createElement(InteractiveChartSection,{companyMarketcapData:company,companySecs:[],type:'summary',...data});
    await render(Chart,{});
    assert.equal(container.querySelector('button[aria-pressed="true"]').textContent,'5년');
    assert.equal(container.querySelectorAll('.recharts-line').length,1);
    assert.equal(container.querySelector('.recharts-legend-wrapper'),null);
    assert.match(container.querySelector('figcaption').textContent,/2025-10-08 ~ 2026-10-08 · 3일 관측/);
    const recent=[...container.querySelectorAll('button')].find(button=>button.textContent==='최근 3개월');
    await React.act(async()=>recent.click());
    await flushFrames();
    assert.match(container.querySelector('figcaption').textContent,/2026-08-20 ~ 2026-10-08 · 2일 관측.*부분 관측 1일.*미관측 1일/s);
    const assertLegendPosition=()=>{
      const {position,marginTop,top,paddingBottom}=container.querySelector('.recharts-legend-wrapper').style;
      assert.equal(position,'absolute');
      assert.equal(marginTop,'');
      assert.equal(top,'8px');
      assert.equal(paddingBottom,'8px');
    };
    const move=async key=>{
      await React.act(async()=>container.querySelector('.recharts-wrapper').dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true})));
      await flushFrames();
      return container.querySelector('.recharts-tooltip-wrapper')?.textContent ?? '';
    };
    await move('ArrowLeft');await move('ArrowLeft');
    assert.match(await move('ArrowLeft'),/2026-08-20.*1\/2개 종목 관측 · 부분 관측.*등록 종목 합계9,007,199,254,740,994원.*우선주 · 000002미관측/);
    assert.match(await move('ArrowRight'),/2026-09-14.*0\/2개 종목 관측.*등록 종목 합계미관측/);
    assert.match(await move('ArrowRight'),/2026-10-08.*등록 종목 합계9,007,199,254,740,993원.*우선주 · 0000020원/);
    assert.doesNotMatch(container.textContent,/77,777,777,777,777,777/);
    const all=[...container.querySelectorAll('button')].find(button=>button.textContent==='전체');
    await React.act(async()=>all.click());
    await flushFrames();
    assert.match(container.querySelector('figcaption').textContent,/2025-10-08 ~ 2026-10-08/);

    await render(Chart,{type:'detailed',selectedSecurityId:'preferred'});
    assert.equal(container.querySelectorAll('button').length,0);
    assertLegendPosition();
    await move('ArrowRight');await move('ArrowRight');await move('ArrowRight');await move('ArrowRight');
    assert.match(container.querySelector('.recharts-tooltip-wrapper [aria-current="true"]').textContent,/우선주 · 0000020원/);

    await render(Chart,{type:'detailed',selectedSecurityId:'preferred',start:'2026-10-08',end:'2026-10-08'});
    assert.equal(container.querySelector('svg.recharts-surface'),null);
    assert.match(container.querySelector('[data-history-state="sparse"]').textContent,/2026-10-08.*9,007,199,254,740,993원/);

    const unified = { rows: [], selectedLabel: '기업우' };
    await render(Chart,{selectedSecurityId:'preferred',unified});
    assert.equal(container.querySelectorAll('.recharts-line').length,3);
    assert.match(container.querySelector('.recharts-surface').textContent,/기업우 0원/);
    assert.equal(container.querySelector('.recharts-line-curve[stroke-width="3"]').getAttribute('stroke'),'var(--market-down)');
    await React.act(async()=>[...container.querySelectorAll('button')].find(button=>button.textContent==='최근 3개월').click());
    await flushFrames();
    assert.equal(new URL(window.location.href).searchParams.get('capRange'),'3M');
    await move('ArrowLeft');await move('ArrowLeft');await move('ArrowLeft');
    assert.match(container.querySelector('.recharts-tooltip-wrapper').textContent,/부분 관측.*등록 종목 부분합9,007,199,254,740,994원.*우선주 · 000002미관측/);
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

for (const metric of ["bps", "dps"]) test(`${metric} distribution displays the median and mean of the same provided observations`, async () => {
  await withChartEnvironment(async ({ container, render, load }) => {
    const { DetailFinancialAnalysis } = load(path.join(root, "components/restored-detail-charts.tsx"));
    const Chart = ({ data }) => React.createElement(DetailFinancialAnalysis, { rows: data, metric, name: "종목", kind: "distribution" });
    await render(Chart, [
      { date: "2026-10-01", value: "-4" },
      { date: "2026-10-02", value: "0" },
      { date: "2026-10-03", value: "12" },
      { date: "2026-10-04", value: "20" },
      { date: "2026-10-05", value: "999", state: "source_missing" },
    ]);
    assert.ok(container.querySelector("svg.recharts-surface"));
    assert.match(container.textContent, /평균 7원 · 중앙값 6원/);
    assert.match(container.querySelector("figcaption").textContent, /실제 제공 4개/);
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
      assert.match(container.textContent,/추이를 그릴 이력이 부족/);assert.match(container.textContent,new RegExp(value.replace('-', '−')+'배'));
    }
    await render(Chart,[{date:'2026-10-08',value:null}]);assert.equal(container.querySelector('.recharts-line-dot'),null);
  });
});

test('monthly chart shows the raw count separately from its final provided point',async()=>{
  await withChartEnvironment(async({container,render,load})=>{
    const History=load(path.join(root,'components/detail-history-chart.tsx')).DetailHistoryChart;
    const Chart=({data})=>React.createElement(History,{rows:data,metric:'per',label:'PER',unit:'배'});
    await render(Chart,[{date:'2026-10-01',value:'1'},{date:'2026-10-02',value:'2'},{date:'2026-10-08',value:'3'}]);
    assert.match(container.querySelector('figcaption').textContent,/각 월의 마지막 제공값 · 1개 \/ 원천 관측 3개/);
    assert.ok(container.querySelector('.recharts-line-dot'));
    assert.match(container.querySelector('figcaption').textContent,/2026-10-08 · 3배/);
    assert.match(container.querySelector('[role="group"][aria-label^="PER 차트"]').getAttribute('aria-label'),/좌우 방향키/);
  });
});

test('history axis labels follow the displayed sampling unit without repeating a month for daily points', async () => {
  await withChartEnvironment(async ({container, render, load, flushFrames}) => {
    const {DetailHistoryChart} = load(path.join(root,'components/detail-history-chart.tsx'));
    const rows = [
      {date:'2025-10-31',value:'1'}, {date:'2026-09-10',value:'2'},
      {date:'2026-10-01',value:'4'}, {date:'2026-10-08',value:'3'},
    ];
    const labels = () => [...container.querySelectorAll('.recharts-cartesian-axis-tick-value[orientation="bottom"]')].map(node => node.textContent);
    const Daily = ({data}) => React.createElement(DetailHistoryChart, {rows:data, metric:'dps', unit:'원', label:'주당배당금'});
    await render(Daily,rows);
    assert.ok(labels().includes('2026-10-01') && labels().includes('2026-10-08'));
    assert.equal(new Set(labels()).size, labels().length);

    const PER = ({data}) => React.createElement(DetailHistoryChart, {rows:data, metric:'per', unit:'배', label:'PER'});
    await render(PER,rows);
    assert.ok(labels().includes('2026.10'));
    const yearly = [...container.querySelectorAll('button')].find(button => button.textContent === '연간');
    await React.act(async () => yearly.click());
    await flushFrames();
    assert.deepEqual(labels(), ['2025','2026']);
  });
});

test('ratio charts use rounded value ticks and calendar bounds while exact keyboard tooltips distinguish a gap from zero', async () => {
  await withChartEnvironment(async ({container, render, load, flushFrames}) => {
    const {DetailHistoryChart} = load(path.join(root,'components/detail-history-chart.tsx'));
    const PBR = ({data}) => React.createElement(DetailHistoryChart, {rows:data, metric:'pbr', unit:'배', label:'PBR'});
    await render(PBR,[
      {date:'2026-01-30',value:'-3.1234'},
      {date:'2026-03-30',value:'0'},
      {date:'2026-04-30',value:'4.5678'},
    ]);
    const ticks = orientation => [...container.querySelectorAll(`.recharts-cartesian-axis-tick-value[orientation="${orientation}"]`)].map(node => node.textContent);
    assert.deepEqual(ticks('left'), ['−4','−2','0','2','4','6']);
    assert.deepEqual(ticks('bottom'), ['2026.01','2026.02','2026.03','2026.04']);
    const wrapper = container.querySelector('.recharts-wrapper');
    const tooltip = () => container.querySelector('.recharts-tooltip-wrapper')?.textContent ?? '';
    const move = async key => {
      await React.act(async () => wrapper.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true})));
      await flushFrames();
    };
    for (let i = 0; i < 4; i++) await move('ArrowLeft');
    assert.match(tooltip(), /2026-01-30PBR −3\.12배/);
    assert.equal(container.querySelector('.recharts-tooltip-wrapper strong').title, '-3.1234배');
    await move('ArrowRight');
    assert.match(tooltip(), /2026\.02PBR 미제공/);
    await move('ArrowRight');
    assert.match(tooltip(), /2026-03-30PBR 0배/);
  });
});

test('dense ratio charts keep the isolated and final observations while ordinary points remain interactive', async () => {
  await withChartEnvironment(async ({container, render, load, flushFrames}) => {
    const {DetailHistoryChart} = load(path.join(root,'components/detail-history-chart.tsx'));
    const PER = ({data}) => React.createElement(DetailHistoryChart, {rows:data, metric:'per', unit:'배', label:'PER'});
    const ordinary = Array.from({length:12},(_,index) => ({date:`2024-${String(index+1).padStart(2,'0')}-15`,value:String(index+1)}));
    await render(PER,[...ordinary,
      {date:'2025-03-14',value:'13'}, {date:'2025-05-15',value:'14'}, {date:'2025-06-16',value:'15'},
      {date:'2025-07-15',value:null},
    ]);
    const points = [...container.querySelectorAll('.detail-ratio-dot')];
    assert.equal(points.length,2);
    assert.deepEqual(points.map(point => point.getAttribute('r')), ['2','3']);
    assert.ok(points.every(point => Number.isFinite(Number(point.getAttribute('cx')))));
    const chart = container.querySelector('.recharts-wrapper');
    for (let index=0; index<20; index++) {
      await React.act(async () => chart.dispatchEvent(new window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true})));
      await flushFrames();
    }
    assert.match(container.querySelector('.recharts-tooltip-wrapper').textContent,/2024-01-15PER 1배/);
  });
});

test('EPS bars distinguish a profit, loss, zero and a gap while keeping exact tooltip values', async () => {
  await withChartEnvironment(async ({container, render, load, flushFrames}) => {
    const {DetailHistoryChart} = load(path.join(root,'components/detail-history-chart.tsx'));
    const EPS = ({data}) => React.createElement(DetailHistoryChart, {rows:data, metric:'eps', unit:'원', label:'EPS'});
    await render(EPS,[{date:'2025-09-30',value:'-3300'}, {date:'2025-10-01',value:'-2200.32'}, {date:'2025-10-31',value:'0'},
      {date:'2026-02-27',value:'12000.2'}, {date:'2026-10-08',value:'8400.42'}]);
    const currencyTicks = [...container.querySelectorAll('text[orientation="left"]')].map(node=>node.textContent);
    assert.ok(currencyTicks.includes('0') && currencyTicks.some(label=>/^\d{1,3},\d{3}$/.test(label)));
    assert.match(container.querySelector('figcaption').textContent,/각 월의 마지막 제공값 · 4개 \/ 원천 관측 5개/);
    assert.equal(container.querySelectorAll('.epsBar.epsProfit').length, 2);
    assert.equal(container.querySelectorAll('.epsBar.epsLoss').length, 1);
    assert.equal(container.querySelectorAll('.epsBar.epsZero').length, 1);
    const chart=container.querySelector('.recharts-wrapper');
    const move=async key=>{
      await React.act(async()=>chart.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true})));
      await flushFrames();
    };
    const tooltip = () => container.querySelector('.recharts-tooltip-wrapper');
    for(let index=0;index<14;index++) await move('ArrowLeft');
    assert.match(tooltip().textContent,/2025-09-30EPS −3,300원적자/);
    await move('ArrowRight');
    assert.match(tooltip().textContent,/2025-10-31EPS 0원손익분기점/);
    await move('ArrowRight');
    assert.match(tooltip().textContent,/2025\.11EPS 미제공/);
    const yearly = [...container.querySelectorAll('button')].find(button=>button.textContent==='연간');
    await React.act(async()=>yearly.click());
    await flushFrames();
    for(let index=0;index<3;index++) await move('ArrowRight');
    assert.match(tooltip().textContent,/2026년EPS 10,200원흑자평균에 포함된 제공 관측 2개/);
    assert.equal(tooltip().querySelector('strong').title,'10,200.31원');
    await render(EPS,[{date:'2026-10-08',value:'0'}]);
    assert.ok(container.querySelector('.epsBar.epsZero'));
  });
});

test('BPS tooltips retain exact December observation dates and compare only adjacent annual values', async () => {
  await withChartEnvironment(async ({container, render, load, flushFrames}) => {
    const {DetailHistoryChart} = load(path.join(root,'components/detail-history-chart.tsx'));
    const BPS = ({data}) => React.createElement(DetailHistoryChart, {rows:data, metric:'bps', unit:'원', label:'BPS', annual:true});
    await render(BPS,[{date:'2021-12-30',value:'10000'}, {date:'2022-12-29',value:'0'}, {date:'2023-12-28',value:'-1234.56'},
      {date:'2024-10-08',value:'90000'}, {date:'2025-12-15',value:'18000'}, {date:'2025-12-30',value:null}, {date:'2026-10-08',value:'25000'}]);
    const chart=container.querySelector('.recharts-wrapper');
    const tooltip=()=>container.querySelector('.recharts-tooltip-wrapper')?.textContent ?? '';
    const move=async key=>{
      await React.act(async()=>chart.dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true})));
      await flushFrames();
    };
    for(let index=0;index<6;index++) await move('ArrowLeft');
    assert.match(tooltip(),/2021-12-30BPS 10,000원/);
    await move('ArrowRight');
    assert.match(tooltip(),/2022-12-29BPS 0원전년 대비 −100%/);
    await move('ArrowRight');
    assert.match(tooltip(),/2023-12-28BPS −1,235원전년 대비 차이 −1,235원/);
    assert.equal(container.querySelector('.recharts-tooltip-wrapper strong').title,'-1,234.56원');
    await move('ArrowRight');
    assert.match(tooltip(),/2024년BPS 미제공/);
    await move('ArrowRight');
    assert.match(tooltip(),/2025-12-30BPS 미제공/);
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
      assert.equal(container.querySelector('[aria-label="금액과 변화율의 축"]'),null);
      assert.equal(container.querySelector('text[orientation="right"]'),null);
      await move('ArrowLeft');const first=await move('ArrowLeft');assert.match(first,/직전 제공 기록이 없습니다/);assert.doesNotMatch(first,/—%/);
      const second=await move('ArrowRight');assert.match(second,/직전 제공 기록 대비 차이 9,007,199,254,740,994원/);assert.ok(second.includes(`이전 값이 ${reason}라 증감률 계산 불가`));assert.doesNotMatch(second,/—%|Infinity|NaN/);
    }
    await render(Chart,[{date:'2026-10-01',value:'100'},{date:'2026-10-08',value:'100'}]);
    assert.match(container.querySelector('[aria-label="금액과 변화율의 축"]').textContent,/주당배당금 \(원\).*변화율 \(%\)/);
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


test('dividend comparison keeps same-name securities distinct and exposes actual zero and missing observations', async () => {
  await withChartEnvironment(async ({container, render, load, flushFrames}) => {
    const {DividendComparisonChart} = load(path.join(root,'components/restored-detail-charts.tsx'));
    const chart = ({data}) => React.createElement(DividendComparisonChart,{members:data,metric:'div'});
    const member = (securityId,ticker,dividendHistory) => ({securityId,ticker,korName:'같은이름',type:'우선주',dividendHistory});
    await render(chart, [
      member('first','000001',[{date:'2026-01-11',div:'7',dps:null},{date:'2026-01-30',div:'0',dps:null},{date:'2026-03-12',div:'1',dps:null}]),
      member('second','000002',[{date:'2026-02-26',div:'0.5',dps:null},{date:'2026-03-13',div:'2',dps:null}]),
    ]);
    const legend = container.querySelector('ul[aria-label="비교 종목별 마지막 표시 월의 관측값"]');
    assert.match(legend.textContent,/같은이름 \(000001\) 1%2026-03-12/);
    assert.match(legend.textContent,/같은이름 \(000002\) 2%2026-03-13/);
    assert.match(container.querySelector('figcaption').textContent,/종목당 2개월 제공/);
    assert.equal(container.querySelectorAll('.recharts-line').length, 2);
    assert.equal(container.querySelectorAll('.recharts-line-dot').length, 4);
    const move = async key => {
      await React.act(async()=>container.querySelector('.recharts-wrapper').dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true})));
      await flushFrames();
      return container.querySelector('.recharts-tooltip-wrapper')?.textContent;
    };
    await move('ArrowLeft');
    await move('ArrowLeft');
    const january = await move('ArrowLeft');
    assert.match(january,/같은이름 \(000001\)0% \(2026-01-30\)/);
    assert.match(january,/같은이름 \(000002\)미제공/);
    assert.doesNotMatch(january,/2026-01-11/);
    const february = await move('ArrowRight');
    assert.match(february,/같은이름 \(000001\)미제공/);
    assert.match(february,/같은이름 \(000002\)0.5% \(2026-02-26\)/);
  });
});

test('dividend comparison keeps its selected legend and computes differences from the same date in percentage points or won', async () => {
  await withChartEnvironment(async ({container, render, load, flushFrames}) => {
    const {DividendComparisonChart} = load(path.join(root,'components/restored-detail-charts.tsx'));
    const common={securityId:'common',ticker:'000001',korName:'기업',type:'보통주',dividendHistory:[
      {date:'2026-01-30',div:'0',dps:'0'}, {date:'2026-02-27',div:'1.44',dps:'1446'}, {date:'2026-03-30',div:'0.77',dps:'1446'},
    ]};
    const preferred={securityId:'preferred',ticker:'000002',korName:'기업우',type:'우선주',dividendHistory:[
      {date:'2026-01-30',div:'0',dps:'0'}, {date:'2026-02-26',div:'1.62',dps:'1447'}, {date:'2026-03-30',div:'0.99',dps:'1447'},
    ]};
    const Chart=({data})=>React.createElement(DividendComparisonChart,data);
    await render(Chart,{members:[preferred,common],metric:'div',selectedSecurityId:'preferred'});
    const legend=()=>container.querySelector('[aria-label="비교 종목별 마지막 표시 월의 관측값"]');
    const keys=()=>[...legend().querySelectorAll('path')].map(node=>[node.getAttribute('stroke'),node.getAttribute('stroke-dasharray')]);
    const styles=keys();
    assert.match(legend().querySelector('[aria-current="true"]').textContent,/기업우 .*선택0.99%/);
    assert.equal(container.querySelectorAll('figure time[datetime="2026-03-30"]').length,1);
    assert.match(container.textContent,/우선주 − 보통주\+0.22%p/);
    const move=async key=>{
      await React.act(async()=>container.querySelector('.recharts-wrapper').dispatchEvent(new window.KeyboardEvent('keydown',{key,bubbles:true})));
      await flushFrames();
      return container.querySelector('.recharts-tooltip-wrapper')?.textContent ?? '';
    };
    await move('ArrowLeft');
    await move('ArrowLeft');
    const january=await move('ArrowLeft');
    assert.match(january,/기업 \(000001\)0%.*기업우 \(000002\)0%/);
    assert.match(january,/우선주 − 보통주0%p/);
    const february=await move('ArrowRight');
    assert.match(february,/2026-02-27.*2026-02-26.*관측일이 달라 미산출/);
    assert.doesNotMatch(february,/%p/);
    await render(Chart,{members:[common,preferred],metric:'dps',selectedSecurityId:'common'});
    assert.deepEqual(keys(),styles);
    assert.match(legend().querySelector('[aria-current="true"]').textContent,/기업 \(000001\) 선택1,446원/);
    assert.match(container.textContent,/우선주 − 보통주\+1원/);
    await render(Chart,{members:[common,{...preferred,dividendHistory:preferred.dividendHistory.slice(0,2)}],metric:'dps',selectedSecurityId:'preferred'});
    assert.match(legend().querySelector('[aria-current="true"]').textContent,/기업우 .*선택미제공/);
    assert.doesNotMatch(legend().querySelector('[aria-current="true"]').textContent,/1,447원|2026-02-26/);
    assert.match(container.textContent,/우선주 − 보통주비교 관측 미제공/);
  });
});
