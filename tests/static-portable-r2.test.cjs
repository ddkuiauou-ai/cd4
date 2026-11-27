const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gzipSync } = require('node:zlib');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cd-portable-test-'));
process.env.STATIC_RELEASE_HOME = home;
test.after(() => fs.rmSync(home, { recursive: true, force: true }));
const { RUNS, markReleaseRun } = require('../scripts/clean-static-release.cjs');
const { deploy } = require('../scripts/deploy-static-r2.cjs');
const { planRelease } = require('../scripts/static-release-store.cjs');
const { createR2Client } = require('../scripts/static-r2-client.cjs');
const { cleanPortable } = require('../scripts/static-portable-r2.cjs');
const { readJson, writeJson } = require('../scripts/static-tools.cjs');

const CURRENT = 'cd-release/current.json';
const commit = 'a'.repeat(40);
const config = { publicBucket: 'test-site', stateBucket: 'test-state', origin: new URL('https://example.test/') };
const sha256 = data => createHash('sha256').update(data).digest('hex');
const partName = sha256('SECURITY').slice(0, 32);
const archiveKey = `data/security-history/${partName}.archive.json.gz`;
const currentKey = `data/security-history/${partName}.current.json.gz`;
const securityKey = 'data/security/SECURITY.json.gz';
const firstDay = '2026-11-25', secondDay = '2026-11-26', thirdDay = '2026-11-27';
const sourcePublication = 'security_latest/krx-all';

function memoryR2() {
  const metadata = new Map(), privateObjects = new Map(), publicObjects = new Map(), publicHeaders = new Map();
  const metadataReads = [], privateReads = [], privateWrites = [], publicWrites = [];
  const mock = { metadata, privateObjects, publicObjects, publicHeaders, metadataReads, privateReads, privateWrites, publicWrites };
  mock.client = {
    async checkBucket(bucket) { assert.ok([config.stateBucket, config.publicBucket].includes(bucket)); },
    async probeBucket() { return { readable: true }; },
    async getJson(bucket, key) {
      assert.equal(bucket, config.stateBucket);
      metadataReads.push(key);
      return structuredClone(metadata.get(key) ?? null);
    },
    async putJson(bucket, key, value, etag = null) {
      assert.equal(bucket, config.stateBucket);
      assert.equal(metadata.get(key)?.etag ?? null, etag);
      const next = sha256(JSON.stringify(value));
      metadata.set(key, { value: structuredClone(value), etag: next });
      return next;
    },
    async putPrivateObject(object, file) {
      if (mock.failPrivate) throw new Error('private staged PUT failed');
      const bytes = fs.readFileSync(file);
      assert.equal(object.sha256, sha256(bytes));
      assert.equal(object.bytes, bytes.length);
      privateObjects.set(object.key, bytes);
      privateWrites.push(object.key);
    },
    async getPrivateObject(object, file) {
      const bytes = privateObjects.get(object.key);
      assert.equal(object.sha256, sha256(bytes));
      assert.equal(object.bytes, bytes.length);
      privateReads.push(object.key);
      fs.writeFileSync(file, bytes);
    },
    async *listPortableKeys() {
      yield* [...metadata.keys(), ...privateObjects.keys()].filter(key => key.startsWith('cd-release/portable/'));
    },
    async putObject(bucket, object, file) {
      assert.equal(bucket, config.publicBucket);
      if (mock.failPublic === object.key) throw new Error('public staged PUT failed');
      publicObjects.set(object.key, fs.readFileSync(file, 'utf8'));
      publicHeaders.set(object.key, object.headers);
      publicWrites.push(object.key);
    },
    async deleteKeys(bucket, keys) {
      const objects = bucket === config.stateBucket ? privateObjects : publicObjects;
      for (const key of keys) {
        objects.delete(key);
        if (bucket === config.stateBucket) metadata.delete(key);
      }
    },
  };
  return mock;
}

function fixture(day, revision, options, previousRelease = options.previousRelease) {
  fs.mkdirSync(RUNS, { recursive: true });
  const run = fs.mkdtempSync(path.join(RUNS, 'release-'));
  const output = path.join(run, 'out');
  const source = path.join(run, 'source');
  for (const directory of ['data/security', 'data/security-history', 'data/company', 'assets', 'rankings']) {
    fs.mkdirSync(path.join(source, directory), { recursive: true });
  }
  fs.mkdirSync(path.join(output, 'downloads/market'), { recursive: true });
  writeJson(path.join(source, 'manifest.json'), { separatedCompanyAssets: true, historyPacks: true,
    sourcePublications: { [sourcePublication]: { asOf: day, revision } }, sample: { enabled: false }, referenceDate: day });
  writeJson(path.join(source, 'identities.json'), [{ securityId: 'SECURITY' }]);
  for (const file of ['companies.json', 'company-assets.json']) writeJson(path.join(source, file), {});
  for (const [key, content] of [[archiveKey, 'frozen archive'], [currentKey, day], [securityKey, revision]]) {
    fs.writeFileSync(path.join(source, key), gzipSync(content));
  }
  fs.writeFileSync(path.join(source, 'data/company/COMPANY.json.gz'), 'not carried');
  fs.writeFileSync(path.join(source, 'assets/historical.json'), 'not carried');
  fs.writeFileSync(path.join(source, 'rankings/rank.json'), 'not carried');
  fs.writeFileSync(path.join(output, 'index.html'), `<p>${revision}</p>`);
  fs.writeFileSync(path.join(output, 'robots.txt'), 'User-agent: *');
  fs.writeFileSync(path.join(output, 'downloads/market', day + '.csv'), `\uFEFF기준일,종목코드\n${day},005930`);
  const plan = planRelease({ candidate: output, previous: previousRelease });
  const state = { source, day, sourceCode: 'f'.repeat(64), routes: { '/': revision }, documents: { 'index.html': [] },
    buildId: 'b'.repeat(64), snapshotId: day };
  markReleaseRun(run, options.store, 'candidate', [source, output]);
  return { run, output, day, plan, state };
}

test('a full seeds portable input, no-op reads only heads, and a clean runner resumes a daily batch', async () => {
  const mock = memoryR2();
  let currentTime = Date.parse(firstDay);
  const run = (mode, folder, build, extra = {}) => deploy({ mode, store: path.join(home, folder), commit, ...extra },
    { client: mock.client, config, build, now: () => currentTime });
  const descriptor = id => mock.metadata.get(`cd-release/candidates/${id}.json`).value;
  const pointer = () => mock.metadata.get(CURRENT).value;
  const full = await run('full', 'mac', options => {
    assert.equal(options.previousRelease, null);
    return fixture(firstDay, '1000', options);
  });
  const seeded = descriptor(full.candidateId).portable;
  assert.ok(seeded.parts.length > 1);
  assert.ok(seeded.parts.every(part => part.files.every(file => !/^assets\/|^data\/company\/|^rankings\//.test(file.key))));
  const oldArchive = seeded.parts.find(part => part.files.some(file => file.key === archiveKey));
  assert.equal(mock.privateWrites.filter(key => key === oldArchive.key).length, 1);
  assert.equal(pointer().current.day, firstDay);

  mock.metadataReads.length = 0;
  const noOp = await run('daily', 'noop', options => {
    const manifest = readJson(path.join(options.previousState.source, 'manifest.json'));
    assert.equal(manifest.sourcePublications[sourcePublication].asOf, firstDay);
    assert.deepEqual(fs.readdirSync(options.previousState.source), ['manifest.json']);
    return { unchanged: true, reason: 'same-publication', day: firstDay };
  });
  assert.equal(noOp.putKeys, 0);
  assert.equal(noOp.day, firstDay);
  assert.equal(noOp.reason, 'same-publication');
  assert.deepEqual(mock.metadataReads, [CURRENT]);
  assert.deepEqual(mock.privateReads, []);

  const build = async options => {
    const { previousRelease, previousState } = await options.portable.restoreSource();
    assert.equal(previousRelease.releaseId, full.releaseId);
    assert.equal(previousState.snapshotId, firstDay);
    assert.deepEqual(previousState.documents, { 'index.html': [] });
    assert.deepEqual(fs.readFileSync(path.join(previousState.source, archiveKey)), gzipSync('frozen archive'));
    assert.deepEqual(fs.readFileSync(path.join(previousState.source, currentKey)), gzipSync(firstDay));
    assert.ok(!fs.existsSync(path.join(previousState.source, 'assets/historical.json')));
    return fixture(secondDay, '1001', options, previousRelease);
  };
  const publicWrites = mock.publicWrites.length;
  mock.failPrivate = true;
  await assert.rejects(run('daily', 'private-failure', build), /private staged PUT failed/);
  assert.equal(pointer().pending, null);
  assert.equal(mock.publicWrites.length, publicWrites);
  mock.failPrivate = false;

  mock.failPublic = 'index.html';
  await assert.rejects(run('daily', 'first-linux', build), /public staged PUT failed/);
  const interrupted = pointer().pending;
  const pending = descriptor(interrupted.id);
  assert.equal(pointer().current.candidateId, full.candidateId);
  assert.equal(interrupted.next, 1);
  assert.equal((await run('status', 'dispatch')).pendingMode, 'daily');
  assert.equal(mock.privateWrites.filter(key => key === oldArchive.key).length, 1);
  fs.rmSync(path.join(RUNS, pending.run), { recursive: true, force: true });

  mock.failPublic = null;
  mock.privateReads.length = 0;
  const second = await run('daily', 'new-linux', () => assert.fail('a pending daily should resume directly'));
  assert.equal(second.releaseId, pending.releaseId);
  assert.equal(pointer().current.day, secondDay);
  assert.equal(pointer().previous.day, firstDay);
  assert.equal(pointer().pending, null);
  assert.deepEqual(mock.privateReads, pending.portable.output[1].map(part => part.key));
  assert.ok(pending.portable.output.flat().every(part => mock.privateObjects.has(part.key)));
  assert.equal(mock.publicObjects.get('index.html'), '<p>1001</p>');
  assert.ok(mock.publicObjects.has(`downloads/market/${firstDay}.csv`));
  assert.ok(!fs.existsSync(path.join(home, 'new-linux/current.json')));

  mock.privateReads.length = 0;
  const verify = await run('verify', 'mac', options => {
    assert.equal(options.previousRelease.releaseId, second.releaseId);
    assert.equal(options.previousState, null);
    assert.equal(options.day, secondDay);
    assert.equal(options.clean, true);
    return fixture(secondDay, '1001', options);
  });
  assert.equal(verify.equal, true);
  assert.deepEqual(mock.privateReads, []);

  currentTime += 24 * 60 * 60 * 1000;
  const third = await run('daily', 'third-linux', async options => {
    const { previousRelease, previousState } = await options.portable.restoreSource();
    assert.equal(previousRelease.releaseId, second.releaseId);
    assert.equal(previousState.snapshotId, secondDay);
    assert.deepEqual(fs.readFileSync(path.join(previousState.source, currentKey)), gzipSync(secondDay));
    return fixture(thirdDay, '1002', options, previousRelease);
  });
  assert.equal(third.day, thirdDay);
  assert.equal(pointer().current.day, thirdDay);
  assert.equal(pointer().previous.day, secondDay);
  assert.equal(mock.privateWrites.filter(key => key === oldArchive.key).length, 1);
  assert.ok(pending.portable.output.flat().every(part => !mock.privateObjects.has(part.key)));
  assert.ok(pending.portable.parts.every(part => mock.privateObjects.has(part.key)));
  assert.ok(mock.privateObjects.has(oldArchive.key));
});

test('portable retention preserves an eligible review and sweeps stale private files only after grace', async () => {
  const mock = memoryR2();
  let currentTime = Date.parse(firstDay);
  const run = (mode, build, extra = {}) => deploy({ mode, store: path.join(home, 'retention'), commit, ...extra },
    { client: mock.client, config, build, now: () => currentTime });
  const clean = () => cleanPortable({ client: mock.client, bucket: config.stateBucket, readPointer: () => mock.metadata.get(CURRENT),
    parallel: (items, _limit, work) => Promise.all(items.map(work)), now: currentTime });
  const descriptor = id => mock.metadata.get(`cd-release/candidates/${id}.json`).value;
  const first = await run('full', options => fixture(firstDay, '1000', options));
  const review = await run('verify', options => fixture(firstDay, 'corrected', options));
  const currentParts = descriptor(first.candidateId).portable.parts;
  const reviewParts = descriptor(review.candidateId).portable.parts;
  const reviewOnly = reviewParts.filter(part => !currentParts.some(current => current.key === part.key));
  assert.ok(reviewOnly.length);
  const orphan = `cd-release/portable/source/release-orphan/${'0'.repeat(64)}.gz`;
  const unrelated = `cd-release/unrelated/${'0'.repeat(64)}.gz`;
  mock.privateObjects.set(orphan, Buffer.from('interrupted stage'));
  mock.privateObjects.set(unrelated, Buffer.from('private R2 data outside release transport'));
  await clean();
  assert.ok(mock.privateObjects.has(orphan));

  currentTime += (13 * 60 * 60 * 1000);
  await clean();
  assert.ok(!mock.privateObjects.has(orphan));
  assert.ok(mock.privateObjects.has(unrelated));
  assert.ok(reviewOnly.every(part => mock.privateObjects.has(part.key)));

  const second = await run('full', options => fixture(secondDay, '1001', options));
  currentTime += (13 * 60 * 60 * 1000);
  await clean();
  assert.ok(reviewOnly.every(part => !mock.privateObjects.has(part.key)));
  assert.ok(currentParts.every(part => mock.privateObjects.has(part.key)));
  assert.ok(descriptor(second.candidateId).portable.parts.every(part => mock.privateObjects.has(part.key)));
  assert.ok(mock.metadata.has(`cd-release/candidates/${review.candidateId}.json`));
});

test('a year rollover publishes raw HTML from compressed staging and retains exact public headers across resume', async () => {
  const mock = memoryR2();
  const yearEnd = '2026-12-30', newYear = '2027-01-04';
  const run = (mode, build) => deploy({ mode, store: path.join(home, 'year-rollover'), commit }, { client: mock.client, config, build });
  const pointer = () => mock.metadata.get(CURRENT).value;
  const full = await run('full', options => fixture(yearEnd, '1000', options));
  const baseline = mock.metadata.get(`cd-release/candidates/${full.candidateId}.json`).value.portable;
  const originalArchive = baseline.parts.find(part => part.files.some(file => file.key === archiveKey));
  let staged;
  const build = corrupt => async options => {
    const { previousRelease } = await options.portable.restoreSource();
    staged = fixture(newYear, '1001', options, previousRelease);
    const index = path.join(staged.output, 'index.html');
    const raw = fs.readFileSync(index);
    const file = path.join(staged.run, 'compressed-html', 'index.html.gz');
    fs.mkdirSync(path.dirname(file));
    fs.writeFileSync(file, gzipSync(corrupt ? 'unplanned body' : raw));
    fs.rmSync(index);
    staged.compressedHtml = new Map([['index.html', { file, bytes: raw.length, sha256: sha256(raw), dependencies: [] }]]);
    return staged;
  };

  const publicWrites = mock.publicWrites.length;
  await assert.rejects(run('daily', build(true)), /candidate file changed while building its private bundle/);
  assert.equal(pointer().pending, null);
  assert.equal(mock.publicWrites.length, publicWrites);

  mock.failPublic = 'index.html';
  await assert.rejects(run('daily', build(false)), /public staged PUT failed/);
  assert.equal(pointer().current.releaseId, full.releaseId);
  assert.equal(pointer().pending.next, 1);
  assert.equal(fs.existsSync(staged.output), true);
  assert.equal(fs.existsSync(path.join(staged.output, 'index.html')), false);
  mock.failPublic = null;
  mock.privateReads.length = 0;

  const completed = await run('resume', () => assert.fail('rollover resumes without rebuilding'));
  const pending = mock.metadata.get(`cd-release/candidates/${completed.candidateId}.json`).value;
  assert.deepEqual(mock.privateReads, pending.portable.output[1].map(part => part.key));
  assert.ok(pending.portable.parts.some(part => part.key === originalArchive.key));
  assert.equal(mock.privateWrites.filter(key => key === originalArchive.key).length, 1);
  assert.equal(completed.day, newYear);
  assert.equal(mock.publicObjects.get('index.html'), '<p>1001</p>');
  assert.deepEqual(mock.publicHeaders.get('index.html'), {
    'cache-control': 'public, max-age=0, must-revalidate', 'content-type': 'text/html; charset=utf-8',
  });
  assert.ok(mock.publicObjects.has(`downloads/market/${yearEnd}.csv`));
  assert.equal(pointer().pending, null);
});

test('signed portable bundle traffic stays private and rejects altered downloads', async () => {
  const bytes = gzipSync('private fixture');
  const digest = sha256(bytes);
  const key = 'cd-release/portable/source/' + digest + '.gz';
  const object = { key, sha256: digest, bytes: bytes.length };
  const scratch = fs.mkdtempSync(path.join(home, 'signed-'));
  const file = path.join(scratch, 'source.gz');
  fs.writeFileSync(file, bytes);
  let corrupted = false;
  const client = createR2Client({ ...config, endpoint: new URL('https://r2.example.test'), accessKey: 'access', secret: 'secret' }, {
    async request(url, options) {
      assert.match(options.headers.authorization, /^AWS4-HMAC-SHA256 /);
      if (url.searchParams.has('prefix')) {
        assert.equal(url.pathname, `/${config.stateBucket}`);
        assert.equal(url.searchParams.get('prefix'), 'cd-release/portable/');
        assert.equal(url.searchParams.get('encoding-type'), 'url');
        if (!url.searchParams.has('continuation-token')) {
          return new Response(`<ListBucketResult><Contents><Key>${encodeURIComponent(key)}</Key></Contents><IsTruncated>true</IsTruncated>`
            + '<NextContinuationToken>x&amp;y</NextContinuationToken></ListBucketResult>');
        }
        assert.equal(url.searchParams.get('continuation-token'), 'x&y');
        return new Response('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
      }
      assert.equal(url.pathname, `/${config.stateBucket}/${key}`);
      if (options.method === 'PUT') {
        assert.equal(options.headers['content-type'], 'application/gzip');
        assert.equal(options.headers['cache-control'], 'no-store');
        assert.equal(options.headers['if-none-match'], '*');
        assert.equal(options.headers['x-amz-content-sha256'], digest);
        const input = [];
        for await (const chunk of options.body) input.push(chunk);
        assert.deepEqual(Buffer.concat(input), bytes);
        return new Response(null, { status: 412 });
      }
      return new Response(corrupted ? Buffer.alloc(bytes.length) : bytes);
    },
  });
  await client.putPrivateObject(object, file);
  const received = path.join(scratch, 'received.gz');
  await client.getPrivateObject(object, received);
  assert.deepEqual(fs.readFileSync(received), bytes);
  const keys = [];
  for await (const listed of client.listPortableKeys()) keys.push(listed);
  assert.deepEqual(keys, [key]);
  corrupted = true;
  await assert.rejects(client.getPrivateObject(object, path.join(scratch, 'corrupt.gz')), /digest mismatch/);
});
