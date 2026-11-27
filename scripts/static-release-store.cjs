const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { filesBelow, readJson, relativeFile, sha256, writeJson } = require('./static-tools.cjs');
const { contentType } = require('./preview-static.cjs');
require('./register-typescript.cjs');
const { parseCsvRecords } = require('../lib/csv/ranking.ts');

const CURRENT = 'current.json';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'public, max-age=0, must-revalidate';
const marketDate = key => /^downloads\/market\/(\d{4}-\d{2}-\d{2})\.csv$/.exec(key)?.[1];
const hashedData = /^static-data\/(?:[a-z\d-]+\/)*[a-f0-9]{16,64}\.(?:json|csv)$/;
const isRsc = key => /(?:^|\/)(?:index\.txt|__next[^/]*\.txt)$/.test(key) || /\.rsc$/.test(key);
const immutable = key => key.startsWith('_next/static/') || hashedData.test(key);
const preserve = key => Boolean(marketDate(key)) || immutable(key);
const blob = (root, hash) => path.join(root, 'objects', hash.slice(0, 2), hash);
const jsonHash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const order = (a, b) => a < b ? -1 : Number(a > b);
const digestSyntax = /^[a-f0-9]{64}$/;
const documentAssets = /\/(?:_next\/static|static-data|downloads\/market)\/[A-Za-z0-9._~!$&()*+,;=:@%/-]+?\.(?:css|json|js|csv|woff2)(?![A-Za-z0-9])/g;

function classifyKey(key) {
  const basename = path.posix.basename(key);
  if (['_headers', '_redirects', '_static-build.json', '_per-pilot.json'].includes(key) || isRsc(key)
      || key === 'downloads/market/_unpublished') return false;
  if (key.split('/').some(part => part.startsWith('.')) || /^(?:data|rankings|reports|\.static-build)\//.test(key)) {
    throw new Error(`Private input is present in the candidate output: ${key}`);
  }
  if (key.endsWith('.json') && key !== 'search-data.json' && !key.startsWith('static-data/')) {
    throw new Error(`Unexpected public JSON object: ${key}`);
  }
  if (key.startsWith('_next/') && !key.startsWith('_next/static/')) {
    throw new Error(`Unexpected Next server output: ${key}`);
  }
  if (key.endsWith('.txt') && !['ads.txt', 'robots.txt'].includes(key)) {
    throw new Error(`Unrecognized public text file: ${key}`);
  }
  const type = contentType(key);
  if (type === 'application/octet-stream' && !['.webmanifest', '.wasm', '.avif', '.gif'].includes(path.extname(basename))) {
    throw new Error(`Unsupported public object type: ${key}`);
  }
  return true;
}

function objectHeaders(filename, key) {
  const other = { '.webmanifest': 'application/manifest+json; charset=utf-8', '.wasm': 'application/wasm',
    '.avif': 'image/avif', '.gif': 'image/gif' };
  const headers = {
    'cache-control': immutable(key) ? IMMUTABLE : REVALIDATE,
    'content-type': other[path.extname(key)] ?? contentType(key),
  };
  if (key.endsWith('.csv')) headers['content-disposition'] = 'attachment';
  const date = marketDate(key);
  if (date) {
    const body = fs.readFileSync(filename, 'utf8');
    const rows = parseCsvRecords(body);
    if (body.charCodeAt(0) !== 0xfeff || rows[0]?.[0].replace(/^\uFEFF/, '') !== '기준일'
      || rows.slice(1).some(row => row[0] !== date || row.length !== rows[0].length)) {
      throw new Error(`Invalid dated market CSV: ${key}`);
    }
    headers['content-disposition'] = `attachment; filename="market-${date}.csv"`;
    headers['x-market-reference-date'] = date;
    headers['x-market-row-count'] = String(rows.length - 1);
  }
  return headers;
}

function readInventory(root, releaseId) {
  if (typeof releaseId !== 'string' || !digestSyntax.test(releaseId)) throw new Error('Invalid local release ID');
  const inventory = readJson(path.join(root, 'releases', releaseId + '.json'));
  if (inventory.version !== 1 || jsonHash(inventory) !== releaseId) throw new Error('Local release inventory digest mismatch');
  for (const object of inventory.objects) {
    if (!digestSyntax.test(object.sha256) || !Number.isSafeInteger(object.bytes) || object.bytes < 0) {
      throw new Error('Invalid local release object');
    }
    relativeFile(object.key);
  }
  const objects = new Map(inventory.objects.map(object => [object.key, object]));
  const active = inventory.activeKeys ?? [...objects.keys()];
  return { releaseId, inventory, objects, active: new Set(active),
    activeDigest: jsonHash(active.map(key => objects.get(key))) };
}

function readRelease(root) {
  const pointer = path.join(root, CURRENT);
  if (!fs.existsSync(pointer)) return null;
  const { version, releaseId, previousReleaseId = null } = readJson(pointer);
  if (version !== 1 || (previousReleaseId !== null && !digestSyntax.test(previousReleaseId))) throw new Error('Invalid local release pointer');
  return { ...readInventory(root, releaseId), previousReleaseId };
}

function releaseBuildState(root, releaseId) {
  if (!releaseId) return null;
  if (!digestSyntax.test(releaseId)) throw new Error('Invalid local release ID');
  const file = path.join(root, 'builds', releaseId + '.json');
  return fs.existsSync(file) ? readJson(file) : null;
}

function writeReleaseBuildState(root, releaseId, state) {
  if (!digestSyntax.test(releaseId)) throw new Error('Invalid local release ID');
  writeJson(path.join(root, 'builds', releaseId + '.json'), { ...state, releaseId });
}

function operationPhase(key) {
  if (immutable(key)) return 0;
  if (/^sitemaps?(?:[./-]|$)/.test(key)) return 3;
  return key.endsWith('.html') ? 2 : 1;
}

function keyOperations(from, to) {
  const previous = from?.objects ?? new Map();
  const next = to?.objects ?? new Map();
  const puts = [...next.values()]
    .filter(object => JSON.stringify(previous.get(object.key)) !== JSON.stringify(object))
    .sort((a, b) => operationPhase(a.key) - operationPhase(b.key) || order(a.key, b.key))
    .map(object => ({ action: 'put', ...object }));
  const retires = [...previous.values()].filter(object => !next.has(object.key))
    .sort((a, b) => Number(immutable(a.key)) - Number(immutable(b.key)) || order(a.key, b.key))
    .map(object => ({ action: 'retire', key: object.key, sha256: object.sha256 }));
  return [...puts, ...retires];
}

function retainRollbackDependencies(target, interrupted) {
  if (!target) return null;
  const objects = new Map(target.objects);
  for (const [key, object] of interrupted.objects) {
    if (!objects.has(key) && immutable(key) && interrupted.active.has(key)) objects.set(key, object);
  }
  const inventory = { version: 1, activeKeys: [...target.active], objects: [...objects.values()].sort((a, b) => order(a.key, b.key)) };
  return { inventory, objects, releaseId: jsonHash(inventory) };
}

function planRelease({ candidate, root, previous = readRelease(root), retained = new Map(), compressedHtml }) {
  const input = fs.realpathSync(candidate);
  const objects = new Map();
  const sources = new Map();
  const dependencies = new Set();
  const documents = Object.create(null);
  function rememberDependencies(key, assets) {
    documents[key] = [...new Set(assets)].sort(order);
    for (const asset of documents[key]) dependencies.add(relativeFile(asset));
  }
  for (const key of filesBelow(input)) {
    relativeFile(key);
    if (!classifyKey(key)) continue;
    const file = path.join(input, key);
    const html = key.endsWith('.html') ? fs.readFileSync(file) : null;
    const hash = html ? createHash('sha256').update(html).digest('hex') : sha256(file);
    if (hashedData.test(key) && !hash.startsWith(path.basename(key, path.extname(key)))) {
      throw new Error(`Content-addressed filename does not match its bytes: ${key}`);
    }
    const object = { key, sha256: hash, bytes: html?.length ?? fs.statSync(file).size, headers: objectHeaders(file, key) };
    const old = previous?.objects.get(key);
    if (old && immutable(key) && old.sha256 !== hash) {
      throw Object.assign(new Error(`Immutable object key collision: ${key}`), {
        code: 'IMMUTABLE_OBJECT_COLLISION', key, digest: hash,
      });
    }
    objects.set(key, object);
    sources.set(hash, file);
    if (html) rememberDependencies(key, documentAssetKeys(html.toString('utf8')));
  }
  for (const [key, entry] of compressedHtml ?? []) {
    if (!relativeFile(key).endsWith('.html') || !classifyKey(key) || objects.has(key)
      || !digestSyntax.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) {
      throw new Error(`Invalid compressed candidate document: ${key}`);
    }
    objects.set(key, { key, sha256: entry.sha256, bytes: entry.bytes, headers: objectHeaders(entry.file, key) });
    rememberDependencies(key, entry.dependencies);
  }
  for (const [key, assets] of retained) {
    const object = previous?.objects.get(relativeFile(key));
    if (!object || objects.has(key) || !classifyKey(key)) throw new Error(`Invalid retained candidate object: ${key}`);
    objects.set(key, object);
    if (key.endsWith('.html')) rememberDependencies(key, assets);
  }
  if (!objects.has('index.html')) throw new Error('Candidate output is missing index.html');
  const activeKeys = [...objects.keys()].sort(order);
  const activeDigest = jsonHash(activeKeys.map(key => objects.get(key)));
  if (previous?.activeDigest === activeDigest) {
    return { inventory: previous.inventory, releaseId: previous.releaseId, sources, documents, operations: [], rollbackOperations: [] };
  }
  for (const [key, object] of previous?.objects ?? []) {
    if (!objects.has(key) && preserve(key) && (marketDate(key) || previous.active.has(key) || dependencies.has(key))) {
      objects.set(key, object);
    }
  }
  for (const key of dependencies) if (!objects.has(key)) throw new Error(`Candidate document refers to a missing object: ${key}`);
  const inventory = { version: 1, activeKeys, objects: [...objects.values()].sort((a, b) => order(a.key, b.key)) };
  const current = { objects, active: new Set(activeKeys) };
  return { inventory, releaseId: jsonHash(inventory), sources, documents,
    operations: keyOperations(previous, current), rollbackOperations: keyOperations(current, retainRollbackDependencies(previous, current)) };
}

function verifyStoredObject(file, object) {
  if (fs.statSync(file).size !== object.bytes || sha256(file) !== object.sha256) {
    throw new Error(`Stored object digest mismatch: ${object.key}`);
  }
}

function verifyReleaseObjects(root, objects) {
  const checked = new Set();
  for (const object of objects) {
    if (checked.has(object.sha256)) continue;
    checked.add(object.sha256);
    verifyStoredObject(blob(root, object.sha256), object);
  }
}

function prunePrivateHistory(root, keptReleases) {
  const files = path.join(root, 'releases');
  const kept = new Set(keptReleases.filter(Boolean));
  const objects = new Set([...kept].flatMap(id => [...readInventory(root, id).objects.values()].map(object => object.sha256)));
  let pruned = 0;
  for (const entry of fs.readdirSync(files)) {
    const id = path.basename(entry, '.json');
    if (digestSyntax.test(id) && !kept.has(id)) fs.unlinkSync(path.join(files, entry));
  }
  const objectRoot = path.join(root, 'objects');
  for (const prefix of fs.readdirSync(objectRoot)) {
    if (!/^[a-f0-9]{2}$/.test(prefix)) continue;
    const directory = path.join(objectRoot, prefix);
    for (const hash of fs.readdirSync(directory)) {
      if (digestSyntax.test(hash) && !objects.has(hash)) {
        fs.unlinkSync(path.join(directory, hash));
        pruned++;
      }
    }
  }
  return pruned;
}

function storeObject(root, object, source) {
  const destination = blob(root, object.sha256);
  if (fs.existsSync(destination)) { verifyStoredObject(destination, object); return false; }
  if (!source) throw new Error(`Retained release object is missing: ${object.key}`);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = destination + '.' + randomUUID() + '.tmp';
  try {
    fs.copyFileSync(source, temporary, fs.constants.COPYFILE_EXCL | fs.constants.COPYFILE_FICLONE);
    if (sha256(temporary) !== object.sha256 || fs.statSync(temporary).size !== object.bytes) {
      throw new Error(`Candidate object changed during publication: ${object.key}`);
    }
    fs.renameSync(temporary, destination);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  return true;
}

function acquireStoreLock(root, name) {
  fs.mkdirSync(root, { recursive: true });
  const lock = path.join(root, name + '.lock');
  const token = path.join(root, `${name}.${process.pid}.${randomUUID()}.tmp`);
  fs.writeFileSync(token, String(process.pid), { flag: 'wx' });
  try {
    try {
      fs.linkSync(token, lock);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const owner = Number(fs.readFileSync(lock, 'utf8'));
      if (!Number.isSafeInteger(owner) || owner <= 0) throw new Error('Invalid release lock');
      let stale = false;
      try { process.kill(owner, 0); } catch (error) {
        if (error.code !== 'ESRCH') throw error;
        stale = true;
      }
      if (!stale) throw Object.assign(new Error(`Another local release ${name} is running`), { code: 'RELEASE_LOCK_BUSY' });
      fs.unlinkSync(lock);
      fs.linkSync(token, lock);
    }
    return () => {
      if (fs.statSync(token).ino === fs.statSync(lock, { throwIfNoEntry: false })?.ino) fs.unlinkSync(lock);
      fs.rmSync(token, { force: true });
    };
  } catch (error) {
    fs.rmSync(token, { force: true });
    throw error;
  }
}

function withReleaseLock(root, task) {
  const release = acquireStoreLock(root, 'publish');
  try { return task(); }
  finally { release(); }
}

function publishRelease({ candidate, root, dryRun = false, beforeCommit, expectedPrevious }) {
  const input = fs.realpathSync(candidate);
  const output = fs.existsSync(root) ? fs.realpathSync(root) : path.resolve(root);
  if (input === output || input.startsWith(output + path.sep) || output.startsWith(input + path.sep)) {
    throw new Error('Candidate and object store must be separate directories');
  }
  const initial = readRelease(output);
  const plan = planRelease({ candidate: input, root: output, previous: initial });
  if (expectedPrevious !== undefined && (initial?.releaseId ?? null) !== expectedPrevious && initial?.releaseId !== plan.releaseId) {
    throw new Error('Current release differs from the candidate build base; rebuild before publishing');
  }
  const report = {
    releaseId: plan.releaseId, totalObjects: plan.inventory.objects.length, dryRun,
    ...operationReport(plan.operations, plan.rollbackOperations),
    objectWrites: 0, bytesWritten: 0, pointerWrites: 0,
  };
  if (dryRun) return report;
  if (initial?.releaseId === plan.releaseId) {
    verifyReleaseObjects(output, plan.inventory.objects);
    return report;
  }
  return withReleaseLock(output, () => {
    if (readRelease(output)?.releaseId !== initial?.releaseId) throw new Error('Current release changed while planning; retry');
    const visited = new Set();
    for (const object of plan.inventory.objects) {
      if (visited.has(object.sha256)) continue;
      visited.add(object.sha256);
      if (storeObject(output, object, plan.sources.get(object.sha256))) {
        report.objectWrites++;
        report.bytesWritten += object.bytes;
      }
    }
    writeJson(path.join(output, 'releases', plan.releaseId + '.json'), plan.inventory);
    beforeCommit?.(report);
    writeJson(path.join(output, CURRENT), { version: 1, releaseId: plan.releaseId, previousReleaseId: initial?.releaseId ?? null });
    report.pointerWrites++;
    try { report.prunedObjects = prunePrivateHistory(output, [plan.releaseId, initial?.releaseId]); }
    catch (error) { report.cleanupError = error.code ?? error.message; }
    return report;
  });
}

function operationReport(operations, rollbackOperations) {
  const puts = operations.filter(op => op.action === 'put');
  const deletes = operations.filter(op => op.action === 'retire');
  return {
    putKeys: puts.length, putBytes: puts.reduce((total, op) => total + op.bytes, 0), deleteKeys: deletes.length,
    changedKeys: puts.map(op => op.key).sort(order),
    deletedKeys: deletes.map(op => op.key).sort(order),
    operations, rollbackOperations,
  };
}

function rollbackRelease({ root, dryRun = false }) {
  const current = readRelease(root);
  if (!current?.previousReleaseId) throw new Error('There is no previous successful local release');
  const previous = readInventory(root, current.previousReleaseId);
  const target = retainRollbackDependencies(previous, current);
  const operations = keyOperations(current, target);
  const report = {
    releaseId: target.releaseId, restoredReleaseId: previous.releaseId, totalObjects: target.objects.size, dryRun,
    ...operationReport(operations, keyOperations(target, current)), objectWrites: 0, bytesWritten: 0, pointerWrites: 0,
  };
  if (dryRun) return report;
  return withReleaseLock(root, () => {
    if (readRelease(root)?.releaseId !== current.releaseId) throw new Error('Current release changed while planning; retry');
    verifyReleaseObjects(root, target.objects.values());
    writeJson(path.join(root, 'releases', target.releaseId + '.json'), target.inventory);
    writeJson(path.join(root, CURRENT), { version: 1, releaseId: target.releaseId, previousReleaseId: current.releaseId });
    report.pointerWrites++;
    try { report.prunedObjects = prunePrivateHistory(root, [target.releaseId, current.releaseId]); }
    catch (error) { report.cleanupError = error.code ?? error.message; }
    return report;
  });
}

function documentAssetKeys(html) {
  return [...html.matchAll(documentAssets)].map(match => decodeURIComponent(match[0].slice(1)));
}

module.exports = { blob, jsonHash, operationPhase, keyOperations, readRelease, releaseBuildState, writeReleaseBuildState,
  planRelease, publishRelease, rollbackRelease, acquireStoreLock, documentAssetKeys, operationReport, isRsc };
