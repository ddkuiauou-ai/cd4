const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createStaticAssetWriter } = require('../scripts/static-asset-writer.cjs');
const { migrateStaticAssets } = require('../scripts/migrate-static-assets.cjs');
const { cacheHeaders } = require('../scripts/finalize-static.cjs');
const { headerRules } = require('../scripts/preview-static.cjs');

const digest = data => crypto.createHash('sha256').update(data).digest('hex');
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cd4-static-assets-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('identical JSON bytes share one URL and manifest entry across writers and call order', t => {
  const directory = fixture(t);
  const value = { columns: ['date', 'marketcap'], rows: [['2026-10-08', '9007199254740993'], ['2026-10-09', null]] };
  const serialized = JSON.stringify(value);
  const first = createStaticAssetWriter(directory);
  const url = first.write(value);
  assert.equal(first.writeBytes(Buffer.from(serialized)), url);
  assert.equal(first.write(serialized), url);
  assert.equal(first.assets.length, 1);
  assert.deepEqual(first.assets[0], { path: url.slice(1), bytes: Buffer.byteLength(serialized), sha256: digest(serialized) });
  assert.deepEqual(fs.readFileSync(path.join(directory, url)), Buffer.from(serialized));
  assert.match(url, /^\/static-data\/shared\/[a-f0-9]{2}\/[a-f0-9]{20}\.json$/);
  const later = createStaticAssetWriter(directory);
  later.write({ different: true });
  assert.equal(later.write(value), url);
  assert.equal(later.assets.length, 2);
  assert.notEqual(first.write(`${serialized}\n`), url, 'even one extra byte changes the address');
});

test('JSON and CSV keep distinct namespaces while CSV BOM, CRLF, nulls and UTF-8 bytes remain exact', t => {
  const directory = fixture(t);
  const writer = createStaticAssetWriter(directory);
  const body = '\uFEFFdate,name,value\r\n2026-10-08,삼성,\r\n';
  const json = writer.write(body, 'json');
  const csv = writer.write(body, 'csv');
  assert.notEqual(json, csv);
  assert.match(csv, /^\/static-data\/ranking\/shared\/[a-f0-9]{2}\/[a-f0-9]{20}\.csv$/);
  assert.equal(writer.writeBytes(Buffer.from(body), 'csv'), csv);
  assert.equal(writer.assets.length, 2);
  assert.equal(writer.assets[0].sha256, writer.assets[1].sha256);
  assert.deepEqual(fs.readFileSync(path.join(directory, csv)), Buffer.from(body));
  fs.writeFileSync(path.join(directory, '_headers'), cacheHeaders(directory));
  const matching = headerRules(directory).filter(rule => rule.match.test(csv));
  assert.equal(matching.filter(rule => rule.values['cache-control']).length, 1);
  assert.equal(matching.find(rule => rule.values['content-type']).values['content-type'], 'text/csv; charset=utf-8');
  assert.equal(matching.find(rule => rule.values['content-disposition']).values['content-disposition'], 'attachment');
  assert.throws(() => writer.write(body, '../csv'), /Unsupported/);
});

test('truncated hash collisions and existing-file corruption cannot overwrite an asset', t => {
  const directory = fixture(t);
  const writer = createStaticAssetWriter(directory, { hashLength: 2 });
  const prefixes = new Map();
  let collision;
  for (let index = 0; !collision; index++) {
    const value = `payload-${index}`;
    const prefix = digest(value).slice(0, 2);
    if (prefixes.has(prefix)) collision = [prefixes.get(prefix), value];
    else prefixes.set(prefix, value);
  }
  const url = writer.write(collision[0]);
  assert.notEqual(digest(collision[0]), digest(collision[1]));
  assert.throws(() => writer.write(collision[1]), /hash collision/);
  assert.throws(() => createStaticAssetWriter(directory, { hashLength: 2 }).write(collision[1]), /hash collision/);
  assert.equal(fs.readFileSync(path.join(directory, url), 'utf8'), collision[0]);
  assert.equal(writer.assets.length, 1);
  fs.writeFileSync(path.join(directory, url), 'changed');
  assert.throws(() => writer.write(collision[0]), /changed content/);
});

test('offline migration rewrites all shared refs, deduplicates only identical bytes and preserves snapshot/financial/CSV metadata', t => {
  const directory = fixture(t);
  const body = JSON.stringify({ schemaVersion: 1, columns: ['date', 'pbr', 'pbrState'], rows: [['2026-10-08', '9007199254740993.125', 'provided'], ['2026-10-09', null, 'source_missing']] });
  const csv = '\uFEFFdate,pbr\r\n2026-10-08,9007199254740993.125\r\n';
  const definitions = [['static-data/security/A/pbr.old.json', body], ['static-data/security/B/pbr.old.json', body],
    ['static-data/security/C/pbr.old.json', `${body}\n`], ['static-data/ranking/security/per.old.csv', csv]];
  const write = (relative, value) => {
    const file = path.join(directory, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
  };
  const assets = definitions.map(([relative, data]) => {
    write(`assets/${relative}`, data);
    return { path: relative, bytes: Buffer.byteLength(data), sha256: digest(data) };
  });
  const metadata = { generatedAt: '2026-10-09T00:00:00.000Z', revision: '9007199254740993', totalCount: 0, filename: 'exact.csv' };
  const source = { state: 'published', value: '9007199254740993.125', observedAt: '2026-10-08', missing: null };
  write('data/security/A.json', { security: source, assets: { primary: `/${assets[0].path}`, secondary: `/${assets[1].path}` } });
  write('data/company/C.json', { company: source, assets: { members: { A: `/${assets[0].path}` } } });
  write('rankings/security-per.json', { scopes: { 'krx-all': { csv: { url: `/${assets[3].path}`, metadata } } } });
  const manifest = { version: 1, snapshotId: 'same-financial-snapshot', generatedAt: metadata.generatedAt,
    sourcePublications: { 'security_latest/krx-all': { asOf: source.observedAt, revision: metadata.revision } }, assets, routes: [{ path: '/' }] };
  write('manifest.json', manifest);
  const report = migrateStaticAssets({ stage: directory });
  assert.equal(report.success, true);
  assert.equal(report.before.files, 4);
  assert.equal(report.after.files, 3);
  assert.equal(report.savedBytes, Buffer.byteLength(body));
  assert.equal(report.byteExactPayloads, true);
  const next = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json')));
  assert.equal(next.snapshotId, manifest.snapshotId);
  assert.deepEqual({ ...next, assets: manifest.assets }, manifest);
  const detail = JSON.parse(fs.readFileSync(path.join(directory, 'data/security/A.json')));
  assert.deepEqual(detail.security, source);
  assert.equal(detail.assets.primary, detail.assets.secondary);
  assert.deepEqual(fs.readFileSync(path.join(directory, 'assets', detail.assets.primary)), Buffer.from(body));
  const ranking = JSON.parse(fs.readFileSync(path.join(directory, 'rankings/security-per.json')));
  assert.deepEqual(ranking.scopes['krx-all'].csv.metadata, metadata);
  assert.deepEqual(fs.readFileSync(path.join(directory, 'assets', ranking.scopes['krx-all'].csv.url)), Buffer.from(csv));
  assert.equal(fs.existsSync(path.join(directory, 'assets', assets[0].path)), false);
  assert.equal(new Set(next.assets.map(asset => asset.path)).size, 3);
  const repeated = migrateStaticAssets({ stage: directory });
  assert.equal(repeated.savedBytes, 0);
  assert.equal(repeated.rewrittenInputFiles.length, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'))), next);
});

test('offline migration rejects corrupt input before changing any source path', t => {
  const directory = fixture(t);
  const relative = 'static-data/security/A/prices.old.json';
  fs.mkdirSync(path.join(directory, 'assets', path.dirname(relative)), { recursive: true });
  fs.writeFileSync(path.join(directory, 'assets', relative), 'corrupt');
  const manifest = JSON.stringify({ snapshotId: 'unchanged', assets: [{ path: relative, bytes: 2, sha256: digest('{}') }] });
  fs.writeFileSync(path.join(directory, 'manifest.json'), manifest);
  assert.throws(() => migrateStaticAssets({ stage: directory }), /Original asset changed/);
  assert.equal(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'), manifest);
  assert.equal(fs.readFileSync(path.join(directory, 'assets', relative), 'utf8'), 'corrupt');
  assert.deepEqual(fs.readdirSync(directory).sort(), ['assets', 'manifest.json']);
});
