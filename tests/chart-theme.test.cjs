const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { JSDOM } = require("jsdom");

const project = path.resolve(__dirname, "..");

for (const name of ["candlestick", "PER-enhanced", "PBR-enhanced"]) {
  test(`${name}: theme changes update canvas colors while preserving data and zoom`, async () => {
    const dom = new JSDOM(`<!doctype html><html><head><style>
      :root { --background:#ffffff; --foreground:#181a1c; --border:#e6e6e6;
        --muted-foreground:#59636b; --market-up:#dc3030; --market-down:#1d5fbf;
        --chart-2:#1d5fbf; --chart-5:#738c76; --brand-ink:#a26300; }
      .dark { --background:#181a1c; --foreground:#f5f7f9; --border:#343a40;
        --muted-foreground:#cbd1d6; --market-up:#f06a68; --market-down:#77a9fa;
        --chart-2:#77a9fa; --chart-5:#96af99; --brand-ink:#f8cd37; }
      </style></head><body><div id="root"></div></body></html>`, { url: "http://localhost" });
    const frames = new Map();
    let frameId = 0;
    const globals = {
      window: dom.window,
      document: dom.window.document,
      getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
      localStorage: dom.window.localStorage,
      requestAnimationFrame: (callback) => { frames.set(++frameId, callback); return frameId; },
      cancelAnimationFrame: (id) => frames.delete(id),
      IS_REACT_ACT_ENVIRONMENT: true,
    };
    dom.window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
    const previous = new Map();
    for (const [key, value] of Object.entries(globals)) {
      previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }

    // Model the library boundary: retain chart/series state and record the public updates.
    const charts = [];
    const chartModule = {
      AreaSeries: "Area", CandlestickSeries: "Candlestick", LineSeries: "Line",
      ColorType: { Solid: "solid" }, CrosshairMode: { Normal: 0 }, PriceScaleMode: { Normal: 0 },
      createChart: (container, options) => {
        const attribution = document.createElement("a");
        attribution.id = "tv-attr-logo";
        attribution.textContent = "TradingView";
        container.appendChild(attribution);
        const chart = {
          options: [options], series: [], removed: false,
          range: null, fitCalls: 0, dataCalls: 0,
          applyOptions(next) {
            // Match the library's attribution widget ownership during a layout refresh.
            // External logo removal makes its supported update throw NotFoundError.
            container.removeChild(attribution);
            container.appendChild(attribution);
            this.options.push(next);
          },
          priceScale: () => ({ applyOptions() {} }),
          timeScale() { return {
            fitContent: () => { this.fitCalls++; },
            setVisibleRange: (range) => { this.range = range; },
          }; },
          addSeries(type, seriesOptions) {
            const series = {
              type, options: [seriesOptions], data: [],
              applyOptions(next) { this.options.push(next); },
              setData: (data) => { series.data = data; chart.dataCalls++; },
              priceScale: () => ({ applyOptions() {} }),
            };
            this.series.push(series);
            return series;
          },
          addPane() { return {
            setHeight() {}, setStretchFactor() {}, moveTo() {}, paneIndex: () => 1,
            addSeries: (type, options) => this.addSeries(type, options),
          }; },
          removeSeries() {}, removePane() {}, subscribeCrosshairMove() {}, unsubscribeCrosshairMove() {},
          remove() { this.removed = true; },
        };
        charts.push(chart);
        return chart;
      },
    };
    const loaded = new Map();
    function load(filename) {
      if (loaded.has(filename)) return loaded.get(filename).exports;
      const mod = new Module(filename);
      loaded.set(filename, mod);
      mod.filename = filename;
      mod.paths = Module._nodeModulePaths(path.dirname(filename));
      mod.require = (moduleName) => {
        if (moduleName === "lightweight-charts") return chartModule;
        const local = moduleName.startsWith("@/") ? path.join(project, moduleName.slice(2))
          : moduleName.startsWith(".") ? path.resolve(path.dirname(filename), moduleName) : null;
        if (!local) return require(moduleName);
        return load([local, `${local}.ts`, `${local}.tsx`].find(existsSync));
      };
      const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
        fileName: filename,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      });
      mod._compile(outputText, filename);
      return mod.exports;
    }
    const { createRoot } = require("react-dom/client");
    const { ThemeProvider, useTheme } = require("next-themes");
    const root = createRoot(dom.window.document.getElementById("root"));
    let changeTheme;
    const component = load(path.join(project, "components", `chart-${name}.tsx`));
    const Chart = name === "candlestick" ? component.CandlestickChart : component.default;
    const data = name === "candlestick"
      ? [{ time: "2026-09-01", open: 100, high: 110, low: 95, close: 108, volume: 100000 },
        { time: "2026-09-02", open: 108, high: 112, low: 102, close: 105, volume: 120000 }]
      : [{ date: "2026-09-01", value: 10, eps: 100 }, { date: "2026-09-02", value: 11, eps: 110 }];
    function Example() {
      changeTheme = useTheme().setTheme;
      return React.createElement(Chart, { data, period: "1M" });
    }
    async function flushFrames() {
      const pending = [...frames.values()];
      frames.clear();
      await React.act(async () => pending.forEach((callback) => callback(0)));
    }
    try {
      await React.act(async () => root.render(React.createElement(ThemeProvider,
        { attribute: "class", defaultTheme: "light", enableSystem: false }, React.createElement(Example))));
      await flushFrames();
      assert.equal(charts.length, 1);
      const chart = charts[0];
      assert.notEqual(chart.options[0].layout.attributionLogo, false);
      assert.ok(dom.window.document.getElementById("tv-attr-logo"), "Chart attribution must remain library-owned");
      assert.equal(chart.options.at(-1).layout.textColor, "#181a1c");
      const savedData = chart.series.map((series) => series.data);
      const savedDataCalls = chart.dataCalls;
      const savedFitCalls = chart.fitCalls;
      const userRange = { from: 1, to: 2 };
      chart.range = userRange;
      await React.act(async () => changeTheme("dark"));
      assert.equal(dom.window.document.documentElement.className, "dark");
      await flushFrames();
      assert.ok(dom.window.document.getElementById("tv-attr-logo"), "Theme/layout refreshes must retain attribution");
      chart.applyOptions({ width: 320 });
      assert.ok(dom.window.document.getElementById("tv-attr-logo"), "Responsive layout refreshes must retain attribution");
      assert.equal(charts.length, 1, "Theme updates must retain the chart instance");
      assert.equal(chart.removed, false);
      const themeOptions = chart.options.findLast((options) => options.layout?.textColor === "#f5f7f9");
      assert.ok(themeOptions);
      assert.equal(themeOptions.timeScale.borderColor, "#343a40");
      assert.equal(chart.range, userRange, "Theme updates must retain the user's zoom");
      assert.equal(chart.dataCalls, savedDataCalls, "Theme updates must not reset series data");
      assert.equal(chart.fitCalls, savedFitCalls);
      chart.series.forEach((series, index) => assert.equal(series.data, savedData[index]));
      const priceOptions = chart.series[0].options.at(-1);
      if (name === "candlestick") {
        assert.equal(priceOptions.upColor, "#f06a68");
        assert.equal(priceOptions.downColor, "#77a9fa");
      } else {
        assert.equal(priceOptions.lineColor || priceOptions.color, "#77a9fa");
      }
    } finally {
      await React.act(async () => root.unmount());
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
      dom.window.close();
    }
  });
}
