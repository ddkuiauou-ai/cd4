const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { findHtmlFiles, generateSitemap } = require("../scripts/generate-sitemap.js");

test("static sitemap excludes both exported error layouts while preserving real pages", (t) => {
  const output = mkdtempSync(path.join(tmpdir(), "cd4-static-sitemap-"));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  for (const filename of [
    "index.html", "404.html", "404/index.html",
    "_not-found.html", "_not-found/index.html",
    "naver27f8d1c4892f79f1822ac4ed3baa4b4e.html", "googleabc123.html",
    "marketcaps/2/index.html", "company/KOSPI.005930/index.html",
    "security/KOSPI.005930/per/index.html", "articles/404/index.html",
    "asset.txt",
  ]) {
    const target = path.join(output, filename);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, "fixture");
  }

  const urls = findHtmlFiles(output).sort();
  assert.deepEqual(urls, [
    "/", "/articles/404/", "/company/KOSPI.005930/",
    "/marketcaps/2/", "/security/KOSPI.005930/per/",
  ]);

  const xml = generateSitemap(urls);
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.deepEqual(locations, urls.map((url) => `https://www.chundan.xyz${url}`));
  assert.ok(!locations.includes("https://www.chundan.xyz/404"));
  assert.ok(!locations.includes("https://www.chundan.xyz/_not-found"));
});
