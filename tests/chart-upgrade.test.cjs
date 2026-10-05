const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");

async function withChartEnvironment(run) {
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
      if (name === "recharts") return chartModules;
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
    await run({ container, render, load });
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
      ["주당배당금 (DPS)", "전년 대비 성장률 (%)"],
    );
  });
});
