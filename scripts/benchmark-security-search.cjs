#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node.js CommonJS benchmark. */
// Usage: node scripts/benchmark-security-search.cjs /path/to/search-data.json
// Optional: --strict-only (before/after baseline), --rounds=50, --warmup=5.
// Measures synchronous search code, not browser input-to-paint, network, or IME.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { performance } = require("node:perf_hooks");
const { createBusinessPageLoader } = require("../tests/helpers/business-page-loader.cjs");
const cases = require("../tests/fixtures/security-typo-cases.json");

const args = process.argv.slice(2);
const datasetPath = args.find(arg => !arg.startsWith("--"));
if (!datasetPath) {
  console.error("Usage: node scripts/benchmark-security-search.cjs /path/to/search-data.json [--strict-only] [--rounds=50] [--warmup=5]");
  process.exit(1);
}
const strictOnly = args.includes("--strict-only");
function numberOption(name, fallback) {
  const arg = args.find(value => value.startsWith(`--${name}=`));
  if (!arg) return fallback;
  const value = Number(arg.slice(name.length + 3));
  if (!Number.isInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer`);
  return value;
}
const rounds = numberOption("rounds", 50);
const warmup = numberOption("warmup", 5);
const rawData = fs.readFileSync(path.resolve(datasetPath));
const data = JSON.parse(rawData);
if (!Array.isArray(data) || data.some(item => !item || ["securityId", "korName", "ticker", "exchange"].some(key => typeof item[key] !== "string"))) {
  throw new Error("Dataset must be an array of search securities with string securityId, korName, ticker, and exchange.");
}
const code = item => `${item.exchange}.${item.ticker}`;
const existingCodes = new Set(data.map(code));
const absentTargets = [...new Set([...cases.positiveCases, ...cases.directControls]
  .map(test => test.expectedCode).filter(target => !existingCodes.has(target)))];
if (absentTargets.length) throw new Error(`Dataset is missing evaluation targets: ${absentTargets.join(", ")}`);

const loader = createBusinessPageLoader();
const { createSecuritySearchIndex, searchSecurityIndex } = loader.load("lib/security-search.ts");
const typo = strictOnly ? null : loader.load("lib/security-typo-search.ts");
const summarize = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const round = value => Number(value.toFixed(4));
  return {
    samples: values.length,
    medianMs: round(sorted[Math.floor(sorted.length / 2)]),
    p95Ms: round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)]),
    maxMs: round(sorted.at(-1)),
  };
};
const build = factory => {
  const timings = [];
  let index;
  for (let iteration = 0; iteration < 7; iteration++) {
    const start = performance.now();
    index = factory(data);
    timings.push(performance.now() - start);
  }
  return {
    index,
    timing: { firstBuildMs: Number(timings[0].toFixed(4)), ...summarize(timings) },
  };
};
const strictBuild = build(createSecuritySearchIndex);
const typoBuild = typo ? build(typo.createSecurityTypoIndex) : null;
function search(query) {
  const direct = searchSecurityIndex(strictBuild.index, query);
  if (direct.total > 0 || strictOnly) return { items: direct.items, total: direct.total, mode: "direct" };
  const items = typo.searchSecurityTypos(typoBuild.index, query);
  return { items, total: items.length, mode: "fallback" };
}
const groups = ["positiveCases", "negativeCases", "directControls"];
const samples = new Map(groups.flatMap(group => cases[group].map(test => [test.query, []])));
const allCases = groups.flatMap(group => cases[group]);
// Warm both successful and unsuccessful branches. Rotate the case order in each
// measured round so the same input does not always bear collection/JIT costs.
for (let iteration = 0; iteration < warmup; iteration++) {
  for (const test of allCases) search(test.query);
}
for (let iteration = 0; iteration < rounds; iteration++) {
  for (let offset = 0; offset < allCases.length; offset++) {
    const test = allCases[(offset + iteration) % allCases.length];
    const start = performance.now();
    search(test.query);
    samples.get(test.query).push(performance.now() - start);
  }
}
const showItems = items => items.map(item => ({ name: item.korName, code: code(item) }));
const positives = cases.positiveCases.map(test => {
  const result = search(test.query);
  const rank = result.items.findIndex(item => code(item) === test.expectedCode);
  return {
    ...test,
    strictCount: searchSecurityIndex(strictBuild.index, test.query).total,
    expectedRank: rank < 0 ? null : rank + 1,
    mode: result.mode,
    candidates: showItems(result.items),
    timing: summarize(samples.get(test.query)),
  };
});
const negatives = cases.negativeCases.map(test => {
  const result = search(test.query);
  return { ...test, noSuggestions: result.items.length === 0, candidates: showItems(result.items), timing: summarize(samples.get(test.query)) };
});
const controls = cases.directControls.map(test => {
  const direct = searchSecurityIndex(strictBuild.index, test.query);
  const result = search(test.query);
  const retained = result.mode === "direct" && direct.total === result.total
    && direct.items.length === result.items.length
    && direct.items.every((item, i) => item === result.items[i]);
  return {
    ...test, retained,
    expectedFirst: !!result.items[0] && code(result.items[0]) === test.expectedCode,
    total: direct.total, timing: summarize(samples.get(test.query)),
  };
});
const hashFile = filename => crypto.createHash("sha256").update(fs.readFileSync(path.resolve(__dirname, "..", filename))).digest("hex");
console.log(JSON.stringify({
  environment: "Node synchronous search only. Excludes DOM, browser paint/layout, data transfer, React scheduling, and IME composition. No timing assertions; results depend on machine and runtime.",
  casesDescription: cases.description,
  nodeVersion: process.version,
  mode: strictOnly ? "strict-only baseline" : "strict search, then typo fallback only when there are zero direct results",
  dataset: { path: path.resolve(datasetPath), securities: data.length, sha256: crypto.createHash("sha256").update(rawData).digest("hex") },
  sourceHashes: {
    strict: hashFile("lib/security-search.ts"),
    ...(typo ? { typo: hashFile("lib/security-typo-search.ts") } : {}),
    cases: hashFile("tests/fixtures/security-typo-cases.json"),
  },
  rounds, warmup,
  build: { strict: strictBuild.timing, ...(typoBuild ? { typo: typoBuild.timing } : {}) },
  summary: {
    positives: positives.length,
    top1: positives.filter(test => test.expectedRank === 1).length,
    top5: positives.filter(test => test.expectedRank !== null && test.expectedRank <= 5).length,
    misses: positives.filter(test => test.expectedRank === null).map(test => test.query),
    negativesWithNoSuggestions: negatives.filter(test => test.noSuggestions).length,
    negatives: negatives.length,
    directControlsRetained: controls.filter(test => test.retained && test.expectedFirst).length,
    directControls: controls.length,
  },
  timing: Object.fromEntries(groups.map(group => [group, summarize(cases[group].flatMap(test => samples.get(test.query)))])),
  positiveCases: positives,
  negativeCases: negatives,
  directControls: controls,
}, null, 2));
