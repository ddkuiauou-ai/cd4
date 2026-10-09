const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createStaticAssetWriter } = require('./static-asset-writer.cjs');

const digest = data => crypto.createHash('sha256').update(data).digest('hex');
function safeRelative(value) {
  if (!value || path.isAbsolute(value) || value.split(/[\\/]/).some(part => part === '..')) throw new Error('Unsafe static asset path');
  return value;
}
function jsonFiles(directory, prefix) {
  const result = [];
  const target = path.join(directory, prefix);
  if (!fs.existsSync(target)) return result;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...jsonFiles(directory, relative));
    else if (entry.isFile() && entry.name.endsWith('.json')) result.push(relative);
  }
  return result;
}

function migrateStaticAssets({ stage, reportPath } = {}) {
  if (!stage) throw new Error('Static input directory is required');
  stage = path.resolve(stage);
  const manifestPath = path.join(stage, 'manifest.json');
  const originalManifest = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(originalManifest);
  const scratch = fs.mkdtempSync(path.join(stage, '.asset-migration-'));
  const writer = createStaticAssetWriter(path.join(scratch, 'assets'));
  const originalAssets = new Map();
  const urls = new Map();
  const processing = new Set();
  let embeddedReferences = 0;
  let rewrittenReferences = 0;
  const writes = [];
  const committed = [];
  let assetsSwapped = false;
  try {
    for (const asset of manifest.assets) {
      safeRelative(asset.path);
      const data = fs.readFileSync(path.join(stage, 'assets', asset.path));
      if (data.length !== asset.bytes || digest(data) !== asset.sha256) throw new Error(`Original asset changed: ${asset.path}`);
      if (originalAssets.has(asset.path)) throw new Error(`Duplicate original asset path: ${asset.path}`);
      originalAssets.set(asset.path, { ...asset, data });
    }
    function transform(value, referenceCounter) {
      if (typeof value === 'string') {
        const relative = value.startsWith('/') ? value.slice(1) : value;
        if (!originalAssets.has(relative)) return value;
        referenceCounter();
        const url = migrateAsset(relative);
        return value.startsWith('/') ? url : url.slice(1);
      }
      if (Array.isArray(value)) return value.map(item => transform(item, referenceCounter));
      if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, transform(item, referenceCounter)]));
      return value;
    }
    function migrateAsset(relative) {
      if (urls.has(relative)) return urls.get(relative);
      if (processing.has(relative)) throw new Error(`Cyclic static asset reference: ${relative}`);
      processing.add(relative);
      const asset = originalAssets.get(relative);
      const extension = path.extname(relative).slice(1);
      let data = asset.data;
      if (extension === 'json') {
        let references = 0;
        const transformed = transform(JSON.parse(data), () => references++);
        embeddedReferences += references;
        if (references) data = Buffer.from(JSON.stringify(transformed));
      }
      const url = writer.writeBytes(data, extension);
      urls.set(relative, url);
      processing.delete(relative);
      return url;
    }
    for (const relative of originalAssets.keys()) migrateAsset(relative);
    const inputFiles = ['manifest.json', 'identities.json', 'companies.json'].filter(file => fs.existsSync(path.join(stage, file)))
      .concat(jsonFiles(stage, 'data'), jsonFiles(stage, 'rankings'));
    for (const relative of inputFiles) {
      const original = fs.readFileSync(path.join(stage, relative));
      const value = JSON.parse(original);
      const transformed = transform(value, () => rewrittenReferences++);
      if (relative === 'manifest.json') transformed.assets = writer.assets;
      if (JSON.stringify(value) === JSON.stringify(transformed)) continue;
      const replacement = Buffer.from(JSON.stringify(transformed));
      const target = path.join(scratch, 'inputs', relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, replacement);
      writes.push({ relative, original, replacement });
    }
    // Validate every staged byte and untouched source before switching any input path.
    for (const asset of writer.assets) {
      const data = fs.readFileSync(path.join(scratch, 'assets', asset.path));
      if (data.length !== asset.bytes || digest(data) !== asset.sha256) throw new Error(`Migrated asset changed: ${asset.path}`);
    }
    for (const write of writes) if (!fs.readFileSync(path.join(stage, write.relative)).equals(write.original)) throw new Error(`Input changed during asset migration: ${write.relative}`);
    if (!fs.readFileSync(manifestPath).equals(originalManifest)) throw new Error('Manifest changed during asset migration');
    const newManifest = JSON.parse(writes.find(write => write.relative === 'manifest.json')?.replacement ?? originalManifest);
    if (newManifest.snapshotId !== manifest.snapshotId) throw new Error('Asset migration changed snapshot identity');
    const comparableOriginal = { ...transform(manifest, () => {}), assets: writer.assets };
    if (JSON.stringify(comparableOriginal) !== JSON.stringify(newManifest)) throw new Error('Asset migration changed manifest metadata');

    fs.renameSync(path.join(stage, 'assets'), path.join(scratch, 'previous-assets'));
    try { fs.renameSync(path.join(scratch, 'assets'), path.join(stage, 'assets')); }
    catch (error) { fs.renameSync(path.join(scratch, 'previous-assets'), path.join(stage, 'assets')); throw error; }
    assetsSwapped = true;
    // The manifest is committed last, after all its referenced files are ready.
    writes.sort((a, b) => Number(a.relative === 'manifest.json') - Number(b.relative === 'manifest.json'));
    for (const write of writes) {
      const current = path.join(stage, write.relative);
      const backup = path.join(scratch, 'previous-inputs', write.relative);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.renameSync(current, backup);
      try { fs.renameSync(path.join(scratch, 'inputs', write.relative), current); }
      catch (error) { fs.renameSync(backup, current); throw error; }
      committed.push(write.relative);
    }
    const beforeBytes = manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0);
    const afterBytes = writer.assets.reduce((sum, asset) => sum + asset.bytes, 0);
    const report = { version: 1, success: true, method: 'Offline byte-preserving content-addressed asset migration; no database reads',
      snapshotIdBefore: manifest.snapshotId, snapshotIdAfter: newManifest.snapshotId, snapshotIdentityPreserved: true,
      before: { files: manifest.assets.length, bytes: beforeBytes }, after: { files: writer.assets.length, bytes: afterBytes },
      removedDuplicateFiles: manifest.assets.length - writer.assets.length, savedBytes: beforeBytes - afterBytes,
      rewrittenInputFiles: writes.map(write => write.relative), rewrittenReferences, embeddedAssetReferences: embeddedReferences,
      byteExactPayloads: embeddedReferences === 0, manifestMetadataPreserved: true,
      assetMapping: [...urls].map(([from, to]) => ({ from: `/${from}`, to, sha256: originalAssets.get(from).sha256 })) };
    if (reportPath) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    }
    return report;
  } catch (error) {
    for (const relative of committed.reverse()) {
      fs.rmSync(path.join(stage, relative), { force: true });
      fs.renameSync(path.join(scratch, 'previous-inputs', relative), path.join(stage, relative));
    }
    if (assetsSwapped) {
      fs.rmSync(path.join(stage, 'assets'), { recursive: true, force: true });
      fs.renameSync(path.join(scratch, 'previous-assets'), path.join(stage, 'assets'));
    }
    throw error;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const stage = path.resolve(process.argv[2] || process.env.STATIC_SNAPSHOT_DIR || '.static-build');
  try {
    const report = migrateStaticAssets({ stage, reportPath: path.join(stage, 'reports', 'asset-dedup-migration.json') });
    console.log(JSON.stringify({ snapshotId: report.snapshotIdAfter, before: report.before, after: report.after, savedBytes: report.savedBytes }));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { migrateStaticAssets };
