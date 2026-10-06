const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { JSDOM } = require("jsdom");

const project = path.resolve(__dirname, "..");

test("site provider follows system changes and persists a manual choice across mounts", async () => {
  const dom = new JSDOM("<!doctype html><html><head></head><body><div id='root'></div></body></html>", {
    url: "http://localhost",
  });
  const savedModules = new Map(Object.entries(require.cache));
  const previousGlobals = new Map();
  const pendingTimers = new Map();
  const loaded = new Map();
  let timerId = 0;
  let systemDark = false;
  let root;

  // Dispatch browser media-query events without changing the host's OS or browser settings.
  const media = "(prefers-color-scheme: dark)";
  const mediaQuery = new dom.window.EventTarget();
  const mediaListeners = new Set();
  Object.defineProperties(mediaQuery, {
    media: { value: media },
    matches: { get: () => systemDark },
  });
  mediaQuery.addListener = (listener) => {
    mediaListeners.add(listener);
    mediaQuery.addEventListener("change", listener);
  };
  mediaQuery.removeListener = (listener) => {
    mediaListeners.delete(listener);
    mediaQuery.removeEventListener("change", listener);
  };
  dom.window.matchMedia = (query) => {
    assert.equal(query, media);
    return mediaQuery;
  };

  const globals = {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IS_REACT_ACT_ENVIRONMENT: true,
    // next-themes schedules removal of its transition guard; drain it explicitly, without sleeps.
    setTimeout: (callback, _delay, ...args) => {
      pendingTimers.set(++timerId, () => callback(...args));
      return timerId;
    },
    clearTimeout: (id) => pendingTimers.delete(id),
  };
  for (const [key, value] of Object.entries(globals)) {
    previousGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }

  // Compile the actual provider and its local imports; keep Jotai, Radix and next-themes real.
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = (name) => {
      const local = name.startsWith("@/") ? path.join(project, name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (!local) return require(name);
      const resolved = [local, `${local}.ts`, `${local}.tsx`, `${local}.js`].find(existsSync);
      assert.ok(resolved, `Cannot resolve local import ${name} from ${filename}`);
      return load(resolved);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }

  async function flushTimers() {
    await React.act(async () => {
      const callbacks = [...pendingTimers.values()];
      pendingTimers.clear();
      callbacks.forEach((callback) => callback());
    });
    assert.equal(pendingTimers.size, 0, "Transition cleanup must not leave pending timers");
  }

  function assertTheme(theme, resolvedTheme, systemTheme) {
    const rendered = JSON.parse(dom.window.document.getElementById("theme-state").textContent);
    assert.deepEqual(rendered, { theme, resolvedTheme, systemTheme });
    const html = dom.window.document.documentElement;
    assert.equal(html.classList.contains(resolvedTheme), true);
    assert.equal(html.classList.contains(resolvedTheme === "dark" ? "light" : "dark"), false);
    assert.equal(html.style.colorScheme, resolvedTheme);
  }

  async function changeSystem(dark) {
    assert.notEqual(systemDark, dark, "Each simulated OS change must change the media result");
    await React.act(async () => {
      systemDark = dark;
      mediaQuery.dispatchEvent(Object.assign(new dom.window.Event("change"), { matches: dark, media }));
    });
    await flushTimers();
  }

  async function choose(theme) {
    await React.act(async () => dom.window.document.getElementById(`choose-${theme}`).click());
    await flushTimers();
    assert.equal(dom.window.localStorage.getItem("theme"), theme);
  }

  async function unmount() {
    const mountedRoot = root;
    root = undefined;
    if (mountedRoot) await React.act(async () => mountedRoot.unmount());
    await flushTimers();
  }

  try {
    // next-themes detects the browser at module initialization, so load it after JSDOM globals.
    delete require.cache[require.resolve("next-themes")];
    const { useTheme } = require("next-themes");
    const { createRoot } = require("react-dom/client");
    const { ThemeProvider } = load(path.join(project, "components/providers.tsx"));
    function ThemeProbe() {
      const { theme, resolvedTheme, systemTheme, setTheme } = useTheme();
      return React.createElement(React.Fragment, null,
        React.createElement("output", { id: "theme-state" }, JSON.stringify({ theme, resolvedTheme, systemTheme })),
        ...["light", "system"].map((choice) => React.createElement("button", {
          key: choice, id: `choose-${choice}`, onClick: () => setTheme(choice),
        }, choice)));
    }
    async function mount() {
      root = createRoot(dom.window.document.getElementById("root"));
      // Use the same options as RootLayout.
      await React.act(async () => root.render(React.createElement(ThemeProvider, {
        attribute: "class", defaultTheme: "system", enableSystem: true, disableTransitionOnChange: true,
      }, React.createElement(ThemeProbe))));
      await flushTimers();
      assert.equal(mediaListeners.size, 1, "A mounted provider must listen for system changes");
    }

    assert.equal(dom.window.localStorage.getItem("theme"), null);
    await mount();
    assertTheme("system", "light", "light");
    await changeSystem(true);
    assertTheme("system", "dark", "dark");
    await changeSystem(false);
    assertTheme("system", "light", "light");

    await choose("light");
    assertTheme("light", "light", "light");
    await changeSystem(true);
    assertTheme("light", "light", "dark");
    assert.equal(dom.window.localStorage.getItem("theme"), "light");

    await unmount();
    assert.equal(mediaListeners.size, 0, "Unmount must remove the system listener");
    await mount();
    assertTheme("light", "light", "dark");
    assert.equal(dom.window.localStorage.getItem("theme"), "light");

    await choose("system");
    assertTheme("system", "dark", "dark");
    await changeSystem(false);
    assertTheme("system", "light", "light");
  } finally {
    try {
      await unmount();
    } finally {
      pendingTimers.clear();
      loaded.clear();
      dom.window.close();
      for (const [key, descriptor] of previousGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
      }
      for (const filename of Object.keys(require.cache)) {
        if (!savedModules.has(filename)) delete require.cache[filename];
      }
      for (const [filename, mod] of savedModules) require.cache[filename] = mod;
    }
  }
});
