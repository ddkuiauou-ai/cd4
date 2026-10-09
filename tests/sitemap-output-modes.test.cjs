const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
// Initialize native async storage before Next's modules capture the runtime.
require("next/dist/server/node-environment");
const { NextResponse } = require("next/server");
const { isStaticGenEnabled } = require("next/dist/server/route-modules/app-route/helpers/is-static-gen-enabled");

const FIXED_TIME = "2026-10-05T03:04:05.000Z";
const SITE_ORIGIN = "https://www.chundan.xyz";
const REQUEST_ORIGIN = "https://preview.chundan.test:8443";
const METRICS = ["marketcap", "per", "pbr", "bps", "eps", "div", "dps"];
const COUNTS = { marketcap: 121, per: 21, pbr: 0, bps: 20, eps: 120, div: 1, dps: 220 };
const CORE_PATHS = [
  "/", "/dashboard", "/marketcap", "/marketcap/2", "/marketcap/3",
  "/per", "/per/2", "/pbr", "/bps", "/eps", "/eps/2", "/div",
  "/dps", "/dps/2", "/dps/3", "/marketcaps", "/marketcaps/2",
  "/marketcaps/3", "/marketcaps/4",
];
const SECURITY_PATHS = [
  "/security/KOSPI.005930", "/security/KOSPI.005930/marketcap",
  "/security/KOSPI.005930/per", "/security/KOSPI.005930/pbr",
  "/security/KOSPI.005930/bps", "/security/KOSPI.005930/eps",
  "/security/KOSPI.005930/div", "/security/KOSPI.005930/dps",
  "/security/KOSDAQ.0001A0", "/security/KOSDAQ.0001A0/marketcap",
  "/security/KOSDAQ.0001A0/per", "/security/KOSDAQ.0001A0/pbr",
  "/security/KOSDAQ.0001A0/bps", "/security/KOSDAQ.0001A0/eps",
  "/security/KOSDAQ.0001A0/div", "/security/KOSDAQ.0001A0/dps",
];
const COMPANY_PATHS = [
  "/company/KOSPI.005930", "/company/KOSPI.005930/marketcap",
  "/company/KOSDAQ.0001A0", "/company/KOSDAQ.0001A0/marketcap",
];
const LARGE_SEGMENTS = ["core-0", "securities-0", "securities-1", "companies-0", "companies-1"];

function setup(t, mode) {
  const previous = process.env.NEXT_OUTPUT_MODE;
  if (mode === undefined) delete process.env.NEXT_OUTPUT_MODE;
  else process.env.NEXT_OUTPUT_MODE = mode;
  t.after(() => {
    if (previous === undefined) delete process.env.NEXT_OUTPUT_MODE;
    else process.env.NEXT_OUTPUT_MODE = previous;
  });
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(FIXED_TIME) });
}

// Load the complete route and sitemap utilities. Only database query boundaries
// are replaced; pagination, path expansion, chunking and URL joining are real.
function loadRoutes(large = false) {
  const calls = { security: [], company: [], securityCodes: [], companyCodes: [] };
  const securities = large
    ? Array.from({ length: 626 }, (_, index) => `KOSPI.${String(index + 1).padStart(6, "0")}`)
    : ["KOSPI.005930", "KOSDAQ.0001A0", "KOSPI.005930"];
  const companies = large
    ? Array.from({ length: 2501 }, (_, index) => `KOSPI.${String(index + 1).padStart(6, "0")}`)
    : ["KOSPI.005930", "KOSDAQ.0001A0", "KOSPI.005930"];
  const queryMocks = {
    "@/lib/static-build/server": { isStaticBuild: () => false },
    "@/lib/data/security": { countSecurityRanks: async (...args) => { calls.security.push(args); return COUNTS[args[0]]; } },
    "@/lib/data/company": { countCompanyMarketcaps: async (...args) => { calls.company.push(args); return 221; } },
    "@/lib/select": {
      getAllSecurityCodes: async (...args) => { calls.securityCodes.push(args); return securities; },
      getAllCompanyCodes: async (...args) => { calls.companyCodes.push(args); return companies; },
    },
  };
  const localFiles = {
    "@/config/site": "config/site.ts",
    "@/lib/sitemap/utils": "lib/sitemap/utils.ts",
    "@/lib/data/pagination": "lib/data/pagination.ts",
  };
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports;
    const filename = path.join(__dirname, "..", relative);
    const loaded = new Module(filename);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    cache.set(relative, loaded);
    loaded.require = (name) => {
      if (Object.hasOwn(queryMocks, name)) return queryMocks[name];
      if (Object.hasOwn(localFiles, name)) return load(localFiles[name]);
      assert.ok(!name.startsWith("@/"), `Unexpected database or application import: ${name}`);
      return require(name);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    loaded._compile(outputText, filename);
    return loaded.exports;
  }
  return {
    index: load("app/sitemap.xml/route.ts"),
    chunk: load("app/sitemaps/[segment]/[fileName]/route.ts"),
    calls,
  };
}

function assertQueries(calls, count) {
  assert.deepEqual(calls.security, Array.from({ length: count }, () => METRICS.map((metric) => [metric])).flat());
  for (const key of ["company", "securityCodes", "companyCodes"]) {
    assert.deepEqual(calls[key], Array.from({ length: count }, () => []), key);
  }
}

async function assertXml(response, root, locations) {
  assert.ok(response instanceof NextResponse);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "application/xml");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=0, s-maxage=3600");
  const xml = await response.text();
  assert.ok(xml.startsWith(`<?xml version="1.0" encoding="UTF-8"?>\n<${root} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`));
  assert.ok(xml.endsWith(`</${root}>`));
  assert.deepEqual([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]), locations);
  assert.deepEqual([...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1]), locations.map(() => FIXED_TIME));
}

for (const mode of [
  { name: "export", value: "ExPoRt", origin: SITE_ORIGIN },
  { name: "standalone", value: "standalone", origin: REQUEST_ORIGIN },
]) {
  const request = (pathname) => mode.name === "export"
    ? { get url() { throw new Error("Static export accessed the dynamic request URL"); } }
    : new Request(`${REQUEST_ORIGIN}${pathname}?source=sitemap-test`);

  test(`sitemap index in ${mode.name} lists every generated chunk with the correct origin`, async (t) => {
    setup(t, mode.value);
    const loaded = loadRoutes(true);
    await assertXml(await loaded.index.GET(request("/sitemap.xml")), "sitemapindex",
      LARGE_SEGMENTS.map((segment) => `${mode.origin}/sitemaps/${segment}/sitemap.xml`));
    assertQueries(loaded.calls, 1);
    assert.equal(loaded.index.revalidate, false);
    assert.equal(isStaticGenEnabled(loaded.index), true);
    assert.equal(isStaticGenEnabled(loaded.chunk), mode.name === "export");
  });

  test(`core, security and company sitemap responses in ${mode.name} preserve all paths and headers`, async (t) => {
    setup(t, mode.value);
    const loaded = loadRoutes();
    for (const [segment, paths] of [["core-0", CORE_PATHS], ["securities-0", SECURITY_PATHS], ["companies-0", COMPANY_PATHS]]) {
      const response = await loaded.chunk.GET(request(`/sitemaps/${segment}/sitemap.xml`), {
        params: Promise.resolve({ segment, fileName: "sitemap.xml" }),
      });
      await assertXml(response, "urlset", paths.map((pathname) => `${mode.origin}${pathname}`));
    }
    assertQueries(loaded.calls, 3);
  });

  test(`sitemap chunk boundaries in ${mode.name} retain the final security and company entries`, async (t) => {
    setup(t, mode.value);
    const loaded = loadRoutes(true);
    const finalSecurityPaths = [
      "/security/KOSPI.000626", "/security/KOSPI.000626/marketcap",
      "/security/KOSPI.000626/per", "/security/KOSPI.000626/pbr",
      "/security/KOSPI.000626/bps", "/security/KOSPI.000626/eps",
      "/security/KOSPI.000626/div", "/security/KOSPI.000626/dps",
    ];
    for (const [segment, paths] of [
      ["securities-1", finalSecurityPaths],
      ["companies-1", ["/company/KOSPI.002501", "/company/KOSPI.002501/marketcap"]],
    ]) {
      await assertXml(await loaded.chunk.GET(request(`/sitemaps/${segment}/sitemap.xml`), {
        params: Promise.resolve({ segment, fileName: "sitemap.xml" }),
      }), "urlset", paths.map((pathname) => `${mode.origin}${pathname}`));
    }
    assertQueries(loaded.calls, 2);
  });

  test(`generateStaticParams in ${mode.name} ${mode.name === "export" ? "enumerates every chunk" : "is absent without queries"}`, async (t) => {
    setup(t, mode.value);
    const loaded = loadRoutes(true);
    if (mode.name === "export") {
      assert.deepEqual(await loaded.chunk.generateStaticParams(),
        LARGE_SEGMENTS.map((segment) => ({ segment, fileName: "sitemap.xml" })));
    } else {
      assert.equal(loaded.chunk.generateStaticParams, undefined);
    }
    assertQueries(loaded.calls, mode.name === "export" ? 1 : 0);
  });

  test(`invalid sitemap filenames in ${mode.name} return Next's 404 before any queries`, async (t) => {
    setup(t, mode.value);
    const loaded = loadRoutes();
    for (const fileName of ["sitemap.json", "Sitemap.xml", "sitemap.xml.extra"]) {
      await assert.rejects(loaded.chunk.GET(request(`/sitemaps/core-0/${fileName}`), {
        params: Promise.resolve({ segment: "core-0", fileName }),
      }), (error) => error.digest === "NEXT_HTTP_ERROR_FALLBACK;404");
    }
    assertQueries(loaded.calls, 0);
  });
}

test("an unset output mode keeps the request origin and does not generate static chunk params", async (t) => {
  setup(t, undefined);
  const loaded = loadRoutes();
  assert.equal(loaded.chunk.generateStaticParams, undefined);
  assertQueries(loaded.calls, 0);
  await assertXml(await loaded.index.GET(new Request(`${REQUEST_ORIGIN}/sitemap.xml`)), "sitemapindex", [
    `${REQUEST_ORIGIN}/sitemaps/core-0/sitemap.xml`,
    `${REQUEST_ORIGIN}/sitemaps/securities-0/sitemap.xml`,
    `${REQUEST_ORIGIN}/sitemaps/companies-0/sitemap.xml`,
  ]);
  assertQueries(loaded.calls, 1);
});

test("installed Next skips static-param collection for standalone sitemap chunks", async (t) => {
  setup(t, "standalone");
  const { collectSegments } = require("next/dist/build/segment-config/app/app-segments");
  const { generateRouteStaticParams } = require("next/dist/build/static-paths/app");
  const loaded = loadRoutes(true);
  const pathname = "/sitemaps/[segment]/[fileName]";
  const routeModule = {
    definition: { kind: "APP_ROUTE", pathname, filename: "app/sitemaps/[segment]/[fileName]/route.ts" },
    ensureUserland: async () => {},
    userland: loaded.chunk,
  };
  assert.equal(isStaticGenEnabled(loaded.chunk), false);
  const { segments } = await collectSegments(routeModule);
  assert.ok(segments.every((segment) => segment.generateStaticParams === undefined));
  assert.deepEqual(await generateRouteStaticParams(segments, { page: `${pathname}/route` }, false, [], false), []);
  assertQueries(loaded.calls, 0);
});

test("native standalone route handling reads each request origin without static-generation errors", async (t) => {
  setup(t, "standalone");
  const { NextRequest } = require("next/server");
  const { AppRouteRouteModule } = require("next/dist/server/route-modules/app-route/module");
  const loaded = loadRoutes();
  const pathname = "/sitemaps/[segment]/[fileName]";
  const filename = path.join(__dirname, "..", "app/sitemaps/[segment]/[fileName]/route.ts");
  const routeModule = new AppRouteRouteModule({
    definition: { kind: "APP_ROUTE", page: `${pathname}/route`, pathname, filename, bundlePath: "app/sitemaps/[segment]/[fileName]/route" },
    userland: () => loaded.chunk,
    resolvedPagePath: filename,
    nextConfigOutput: "standalone",
  });
  for (const origin of [REQUEST_ORIGIN, "http://second.chundan.test:8088"]) {
    const response = await routeModule.handle(new NextRequest(`${origin}/sitemaps/core-0/sitemap.xml`), {
      params: { segment: "core-0", fileName: "sitemap.xml" },
      previewProps: {},
      sharedContext: { buildId: "sitemap-test" },
      renderOpts: { supportsDynamicResponse: !isStaticGenEnabled(loaded.chunk), cacheComponents: false, experimental: {}, cacheLifeProfiles: {} },
    });
    await assertXml(response, "urlset", CORE_PATHS.map((pathname) => `${origin}${pathname}`));
  }
  assertQueries(loaded.calls, 2);
});

test("installed Next collects both sitemap params instead of treating the route as a static metadata file", async (t) => {
  setup(t, "export");
  // Native static-param collection uses Next's async storage, as it does in a
  // build worker. No incremental cache or build pipeline is started here.
  const { isStaticMetadataFile } = require("next/dist/lib/metadata/is-metadata-route");
  const { getStaticMetadataPrerenderPathname } = require("next/dist/lib/metadata/get-metadata-route");
  const { collectSegments } = require("next/dist/build/segment-config/app/app-segments");
  const { generateRouteStaticParams } = require("next/dist/build/static-paths/app");
  const pathname = "/sitemaps/[segment]/[fileName]";
  assert.equal(isStaticMetadataFile(pathname), false);
  assert.equal(getStaticMetadataPrerenderPathname(pathname), null);

  const loaded = loadRoutes(true);
  let ensured = 0;
  const routeModule = {
    definition: { kind: "APP_ROUTE", pathname, filename: "app/sitemaps/[segment]/[fileName]/route.ts" },
    ensureUserland: async () => { ensured += 1; },
    userland: loaded.chunk,
  };
  const { segments } = await collectSegments(routeModule);
  assert.equal(ensured, 1);
  assert.deepEqual(segments.filter((segment) => segment.paramName).map((segment) => segment.paramName), ["segment", "fileName"]);
  assert.equal(segments.at(-1).generateStaticParams, loaded.chunk.generateStaticParams);
  const params = await generateRouteStaticParams(segments, { page: `${pathname}/route` }, false, [], true);
  assert.deepEqual(params, LARGE_SEGMENTS.map((segment) => ({ segment, fileName: "sitemap.xml" })));
  assert.deepEqual(params.map(({ segment, fileName }) => `/sitemaps/${segment}/${fileName}`),
    LARGE_SEGMENTS.map((segment) => `/sitemaps/${segment}/sitemap.xml`));
  assertQueries(loaded.calls, 1);
});
