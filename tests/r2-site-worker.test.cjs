const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const worker = import('../workers/r2-site.mjs').then(module => module.default);
const host = 'https://cd4.example.workers.dev';
const per = 'security/KOSPI.005930/per/index.html';
const csv = 'downloads/market/2026-10-08.csv';
const chunk = '_next/static/chunks/app/security/[secCode]/per/page-8af8a31ea6.js';
const pack = 'static-data/shared/24/2400872f0ac2098651aa.json';
const tag = '"object-etag"';

function fixture() {
  const objects = new Map([
    ['index.html', ['root', { 'content-type': 'text/html; charset=utf-8' }]],
    [per, ['PER', { 'cache-control': 'public, max-age=0, must-revalidate' }]],
    ['security/NYSE.BRK.B/per/index.html', ['PER', {}]],
    [chunk, ['script', {}]],
    [pack, ['[]', {}]],
    [csv, ['\uFEFFheader\nrow', {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="market-2026-10-08.csv"',
    }, { 'market-reference-date': '2026-10-08', 'market-row-count': '1', private: 'hidden' }]],
    ['sitemaps/core-0/sitemap.xml', ['<urlset/>', {}]],
    ['search-data.json', ['[]', {}]],
    ['security/005930/per/index.html', ['legacy alias', {}]],
    ['_benchmarks/benchmark.json', ['private', {}]],
  ]);
  const requests = [];
  function read(operation, key, condition) {
    requests.push({ operation, key, condition });
    const record = objects.get(key);
    if (!record) return null;
    const [text, metadata, customMetadata] = record;
    const bytes = new TextEncoder().encode(text);
    const object = { httpEtag: tag, size: bytes.length, customMetadata,
      writeHttpMetadata(headers) { for (const [name, value] of Object.entries(metadata)) headers.set(name, value); } };
    if (operation === 'get' && condition !== '*' && !condition?.split(',').some(value => value.trim().replace(/^W\//, '') === tag)) {
      object.body = new Response(bytes).body;
    }
    return object;
  }
  const env = { CD_STATIC: {
    head: async key => read('head', key),
    get: async (key, opts) => read('get', key, opts?.onlyIf?.get('if-none-match') ?? undefined),
  } };
  return { requests, async request(route, init) { return (await worker).fetch(new Request(host + route, init), env); } };
}

test('Workers Builds configuration binds only the public R2 bucket and keeps workers.dev enabled', () => {
  const root = path.join(__dirname, '..');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8'));
  assert.equal(config.name, 'cd4');
  assert.equal(config.workers_dev, true);
  assert.deepEqual(config.r2_buckets, [{ binding: 'CD_STATIC', bucket_name: 'cd-static' }]);
  assert.equal(config.assets, undefined);
  assert.equal(config.routes, undefined);
  assert.ok(fs.existsSync(path.join(root, config.main)));
});

test('canonical pages stream the precise index key and redirects preserve the original query', async () => {
  const { request, requests } = fixture();
  assert.equal(await (await request('/')).text(), 'root');
  const canonical = await request('/security/KOSPI.005930/per/?period=listing');
  assert.equal(canonical.status, 200);
  assert.equal(await canonical.text(), 'PER');
  assert.equal(canonical.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(canonical.headers.get('etag'), tag);
  const redirect = await request('/security/KOSPI.005930/per?period=listing%2B1&review=1');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), '/security/KOSPI.005930/per/?period=listing%2B1&review=1');
  assert.deepEqual(requests.map(({ operation, key }) => [operation, key]), [['get','index.html'], ['get',per], ['head',per]]);
  assert.equal((await request('/security/NYSE.BRK.B/per/')).status, 200);
});

test('allowlisted JSON, dated CSV, sitemap and encoded chunk paths resolve to exact keys and headers', async () => {
  const { request, requests } = fixture();
  for (const [key, type] of [
    [pack, 'application/json; charset=utf-8'], ['search-data.json', 'application/json; charset=utf-8'],
    [csv, 'text/csv; charset=utf-8'], ['sitemaps/core-0/sitemap.xml', 'application/xml; charset=utf-8'],
    [chunk, 'text/javascript; charset=utf-8'],
  ]) {
    const encoded = key.replace('[secCode]', '%5BsecCode%5D');
    const result = await request('/' + encoded + '?v=1');
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('content-type'), type);
    assert.equal(requests.at(-1).key, key);
    assert.equal(result.headers.get('cache-control'), key === pack || key === chunk
      ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate');
    if (key === csv) {
      assert.equal(result.headers.get('content-disposition'), 'attachment; filename="market-2026-10-08.csv"');
      assert.equal(result.headers.get('x-market-reference-date'), '2026-10-08');
      assert.equal(result.headers.get('x-market-row-count'), '1');
      assert.equal(result.headers.get('x-private'), null);
      assert.deepEqual([...new Uint8Array(await result.arrayBuffer()).slice(0, 3)], [239, 187, 191]);
    }
  }
});

test('GET and HEAD validators provide bodyless 304 with metadata and no reads for non-GET/HEAD', async () => {
  const { request, requests } = fixture();
  const head = await request('/' + csv, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  assert.equal(requests.at(-1).operation, 'head');
  assert.equal(head.headers.get('etag'), tag);
  for (const method of ['GET', 'HEAD']) {
    const condition = '"different", W/' + tag;
    const response = await request('/' + pack, { method, headers: { 'If-None-Match': condition } });
    assert.equal(response.status, 304);
    assert.equal(response.headers.get('etag'), tag);
    assert.equal(response.headers.get('content-length'), null);
    assert.equal(await response.text(), '');
    assert.equal(requests.at(-1).operation, method === 'HEAD' ? 'head' : 'get');
    assert.equal(requests.at(-1).condition, method === 'HEAD' ? undefined : condition);
  }
  assert.equal((await request('/' + pack, { headers: { 'If-None-Match': '*' } })).status, 304);
  assert.equal((await request('/' + pack, { headers: { 'If-None-Match': '"stale"' } })).status, 200);
  const before = requests.length;
  const blocked = await request('/', { method: 'POST' });
  assert.equal(blocked.status, 405);
  assert.equal(blocked.headers.get('allow'), 'GET, HEAD');
  assert.equal(requests.length, before);
});

test('missing canonical paths do not redirect and aliases, private namespaces, and encoded bypasses do not read R2', async () => {
  const { request, requests } = fixture();
  const missing = await request('/security/KOSDAQ.123456/per?period=missing');
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('location'), null);
  assert.equal(missing.headers.get('cache-control'), 'no-store');
  assert.equal(requests.length, 1);
  for (const route of [
    '/security/005930/per/', '/_benchmarks/benchmark.json', '/%5fbenchmarks/benchmark.json',
    '/data/security/test.json', '/_static-build.json', '/current.json', '/releases/test.json',
    '/_next/server/private.js', '/_next/static/chunks/_private/test.js', '/_next/static/chunks/secret.js.map',
    '/%2f_next/static/test.js', '/%255fbenchmarks/benchmark.json', '/_next/static/%5cfile.js',
    '/_next/static/%00file.js', '/_next/static//file.js', '/static-data/shared/00/secret.json',
  ]) assert.equal((await request(route)).status, 404, route);
  assert.equal(requests.length, 1);
});
