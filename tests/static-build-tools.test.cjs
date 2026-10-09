const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');
const zlib = require('node:zlib');
const { sha256, writeJson, readManifest, outputFileForRoute, sourceFingerprint } = require('../scripts/static-tools.cjs');
const { finalize } = require('../scripts/finalize-static.cjs');
const { verifyStatic, checkCanonical, directoryFileCounts } = require('../scripts/verify-static.cjs');
const { createStaticServer, headerRules, negotiatedEncoding } = require('../scripts/preview-static.cjs');
const { resourceSummary, phaseTimings, syncWorkspace, publishOutput, verifyAndPublishOutput, selectBuildSettings, runNodeStage } = require('../scripts/build-static.cjs');
const { selectCandidate, inputFingerprint, hashFiles, copyCache, diskFailure } = require('../scripts/benchmark-static.cjs');

function fixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cd4-static-tools-'));
  const output = path.join(directory, 'out');
  const stagedAssets = path.join(directory, 'assets');
  const manifestPath = path.join(directory, 'manifest.json');
  const inventoryDirectory = path.join(directory, 'emitted');
  const siteOrigin = 'https://example.test';
  fs.mkdirSync(output);
  const write = (root, filename, value) => { fs.mkdirSync(path.dirname(path.join(root, filename)), { recursive: true }); fs.writeFileSync(path.join(root, filename), value); };
  for (const [file, route] of [['index.html', '/'], ['security/test/per/index.html', '/security/test/per/']]) write(output, file, `<!doctype html><html><head><link rel="canonical" href="${siteOrigin}${route}"></head><body>static</body></html>`);
  write(output, '404.html', '<!doctype html><html><body>not found</body></html>');
  write(output, 'sitemap.xml', `<urlset><url><loc>${siteOrigin}/</loc></url><url><loc>${siteOrigin}/security/test/per/</loc></url></urlset>`);
  for (const file of ['index.txt', 'security/test/per/index.txt', 'security/test/per/__next._full.txt']) write(output, file, '0:{"static":true}');
  const assetPath = 'static-data/security/test/prices.abc.json';
  write(stagedAssets, assetPath, '[{"date":"2026-10-09","close":"0"}]');
  const assetFile = path.join(stagedAssets, assetPath);
  const manifest = { version: 1, snapshotId: 'test-input', generatedAt: '2026-10-09T00:00:00Z',
    sample: { enabled: false }, routes: [{ path: '/', kind: 'page' }, { path: '/security/test/per/', kind: 'page' }],
    aliases: [{ path: '/old/', target: '/security/test/per/' }], requiredFiles: [],
    assets: [{ path: assetPath, bytes: fs.statSync(assetFile).size, sha256: sha256(assetFile) }] };
  writeJson(manifestPath, manifest);
  return { directory, output, stagedAssets, manifestPath, inventoryDirectory, siteOrigin, manifest, write, cleanup: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

test('static finalization verifies shared assets, retains RSC, and the complete inventory is served without SPA fallback', async () => {
  const data = fixture();
  try {
    finalize(data);
    const report = await verifyStatic({ ...data, compression: true });
    assert.equal(report.canonicalPages, 2);
    assert.equal(report.aliases, 1);
    assert.equal(report.checkedUrls, 3);
    assert.equal(report.output.byFamily['security/per'].pages, 1);
    assert.ok(fs.existsSync(path.join(data.output, 'security/test/per/__next._full.txt')));
    const rules = headerRules(data.output);
    for (const url of ['/', '/index.txt', '/security/test/per/', '/security/test/per/index.txt', '/old/', '/404.html', '/_static-build.json', `/${data.manifest.assets[0].path}`, '/_next/static/chunks/test.js']) {
      assert.equal(rules.filter(rule => rule.values['cache-control'] && rule.match.test(url)).length, 1, `Cache-Control rules must not overlap: ${url}`);
    }
    const alias = fs.readFileSync(path.join(data.output, 'old/index.html'), 'utf8');
    assert.match(alias, /location\.search\+location\.hash/);
    const server = createStaticServer(data);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const asset = await fetch(`${base}/${data.manifest.assets[0].path}`);
      assert.match(asset.headers.get('cache-control'), /immutable/);
      await asset.arrayBuffer();
      const missing = await fetch(`${base}/missing.json`);
      assert.equal(missing.status, 404);
      await missing.arrayBuffer();
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  } finally { data.cleanup(); }
});

test('preview traffic counts negotiated response body bytes and emits RSC and CSV headers', async () => {
  const data = fixture();
  const trafficReport = path.join(data.directory, 'traffic.json');
  const body = JSON.stringify(Array.from({ length: 1000 }, (_, index) => ({ index, label: 'repeated financial history' })));
  try {
    data.write(data.output, 'history.json', body);
    data.write(data.output, 'ranking-data/securities-per.csv', 'code,per\nTEST,10\n');
    finalize(data);
    const server = createStaticServer({ output: data.output, trafficReport, compression: true });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const request = (url, encoding) => new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: server.address().port, path: url, headers: { 'Accept-Encoding': encoding } }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({ headers: response.headers, body: Buffer.concat(chunks) }));
        response.on('error', reject);
      }).on('error', reject);
    });
    try {
      for (const encoding of ['br', 'gzip']) {
        const result = await request('/history.json', encoding);
        assert.equal(result.headers['content-encoding'], encoding);
        assert.equal((encoding === 'br' ? zlib.brotliDecompressSync(result.body) : zlib.gunzipSync(result.body)).toString(), body);
        const report = JSON.parse(fs.readFileSync(trafficReport, 'utf8'));
        assert.equal(report.requests.at(-1).bodyBytes, result.body.length);
        assert.equal(report.requests.at(-1).contentEncoding, encoding);
        assert.equal(report.requests.at(-1).finished, true);
        assert.equal(report.requests.at(-1).uncompressedBytes, Buffer.byteLength(body));
      }
      const rsc = await request('/security/test/per/index.txt', 'identity');
      assert.match(rsc.headers['content-type'], /text\/x-component/);
      const csv = await request('/ranking-data/securities-per.csv', 'identity');
      assert.equal(csv.headers['content-disposition'], 'attachment');
      assert.match(csv.headers['content-type'], /text\/csv/);
      const rules = headerRules(data.output);
      assert.equal(rules.filter(rule => rule.values['content-type'] && rule.match.test('/security/test/per/__next._full.txt')).length, 1);
      assert.equal(negotiatedEncoding('br;q=0,gzip;q=0.5'), 'gzip');
      assert.equal(negotiatedEncoding('br;q=0,gzip;q=0'), null);
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  } finally { data.cleanup(); }
});

test('public verification HTML is accepted only when identical to the original public file', async () => {
  const data = fixture();
  const publicDirectory = path.join(data.directory, 'public');
  try {
    data.write(publicDirectory, 'ownership.html', 'provider-verification: abc');
    data.write(data.output, 'ownership.html', 'provider-verification: abc');
    finalize(data);
    await verifyStatic({ ...data, publicDirectory });
    fs.writeFileSync(path.join(data.output, 'ownership.html'), 'stale');
    await assert.rejects(verifyStatic({ ...data, publicDirectory }), /extra 1|modified original Next file/);
  } finally { data.cleanup(); }
});

test('workspace copying preserves only its compiler cache and leaves source and private input untouched', () => {
  const data = fixture();
  const projectRoot = path.join(data.directory, 'project');
  const workspace = path.join(projectRoot, '.static-build/workspace');
  try {
    data.write(projectRoot, 'app/page.tsx', 'current source');
    data.write(projectRoot, 'node_modules/dependency/index.js', 'dependency');
    data.write(projectRoot, '.env.local', 'private');
    data.write(projectRoot, '.next/cache/cache.bin', 'root cache');
    data.write(projectRoot, 'out/index.html', 'root output');
    data.write(projectRoot, '.static-build/data/input.json', 'private snapshot');
    data.write(workspace, '.next/cache/cache.bin', 'workspace cache');
    data.write(workspace, 'stale-source.ts', 'old source');
    syncWorkspace({ projectRoot, workspace });
    assert.equal(fs.readFileSync(path.join(workspace, 'app/page.tsx'), 'utf8'), 'current source');
    assert.equal(fs.readFileSync(path.join(workspace, '.next/cache/cache.bin'), 'utf8'), 'workspace cache');
    assert.equal(fs.readFileSync(path.join(projectRoot, '.next/cache/cache.bin'), 'utf8'), 'root cache');
    assert.equal(fs.readFileSync(path.join(projectRoot, 'out/index.html'), 'utf8'), 'root output');
    assert.ok(fs.lstatSync(path.join(workspace, 'node_modules')).isSymbolicLink());
    for (const omitted of ['.env.local', '.static-build', 'stale-source.ts', 'out']) assert.equal(fs.existsSync(path.join(workspace, omitted)), false);
    data.write(projectRoot, 'app/page.tsx', 'updated source');
    syncWorkspace({ projectRoot, workspace });
    assert.equal(fs.readFileSync(path.join(workspace, 'app/page.tsx'), 'utf8'), 'updated source');
  } finally { data.cleanup(); }
});

test('output promotion restores the previous completed export on failure and never replaces unmarked files', () => {
  const data = fixture();
  const source = path.join(data.directory, 'workspace/out');
  const backup = path.join(data.directory, 'previous-out');
  try {
    finalize(data);
    data.write(source, 'index.html', 'new export');
    const first = publishOutput({ source, output: data.output, backup });
    assert.equal(fs.readFileSync(path.join(data.output, 'index.html'), 'utf8'), 'new export');
    first.rollback();
    assert.match(fs.readFileSync(path.join(data.output, 'index.html'), 'utf8'), /doctype/);
    assert.equal(fs.readFileSync(path.join(source, 'index.html'), 'utf8'), 'new export');
    const second = publishOutput({ source, output: data.output, backup });
    second.commit();
    assert.equal(fs.existsSync(backup), false);
    data.write(source, 'index.html', 'another export');
    assert.throws(() => publishOutput({ source, output: data.output, backup }), /ENOENT|not recognized/);
    assert.equal(fs.readFileSync(path.join(data.output, 'index.html'), 'utf8'), 'new export');
  } finally { data.cleanup(); }
});

test('verification failure and SIGINT during HTTP verification leave the completed output untouched', async () => {
  const data = fixture();
  const source = path.join(data.directory, 'workspace/out');
  const backup = path.join(data.directory, 'previous-out');
  let child;
  try {
    fs.cpSync(data.output, source, { recursive: true });
    finalize(data);
    const original = sha256(path.join(data.output, 'index.html'));
    data.write(source, 'index.html', '<html>invalid canonical</html>');
    await assert.rejects(verifyAndPublishOutput({ source, output: data.output, backup,
      finalization: data, verification: data }), /canonical/);
    assert.equal(sha256(path.join(data.output, 'index.html')), original);
    assert.equal(fs.existsSync(backup), false);
    fs.rmSync(source, { recursive: true });
    // Copy only the unfinalized files: the helper must run its real finalizer and verifier.
    for (const file of ['index.html', '404.html', 'sitemap.xml', 'index.txt', 'security/test/per/index.html', 'security/test/per/index.txt', 'security/test/per/__next._full.txt']) {
      data.write(source, file, fs.readFileSync(path.join(data.output, file)));
    }
    const helper = path.resolve(__dirname, '../scripts/build-static.cjs');
    const program = `const {verifyAndPublishOutput}=require(${JSON.stringify(helper)});
      global.fetch=async()=>{process.send('verification-paused');await new Promise(()=>{});};
      verifyAndPublishOutput(${JSON.stringify({ source, output: data.output, backup,
        finalization: { manifestPath: data.manifestPath, stagedAssets: data.stagedAssets, inventoryDirectory: data.inventoryDirectory },
        verification: { manifestPath: data.manifestPath, inventoryDirectory: data.inventoryDirectory, siteOrigin: data.siteOrigin } })}).catch(error=>{console.error(error);process.exitCode=1;});`;
    child = spawn(process.execPath, ['-e', program], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    let errors = '';
    child.stderr.on('data', chunk => { errors += chunk; });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Child did not reach HTTP verification: ${errors}`)), 10000);
      child.once('message', message => { clearTimeout(timer); assert.equal(message, 'verification-paused'); resolve(); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Child exited before verification: ${code}; ${errors}`)); });
    });
    const exited = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
    child.kill('SIGINT');
    assert.equal((await exited).signal, 'SIGINT');
    assert.equal(sha256(path.join(data.output, 'index.html')), original);
    assert.equal(fs.existsSync(backup), false);
    assert.equal(fs.existsSync(path.join(source, '_static-build.json')), true);
    fs.rmSync(source, { recursive: true });
    for (const file of ['index.html', '404.html', 'sitemap.xml', 'index.txt', 'security/test/per/index.html', 'security/test/per/index.txt', 'security/test/per/__next._full.txt']) {
      data.write(source, file, fs.readFileSync(path.join(data.output, file)));
    }
    const complete = await verifyAndPublishOutput({ source, output: data.output, backup,
      finalization: data, verification: data });
    assert.equal(complete.verification.success, true);
    assert.equal(fs.existsSync(backup), false);
    assert.equal(fs.existsSync(source), false);
  } finally { if (child && child.exitCode === null) child.kill('SIGKILL'); data.cleanup(); }
});

test('source fingerprints include imported types and ignore private reports', () => {
  const data = fixture();
  const projectRoot = path.join(data.directory, 'source');
  try {
    for (const file of ['next.config.ts', 'package.json', 'pnpm-lock.yaml', '.nvmrc', 'pnpm-workspace.yaml', 'tsconfig.json', 'postcss.config.mjs']) data.write(projectRoot, file, '{}');
    data.write(projectRoot, 'types/stock.ts', 'export type Stock = { code: string };');
    const original = sourceFingerprint(projectRoot);
    data.write(projectRoot, '.static-build/reports/measurement.json', '{"time":1}');
    assert.equal(sourceFingerprint(projectRoot), original);
    data.write(projectRoot, 'types/stock.ts', 'export type Stock = { code: string; price: number };');
    assert.notEqual(sourceFingerprint(projectRoot), original);
  } finally { data.cleanup(); }
});

test('verification rejects extra pages, missing RSC, corrupt assets and sample snapshots', async () => {
  const data = fixture();
  try {
    finalize(data);
    data.write(data.output, 'stale/index.html', '<html></html>');
    await assert.rejects(verifyStatic(data), /extra 1/);
    fs.rmSync(path.join(data.output, 'stale'), { recursive: true });
    const rsc = path.join(data.output, 'security/test/per/index.txt');
    fs.rmSync(rsc);
    await assert.rejects(verifyStatic(data), /Missing full RSC|Missing or modified original Next file/);
    fs.writeFileSync(rsc, '0:{"static":true}');
    fs.writeFileSync(path.join(data.output, data.manifest.assets[0].path), 'changed');
    await assert.rejects(verifyStatic(data), /corrupt shared asset/);
    data.manifest.sample.enabled = true;
    writeJson(data.manifestPath, data.manifest);
    assert.throws(() => readManifest({ filename: data.manifestPath }), /sample snapshot/);
    assert.throws(() => outputFileForRoute('/security/%2e%2e/'), /Unsafe/);
  } finally { data.cleanup(); }
});

test('the full command cannot accept the sample flag or sample environment', () => {
  const filename = path.join(__dirname, '../scripts/build-static.cjs');
  const explicit = spawnSync(process.execPath, [filename, '--full', '--sample'], { encoding: 'utf8' });
  assert.equal(explicit.status, 1);
  assert.match(explicit.stderr, /cannot be turned into a sample/);
  const environment = spawnSync(process.execPath, [filename, '--full'], { env: { ...process.env, STATIC_BUILD_SAMPLE: '40' }, encoding: 'utf8' });
  assert.equal(environment.status, 1);
  assert.match(environment.stderr, /Unset STATIC_BUILD_SAMPLE/);
});

test('resource reports aggregate concurrent processes and parse the installed Next phase timings', () => {
  const data = fixture();
  try {
    const filename = path.join(data.directory, 'resources.jsonl');
    fs.writeFileSync(filename, [
      { event: 'start', at: 1, pid: 10, rss: 100 }, { event: 'start', at: 2, pid: 11, rss: 150 },
      { event: 'sample', at: 3, pid: 10, rss: 200 }, { event: 'exit', at: 4, pid: 11, rss: 150 },
    ].map(row => JSON.stringify(row)).join('\n'));
    assert.equal(resourceSummary(filename).sampledPeakRssBytes, 350);
    fs.writeFileSync(filename, 'Compiled successfully in 7.3s\nFinished TypeScript in 33.8s\nGenerating static pages (4/4) in 1562ms\n');
    assert.deepEqual(phaseTimings(filename), { compileSeconds: 7.3, typecheckSeconds: 33.8, renderSeconds: 1.562 });
  } finally { data.cleanup(); }
});

test('verification detects missing segmented RSC and embedded hashed asset references', async () => {
  const segmented = fixture();
  try {
    finalize(segmented);
    fs.rmSync(path.join(segmented.output, 'security/test/per/__next._full.txt'));
    await assert.rejects(verifyStatic(segmented), /Missing or modified original Next file: security\/test\/per\/__next\._full\.txt/);
  } finally { segmented.cleanup(); }
  for (const [file, text] of [
    ['nested-reference.json', '{"asset":"/static-data/security/missing.01234567890123456789.json"}'],
    ['security/test/per/index.txt', '0:{"asset":"/static-data/security/missing.01234567890123456789.json"}'],
  ]) {
    const data = fixture();
    try {
      data.write(data.output, file, text);
      finalize(data);
      await assert.rejects(verifyStatic(data), /references an absent asset/);
    } finally { data.cleanup(); }
  }
});

test('verification checks canonical identity and the exact sitemap URL inventory', async () => {
  for (const route of ['/marketcaps/', '/marketcaps/1/']) assert.doesNotThrow(() => checkCanonical('<link rel="canonical" href="https://example.test/">', route, 'https://example.test', 'marketcaps/index.html'));
  assert.doesNotThrow(() => checkCanonical('<link rel="canonical" href="https://example.test/per/">', '/per/1/', 'https://example.test', 'per/1/index.html'));
  assert.throws(() => checkCanonical('<link rel="canonical" href="https://example.test/per/1/">', '/per/1/', 'https://example.test', 'per/1/index.html'), /Incorrect canonical/);
  const canonical = fixture();
  try {
    const filename = path.join(canonical.output, 'security/test/per/index.html');
    fs.writeFileSync(filename, fs.readFileSync(filename, 'utf8').replace('/security/test/per/', '/security/wrong/per/'));
    finalize(canonical);
    await assert.rejects(verifyStatic(canonical), /Incorrect canonical/);
  } finally { canonical.cleanup(); }
  const sitemap = fixture();
  try {
    sitemap.write(sitemap.output, 'sitemap.xml', `<urlset><url><loc>${sitemap.siteOrigin}/</loc></url></urlset>`);
    finalize(sitemap);
    await assert.rejects(verifyStatic(sitemap), /Sitemap URL inventory mismatch: missing 1/);
  } finally { sitemap.cleanup(); }
});

test('Node stages put their pinned executable first for native child node invocations', async () => {
  const data = fixture();
  try {
    const report = await runNodeStage('runtime-proof', ['-e', 'const {spawnSync}=require("node:child_process");const r=spawnSync("node",["-e","process.stdout.write(process.versions.node)"],{encoding:"utf8"});process.stdout.write(r.stdout);process.exitCode=r.status'], {
      env: { ...process.env, PATH: '/usr/bin:/bin' }, reportDirectory: data.directory, reserveBytes: 0,
    });
    assert.equal(report.resources.observedNodeRuntimes.length, 1);
    assert.equal(report.resources.observedNodeRuntimes[0].nodeVersion, process.versions.node);
    assert.equal(report.resources.observedNodeRuntimes[0].execPath, process.execPath);
    assert.equal(report.resources.observedNodeRuntimes[0].processes.length, 2);
  } finally { data.cleanup(); }
});

test('benchmark selection uses the five percent speed band and lower sampled RSS', () => {
  const fast = { workers: 8, medianBuildSeconds: 100, sampledPeakRssBytes: 800 };
  const balanced = { workers: 4, medianBuildSeconds: 104.9, sampledPeakRssBytes: 400 };
  const slow = { workers: 2, medianBuildSeconds: 105.1, sampledPeakRssBytes: 200 };
  assert.equal(selectCandidate([fast, balanced, slow]), balanced);
  assert.equal(selectCandidate([fast, slow]), fast);
  assert.throws(() => selectCandidate([]), /No benchmark candidate/);
  assert.equal(diskFailure(new Error('Insufficient disk space')), true);
  assert.equal(Boolean(diskFailure(new Error('Heap out of memory'))), false);
});

test('benchmark fingerprints track private input changes and cache clones remain independent', () => {
  const data = fixture();
  try {
    const initial = inputFingerprint(data.directory);
    data.write(data.directory, 'data/security/test.json', '{"close":"100"}');
    const before = inputFingerprint(data.directory);
    assert.notEqual(before, initial);
    data.write(data.directory, 'data/security/test.json', '{"close":"200"}');
    assert.notEqual(inputFingerprint(data.directory), before);
    const seed = path.join(data.directory, 'seed-cache'), destination = path.join(data.directory, 'restored-cache');
    data.write(seed, 'compiler.bin', 'original compiler cache');
    const copied = copyCache(seed, destination, 0);
    assert.equal(copied.fingerprint, hashFiles(seed, ['compiler.bin']));
    data.write(destination, 'compiler.bin', 'changed compiler cache');
    assert.equal(fs.readFileSync(path.join(seed, 'compiler.bin'), 'utf8'), 'original compiler cache');
  } finally { data.cleanup(); }
});

test('Netlify limits count direct files per directory rather than all output files', () => {
  const files = Array.from({ length: 54000 }, (_, index) => `static-data/security/${index}.json`);
  assert.deepEqual(directoryFileCounts(files).maximum, { directory: 'static-data/security', files: 54000 });
  assert.equal(directoryFileCounts([...files, 'static-data/ranking/extra.csv']).totalFiles, 54001);
  assert.throws(() => directoryFileCounts([...files, 'static-data/security/extra.json']), /directory file limit exceeded/);
});

test('default builds use only completed matching-source benchmark settings and explicit environment values win', () => {
  const data = fixture();
  const benchmarkPath = path.join(data.directory, 'benchmark.json');
  try {
    const options = { env: {}, fingerprint: 'same-source', benchmarkPath };
    assert.equal(selectBuildSettings(options).origin, 'default');
    writeJson(benchmarkPath, { success: true, sourceFingerprint: 'same-source', selected: { workers: 8, concurrency: 1 } });
    assert.deepEqual(Object.fromEntries(Object.entries(selectBuildSettings(options)).filter(([name]) => ['workers', 'concurrency', 'origin'].includes(name))), { workers: '8', concurrency: '1', origin: 'benchmark' });
    assert.equal(selectBuildSettings({ ...options, fingerprint: 'changed-source' }).origin, 'default');
    const explicit = selectBuildSettings({ ...options, env: { STATIC_BUILD_CPUS: '2' } });
    assert.equal(explicit.origin, 'environment'); assert.equal(explicit.workers, '2'); assert.equal(explicit.concurrency, '2');
    const explicitConcurrency = selectBuildSettings({ ...options, env: { STATIC_BUILD_CONCURRENCY: '4' } });
    assert.equal(explicitConcurrency.workers, '4'); assert.equal(explicitConcurrency.concurrency, '4');
    writeJson(benchmarkPath, { success: false, sourceFingerprint: 'same-source', selected: { workers: 8, concurrency: 1 } });
    assert.equal(selectBuildSettings(options).origin, 'default');
  } finally { data.cleanup(); }
});
