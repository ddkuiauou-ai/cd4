const assert = require("node:assert/strict");
const { existsSync, readFileSync, statSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");

// Resolve the real route/component source while replacing only I/O boundaries.
// Async server components must finish before React's synchronous HTML renderer.
async function resolveElement(node) {
  if (Array.isArray(node)) return Promise.all(node.map(resolveElement));
  if (!React.isValidElement(node)) return node;
  if (typeof node.type === "function") {
    // React renders synchronous/client components so hooks run in a valid dispatcher.
    if (node.type.constructor.name === "AsyncFunction") return resolveElement(await node.type(node.props));
    return node;
  }
  const children = await resolveElement(node.props.children);
  return React.cloneElement(node, undefined, ...(Array.isArray(children) ? children : [children]));
}

function createBusinessPageLoader(overrides = {}) {
  const boundaries = {
    "server-only": {},
    "@/db": { db: {} },
    "next/link": { default: ({ href, children, prefetch, ...props }) => { void prefetch; return React.createElement("a", { href, ...props }, children); } },
    "next/server": { connection: async () => {} },
    "next/navigation": {
      usePathname: () => "/",
      notFound: () => { throw new Error("NOT_FOUND"); },
      redirect: (href) => { throw new Error(`REDIRECT:${href}`); },
    },
    ...overrides,
  };
  const loaded = new Map();
  function loadFile(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = (name) => {
      if (Object.hasOwn(boundaries, name)) return { __esModule: true, ...boundaries[name] };
      if (name.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
      const local = name.startsWith("@/") ? path.join(root, name.slice(2))
        : name.startsWith(".") ? path.resolve(path.dirname(filename), name) : null;
      if (!local) return require(name);
      const resolved = [local, `${local}.ts`, `${local}.tsx`, `${local}.js`, path.join(local, "index.ts"), path.join(local, "index.tsx")]
        .find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      assert.ok(resolved, `Local module not found: ${name}`);
      return loadFile(resolved);
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
  const load = relative => loadFile(path.join(root, relative));
  async function renderElement(element) {
    const html = renderToStaticMarkup(await resolveElement(element));
    return { html, text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() };
  }
  async function renderRoute(route, { params = {}, searchParams = {} } = {}) {
    const { default: Page } = load(route);
    return renderElement(await Page({ params: Promise.resolve(params), searchParams: Promise.resolve(searchParams) }));
  }
  return { load, renderRoute, renderElement };
}

module.exports = { createBusinessPageLoader };
