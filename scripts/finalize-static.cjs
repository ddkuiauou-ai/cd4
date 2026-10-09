const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { STAGE, OUT, MARKER, readManifest, relativeFile, outputFileForRoute, filesBelow, sha256, writeJson } = require('./static-tools.cjs');

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function aliasHtml(target) {
  const literal = JSON.stringify(target).replace(/</g, '\\u003c');
  const escaped = escapeHtml(target);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${escaped}"><script>location.replace(${literal}+location.search+location.hash)</script><meta http-equiv="refresh" content="0;url=${escaped}"><title>페이지 이동</title></head><body><a href="${escaped}">페이지 이동</a></body></html>\n`;
}

function cacheHeaders(output) {
  const mutable = new Set(['/', `/${MARKER}`]);
  for (const entry of fs.readdirSync(output, { withFileTypes: true })) {
    if (['static-data', '_next', '_headers'].includes(entry.name)) continue;
    mutable.add(`/${entry.name}`);
    if (entry.isDirectory()) mutable.add(`/${entry.name}/*`);
  }
  const lines = [...mutable].sort().flatMap(pattern => [pattern, '  Cache-Control: public, max-age=0, must-revalidate']);
  const rscPatterns = new Set();
  for (const file of filesBelow(output)) {
    if (!file.endsWith('.txt') || !(path.posix.basename(file) === 'index.txt' || path.posix.basename(file).startsWith('__next'))) continue;
    rscPatterns.add(file.includes('/') ? `/${file.split('/')[0]}/*.txt` : `/${file}`);
  }
  return [...lines,
    '/_next/static/*', '  Cache-Control: public, max-age=31536000, immutable',
    '/static-data/*', '  Cache-Control: public, max-age=31536000, immutable', '',
    ...[...rscPatterns].sort().flatMap(pattern => [pattern, '  Content-Type: text/x-component; charset=utf-8']),
    '/ranking-data/*.csv', '  Content-Type: text/csv; charset=utf-8', '  Content-Disposition: attachment',
    '/static-data/ranking/*.csv', '  Content-Type: text/csv; charset=utf-8', '  Content-Disposition: attachment', '',
  ].join('\n');
}

function recordEmittedFiles({ output = OUT, manifest, inventoryDirectory = path.join(STAGE, 'emitted'), excludeFinalized = false } = {}) {
  const additions = new Set([MARKER, '_headers', ...(manifest.assets ?? []).map(asset => asset.path),
    ...(manifest.aliases ?? []).map(alias => outputFileForRoute(alias.path))]);
  const inventory = { version: 1, snapshotId: manifest.snapshotId,
    files: filesBelow(output).filter(file => !excludeFinalized || !additions.has(file)).map(file => ({
      path: file, bytes: fs.statSync(path.join(output, file)).size, sha256: sha256(path.join(output, file)),
    })) };
  const id = crypto.createHash('sha256').update(JSON.stringify(inventory)).digest('hex');
  writeJson(path.join(inventoryDirectory, `${id}.json`), inventory);
  return { id, files: inventory.files.length };
}

function finalize({ allowSample = false, output = OUT, manifestPath, stagedAssets = path.join(STAGE, 'assets'), inventoryDirectory } = {}) {
  const manifest = readManifest({ allowSample, filename: manifestPath });
  if (!fs.existsSync(path.join(output, 'index.html'))) throw new Error('Static export has not created out/index.html');
  const emitted = recordEmittedFiles({ output, manifest, inventoryDirectory });
  for (const asset of manifest.assets) {
    const source = path.join(stagedAssets, relativeFile(asset.path));
    if (fs.statSync(source).size !== asset.bytes || sha256(source) !== asset.sha256) throw new Error(`Staged asset changed: ${asset.path}`);
    const target = path.join(output, asset.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  for (const alias of manifest.aliases ?? []) {
    const target = path.join(output, outputFileForRoute(alias.path));
    if (fs.existsSync(target)) throw new Error(`Alias would overwrite output: ${alias.path}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, aliasHtml(alias.target));
  }
  fs.writeFileSync(path.join(output, '_headers'), cacheHeaders(output));
  writeJson(path.join(output, MARKER), { version: 1, snapshotId: manifest.snapshotId,
    generatedAt: manifest.generatedAt, sample: manifest.sample, routeCount: manifest.routes.length,
    aliases: manifest.aliases?.length ?? 0, emittedInventoryId: emitted.id });
  return manifest;
}

if (require.main === module) {
  try { const manifest = finalize({ allowSample: process.argv.includes('--allow-sample') }); console.log(`Finalized ${manifest.routes.length} pages (${manifest.sample.enabled ? 'SAMPLE' : 'FULL'})`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { finalize, aliasHtml, cacheHeaders, recordEmittedFiles };
