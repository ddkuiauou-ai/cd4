const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { ROOT, OUT, STAGE, MARKER, readManifest, readJson, writeJson, routePath, outputFileForRoute,
  filesBelow, sha256, measureOutput, familyForRoute } = require('./static-tools.cjs');
const { createStaticServer } = require('./preview-static.cjs');

function directoryFileCounts(files, limit = 54000) {
  const counts = new Map();
  for (const file of files) {
    const directory = path.posix.dirname(file);
    counts.set(directory, (counts.get(directory) || 0) + 1);
  }
  let maximum = { directory: '.', files: 0 };
  for (const [directory, count] of counts) {
    if (count > limit) throw new Error(`Netlify directory file limit exceeded: ${directory} has ${count} direct files (limit ${limit})`);
    if (count > maximum.files) maximum = { directory, files: count };
  }
  return { limit, totalFiles: files.length, directories: counts.size, maximum };
}

const rankingPageOne = /^\/(?:marketcap|per|pbr|bps|eps|div|dps|marketcaps)\/1\/?$/;
const decodeEntities = value => value.replace(/&(?:amp|quot|apos|lt|gt);/g, token => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' }[token]));
function canonicalPath(value) {
  const route = routePath(value);
  const normalized = route.endsWith('/') ? route : `${route}/`;
  if (normalized === '/marketcaps/' || normalized === '/marketcaps/1/') return '/';
  return rankingPageOne.test(normalized) ? normalized.replace(/1\/$/, '') : normalized;
}
function configuredOrigin() {
  const source = fs.readFileSync(path.join(ROOT, 'config/site.ts'), 'utf8');
  const value = source.match(/\burl:\s*["']([^"']+)["']/)?.[1];
  if (!value) throw new Error('Specify the static site origin in manifest.siteOrigin or config/site.ts');
  return new URL(value).origin;
}
function checkCanonical(html, expected, origin, file) {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0]).filter(tag => /\brel=["']canonical["']/i.test(tag));
  const href = links[0]?.match(/\bhref=["']([^"']+)["']/i)?.[1];
  if (links.length !== 1 || !href) throw new Error(`Missing or duplicate canonical: ${file}`);
  const url = new URL(decodeEntities(href), origin);
  const actualPath = routePath(url.pathname);
  if (url.origin !== origin || url.search || url.hash || actualPath !== canonicalPath(expected)) throw new Error(`Incorrect canonical for ${file}: ${href}`);
}
function sitemapInventory(output, files, manifest, origin) {
  const rootFile = path.join(output, 'sitemap.xml');
  if (!fs.existsSync(rootFile)) throw new Error('Missing sitemap.xml');
  const locations = xml => [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(match => decodeEntities(match[1]));
  const checkedUrl = value => {
    const url = new URL(value);
    if (url.origin !== origin || url.search || url.hash) throw new Error(`Invalid sitemap URL: ${value}`);
    return url;
  };
  const root = fs.readFileSync(rootFile, 'utf8');
  let entries, chunks = [];
  if (/<sitemapindex[\s>]/.test(root)) {
    chunks = locations(root).map(value => routePath(checkedUrl(value).pathname).slice(1));
    if (!chunks.length) throw new Error('Sitemap index has no chunks');
    const actualChunks = files.filter(file => file.startsWith('sitemaps/') && file.endsWith('.xml'));
    if (new Set(chunks).size !== chunks.length || actualChunks.some(file => !chunks.includes(file))) throw new Error('Sitemap chunk inventory mismatch');
    entries = chunks.flatMap(file => {
      if (!files.includes(file)) throw new Error(`Missing sitemap chunk: ${file}`);
      return locations(fs.readFileSync(path.join(output, file), 'utf8'));
    });
  } else entries = locations(root);
  const actual = new Set(entries.map(value => canonicalPath(checkedUrl(value).pathname)));
  const expected = new Set(manifest.routes.map(route => canonicalPath(route.path)));
  const missing = [...expected].filter(value => !actual.has(value)), extra = [...actual].filter(value => !expected.has(value));
  if (actual.size !== entries.length || missing.length || extra.length) throw new Error(`Sitemap URL inventory mismatch: missing ${missing.length} [${missing.slice(0, 10)}]; extra ${extra.length} [${extra.slice(0, 10)}]; duplicates ${entries.length - actual.size}`);
  return { chunks: chunks.length, canonicalUrls: actual.size,
    canonicalRules: '/metric/1/ uses /metric/; /marketcaps/ and /marketcaps/1/ use /; aliases are omitted' };
}

function compressionSamples(manifest, output) {
  const selected = new Map();
  for (const route of manifest.routes) {
    const family = familyForRoute(route.path);
    if (!selected.has(family)) selected.set(family, route.path);
  }
  return [...selected].map(([family, route]) => {
    const bytes = fs.readFileSync(path.join(output, outputFileForRoute(route)));
    return { family, route, rawBytes: bytes.length, gzipBytes: zlib.gzipSync(bytes).length,
      brotliBytes: zlib.brotliCompressSync(bytes, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }).length };
  });
}

async function verifyStatic({ allowSample = false, output = OUT, manifestPath, httpAll = true, compression = false, publicDirectory = path.join(ROOT, 'public'), inventoryDirectory = path.join(STAGE, 'emitted'), siteOrigin } = {}) {
  const started = performance.now();
  const manifest = readManifest({ allowSample, filename: manifestPath });
  const marker = readJson(path.join(output, MARKER));
  if (marker.version !== 1 || marker.snapshotId !== manifest.snapshotId || marker.sample.enabled !== manifest.sample.enabled
    || marker.routeCount !== manifest.routes.length) throw new Error('Output belongs to a different or incomplete static snapshot');
  const files = filesBelow(output);
  const directoryFiles = directoryFileCounts(files);
  const fileSet = new Set(files);
  if (!/^[a-f0-9]{64}$/.test(marker.emittedInventoryId || '')) throw new Error('Missing original Next output inventory; finalize this export before verification');
  const inventory = readJson(path.join(inventoryDirectory, `${marker.emittedInventoryId}.json`));
  if (inventory.version !== 1 || inventory.snapshotId !== manifest.snapshotId || !Array.isArray(inventory.files)
    || crypto.createHash('sha256').update(JSON.stringify(inventory)).digest('hex') !== marker.emittedInventoryId) throw new Error('Original Next output inventory changed');
  for (const emitted of inventory.files) {
    const filename = path.join(output, emitted.path);
    if (!fileSet.has(emitted.path) || fs.statSync(filename).size !== emitted.bytes || sha256(filename) !== emitted.sha256) throw new Error(`Missing or modified original Next file: ${emitted.path}`);
  }
  const pages = [...manifest.routes, ...(manifest.aliases ?? []).map(alias => ({ ...alias, kind: 'alias' }))];
  const expectedHtml = new Set(pages.map(route => outputFileForRoute(route.path)));
  const frameworkHtml = new Set(['404.html', '404/index.html', '_not-found/index.html', '_not-found.html']);
  const missing = [...expectedHtml].filter(file => !fileSet.has(file));
  const publicHtml = new Set(filesBelow(publicDirectory).filter(file => file.endsWith('.html')));
  const extra = files.filter(file => file.endsWith('.html') && !expectedHtml.has(file) && !frameworkHtml.has(file)
    && !(publicHtml.has(file) && sha256(path.join(output, file)) === sha256(path.join(publicDirectory, file))));
  if (missing.length || extra.length) throw new Error(`HTML inventory mismatch: missing ${missing.length} [${missing.slice(0, 10)}]; extra ${extra.length} [${extra.slice(0, 10)}]`);
  for (const route of manifest.routes) {
    const fullRsc = outputFileForRoute(route.path).replace(/\.html$/, '.txt');
    if (!fileSet.has(fullRsc)) throw new Error(`Missing full RSC file: ${fullRsc}`);
  }
  const assetSet = new Set();
  for (const asset of manifest.assets) {
    if (assetSet.has(asset.path)) throw new Error(`Duplicate asset: ${asset.path}`);
    assetSet.add(asset.path);
    const filename = path.join(output, asset.path);
    if (!fileSet.has(asset.path) || fs.statSync(filename).size !== asset.bytes || sha256(filename) !== asset.sha256) {
      throw new Error(`Missing, stale or corrupt shared asset: ${asset.path}`);
    }
  }
  const extraData = files.filter(file => file.startsWith('static-data/') && !assetSet.has(file));
  if (extraData.length) throw new Error(`Unexpected shared data files: ${extraData.slice(0, 10).join(', ')}`);
  for (const file of manifest.requiredFiles ?? []) if (!fileSet.has(file)) throw new Error(`Missing required static file: ${file}`);
  const canonical = new Set(manifest.routes.map(route => routePath(route.path)));
  for (const alias of manifest.aliases ?? []) if (!canonical.has(routePath(alias.target))) throw new Error(`Alias target is not a generated page: ${alias.target}`);
  // Inspect emitted HTML, while keeping only one page body in memory.
  const referencedFiles = new Set();
  const origin = new URL(siteOrigin || manifest.siteOrigin || configuredOrigin()).origin;
  const expectedByHtml = new Map(pages.map(route => [outputFileForRoute(route.path), route.target || route.path]));
  const references = text => { for (const match of text.matchAll(/\/static-data\/[A-Za-z0-9._~!$&()*+,;=:@%/-]+?\.(?:json|csv)/g)) referencedFiles.add(decodeURIComponent(match[0].slice(1))); };
  for (const file of expectedHtml) {
    const html = fs.readFileSync(path.join(output, file), 'utf8');
    if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) throw new Error(`Truncated HTML: ${file}`);
    checkCanonical(html, expectedByHtml.get(file), origin, file);
    references(html);
    for (const match of html.matchAll(/(?:href|src)="(\/(?:_next\/static|static-data)\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
      referencedFiles.add(decodeURIComponent(match[1].slice(1).replace(/&amp;/g, '&')));
    }
  }
  for (const file of files) if (file.endsWith('.json') || file.endsWith('.txt') && (path.posix.basename(file) === 'index.txt' || path.posix.basename(file).startsWith('__next'))) references(fs.readFileSync(path.join(output, file), 'utf8'));
  for (const file of referencedFiles) if (!fileSet.has(file)) throw new Error(`HTML references an absent asset: ${file}`);
  const sitemap = sitemapInventory(output, files, manifest, origin);
  const server = createStaticServer({ output });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  let checkedUrls = 0;
  try {
    const requested = httpAll ? pages : pages.filter((route, index) => index < 2 || !pages.slice(0, index).some(prior => familyForRoute(prior.path) === familyForRoute(route.path)));
    for (let offset = 0; offset < requested.length; offset += 24) {
      await Promise.all(requested.slice(offset, offset + 24).map(async route => {
        const response = await fetch(new URL(route.path, base), { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(15000) });
        if (response.status !== 200 || !response.headers.get('content-type')?.startsWith('text/html')) throw new Error(`Static URL failed: ${route.path} (${response.status})`);
        checkedUrls++;
      }));
    }
    for (const file of [MARKER, 'index.txt', ...(manifest.requiredFiles ?? []), ...manifest.assets.slice(0, 2).map(asset => asset.path)]) {
      const response = await fetch(`${base}/${file}`, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
      if (response.status !== 200) throw new Error(`Static file failed over HTTP: ${file} (${response.status})`);
      if (file.startsWith('static-data/') && !response.headers.get('cache-control')?.includes('immutable')) throw new Error(`Shared asset is not immutable: ${file}`);
      if (file === 'index.txt' && !response.headers.get('content-type')?.startsWith('text/x-component')) throw new Error('RSC preview MIME type is incorrect');
    }
    const absent = await fetch(`${base}/__static_verification_missing__/${manifest.snapshotId}/`, { signal: AbortSignal.timeout(15000) });
    if (absent.status !== 404) throw new Error('Static server uses an invalid SPA fallback');
    await absent.arrayBuffer();
    const slashRoute = manifest.routes.find(route => route.path !== '/');
    if (slashRoute) {
      const response = await fetch(`${base}${slashRoute.path.slice(0, -1)}?check=1`, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(15000) });
      if (response.status !== 308 || response.headers.get('location') !== `${slashRoute.path}?check=1`) throw new Error('Trailing slash redirect lost its query string');
    }
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  return { version: 1, success: true, snapshotId: manifest.snapshotId, sample: manifest.sample,
    canonicalPages: manifest.routes.length, aliases: manifest.aliases?.length ?? 0,
    checkedUrls, sharedAssets: manifest.assets.length, referencedAssets: referencedFiles.size,
    retainedNextFiles: inventory.files.length, sitemap, directoryFiles,
    output: measureOutput(manifest, output),
    ...(compression ? { compressionSamples: compressionSamples(manifest, output), compressionNote: 'One HTML per family; sample sizes, not a full-output transfer estimate. Brotli quality 5.' } : {}),
    seconds: (performance.now() - started) / 1000 };
}

if (require.main === module) {
  verifyStatic({ allowSample: process.argv.includes('--allow-sample'), compression: process.argv.includes('--compression') }).then(report => {
    writeJson(path.join(STAGE, 'reports', 'verify-latest.json'), report);
    console.log(JSON.stringify(report, null, 2));
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { verifyStatic, compressionSamples, canonicalPath, checkCanonical, sitemapInventory, directoryFileCounts };
