const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { test } = require('node:test');
const { assembleCandidate } = require('../scripts/build-static-release.cjs');
const { hostedRenderBatches, mergeHostedExport } = require('../scripts/static-hosted-build.cjs');
const { planRelease, publishRelease, readRelease } = require('../scripts/static-release-store.cjs');

function scratch(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-hosted-export-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, key, content) {
  const file = path.join(root, key);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const hash = value => createHash('sha256').update(value).digest('hex');
const table = value => {
  const sha256 = hash(value);
  return { path: `static-data/shared/${sha256.slice(0, 2)}/${sha256.slice(0, 20)}.json`,
    sha256, bytes: Buffer.byteLength(value) };
};

test('hosted planning builds the full inventory from changed bytes and verified baseline metadata', t => {
  const root = scratch(t), store = path.join(root, 'store'), first = path.join(root, 'first'), full = path.join(root, 'full'),
    hosted = path.join(root, 'hosted'), input = path.join(root, 'input');
  const history = table('{"old":"9007199254740993"}'), ranking = table('{"revision":"43"}');
  const firstDay = '2026-12-30', secondDay = '2027-01-04';
  const firstCsv = `downloads/market/${firstDay}.csv`, secondCsv = `downloads/market/${secondDay}.csv`;
  const firstRanking = 'revision,value\n42,1', nextRanking = 'revision,value\n43,0';
  const rankingKey = 'ranking-data/securities-per.csv';
  const detail = 'security/KOSPI.005930/marketcap/index.html';
  const oldChunk = '_next/static/chunks/unchanged.js';
  const detailHtml = `<script src="/${oldChunk}"></script><a href="/${history.path}">History</a>`;
  write(first, 'index.html', 'Day 42');
  write(first, 'stale/index.html', 'Expired');
  write(first, detail, detailHtml);
  write(first, oldChunk, 'function price() {}');
  write(first, history.path, '{"old":"9007199254740993"}');
  write(first, firstCsv, `\uFEFF기준일,종목코드\n${firstDay},005930`);
  write(first, rankingKey, firstRanking);
  publishRelease({ candidate: first, root: store });
  const previous = readRelease(store);
  const documents = planRelease({ candidate: first, previous }).documents;

  const manifest = { assets: [history, ranking], requiredFiles: [rankingKey, secondCsv, 'sitemap.xml'],
    routes: [{ path: '/' }, { path: '/security/KOSPI.005930/marketcap/' }] };
  for (const base of ['company-marketcap', ...['marketcap', 'per', 'pbr', 'eps', 'bps', 'div', 'dps'].map(metric => 'security-' + metric)]) {
    const current = base === 'security-per';
    write(input, `rankings/${base}.json`, JSON.stringify({ metric: base.split('-')[1], scopes: { 'krx-all': {
      state: current ? 'published' : 'unpublished', pages: current ? { '1': '/' + ranking.path } : {},
    } } }));
  }
  write(input, 'assets/' + ranking.path, '{"revision":"43"}');
  for (const candidate of [full, hosted]) {
    write(candidate, 'index.html', 'Day 43');
    write(candidate, 'sitemap.xml', '<urlset />');
    write(candidate, secondCsv, `\uFEFF기준일,종목코드\n${secondDay},005930`);
    write(candidate, rankingKey, nextRanking);
    write(candidate, oldChunk, 'function price() {}');
  }
  write(full, detail, detailHtml);
  write(full, history.path, '{"old":"9007199254740993"}');
  write(full, ranking.path, '{"revision":"43"}');
  const { retained } = assembleCandidate({ output: hosted, input, manifest, changed: ['/'], previous, previousDocuments: documents });
  assert.ok(retained.has(history.path));
  assert.ok(retained.has(detail));
  assert.ok(!fs.existsSync(path.join(hosted, history.path)));
  assert.ok(!fs.existsSync(path.join(hosted, detail)));
  const plan = planRelease({ candidate: hosted, previous, retained });
  const exact = planRelease({ candidate: full, previous });
  assert.deepEqual(plan.inventory, exact.inventory);
  assert.deepEqual(plan.operations, exact.operations);
  assert.ok(plan.inventory.objects.some(record => record.key === firstCsv));
  assert.deepEqual(plan.operations.map(operation => operation.key),
    [ranking.path, secondCsv, rankingKey, 'index.html', 'sitemap.xml', 'stale/index.html']);
  assert.equal(plan.operations.find(operation => operation.key === secondCsv).headers['x-market-row-count'], '1');
  assert.equal(plan.operations.find(operation => operation.key === rankingKey).headers['content-disposition'], 'attachment');
  assert.throws(() => assembleCandidate({ output: hosted, input, manifest, changed: ['/'], previous, previousDocuments: {} }),
    /Missing checkpoint document/);
  const rollover = path.join(root, 'rollover'), compressedHtml = new Map();
  mergeHostedExport({ exported: hosted, output: rollover, compressedHtml, compressedDirectory: path.join(root, 'compressed-html') });
  const assembled = assembleCandidate({ output: rollover, input, manifest, changed: ['/'], previous,
    previousDocuments: documents, compressedHtml });
  const compactPlan = planRelease({ candidate: rollover, previous, retained: assembled.retained, compressedHtml });
  assert.deepEqual(compactPlan.inventory, exact.inventory);
  assert.deepEqual(compactPlan.operations, exact.operations);
});

test('export waves bound previous HTML estimates and reject differing shared bundle bytes', t => {
  const root = scratch(t);
  const waves = hostedRenderBatches(['/per/1/', '/per/2/', '/per/3/'], { objects: new Map([
    ['per/1/index.html', { bytes: 140 * 1024 }],
  ]) }, 220 * 1024);
  assert.deepEqual(waves, [['/per/1/'], ['/per/2/', '/per/3/']]);
  const exported = path.join(root, 'temporary'), output = path.join(root, 'out');
  const chunk = '_next/static/chunks/release.js';
  write(exported, 'per/1/index.html', 'First');
  write(exported, 'per/1/__next._full.txt', 'RSC');
  write(exported, chunk, 'unchanged');
  mergeHostedExport({ exported, output });
  assert.ok(!fs.existsSync(exported));
  assert.ok(!fs.existsSync(path.join(output, 'per/1/__next._full.txt')));
  write(exported, 'per/2/index.html', 'Second');
  write(exported, chunk, 'unchanged');
  mergeHostedExport({ exported, output });
  assert.equal(fs.readFileSync(path.join(output, 'per/1/index.html'), 'utf8'), 'First');
  assert.equal(fs.readFileSync(path.join(output, 'per/2/index.html'), 'utf8'), 'Second');
  write(exported, chunk, 'different');
  assert.throws(() => mergeHostedExport({ exported, output }), /disagree on shared output/);
});

test('year rollover compresses candidate HTML while preserving its public body, dependencies and headers', t => {
  const root = scratch(t), full = path.join(root, 'full'), exported = path.join(root, 'batch'),
    output = path.join(root, 'out'), compressedDirectory = path.join(root, 'compressed-html');
  const chunk = '_next/static/chunks/release.js';
  const html = `<!doctype html><script src="/${chunk}"></script>${'여러 해의 이력'.repeat(2_000)}`;
  for (const directory of [full, exported]) {
    write(directory, 'index.html', html);
    write(directory, chunk, 'browser code');
  }
  const compressedHtml = new Map();
  mergeHostedExport({ exported, output, compressedHtml, compressedDirectory });
  assert.ok(!fs.existsSync(path.join(output, 'index.html')));
  const entry = compressedHtml.get('index.html');
  assert.deepEqual(entry.dependencies, [chunk]);
  assert.ok(fs.statSync(entry.file).size < entry.bytes);
  assert.equal(gunzipSync(fs.readFileSync(entry.file)).toString('utf8'), html);
  const compact = planRelease({ candidate: output, previous: null, compressedHtml });
  const exact = planRelease({ candidate: full, previous: null });
  assert.deepEqual(compact.inventory, exact.inventory);
  assert.deepEqual(compact.operations, exact.operations);
  assert.deepEqual(compact.documents, exact.documents);
  write(output, 'index.html', html);
  assert.throws(() => planRelease({ candidate: output, previous: null, compressedHtml }), /Invalid compressed candidate document/);
});
