const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createGzip, createGunzip } = require('node:zlib');
const { filesBelow, readJson, relativeFile, sha256 } = require('./static-tools.cjs');

const PREFIX = 'cd-release/portable';
const MAX_BUNDLE = 32 * 1024 * 1024;
const digest = /^[a-f0-9]{64}$/;
const sourceObject = /^cd-release\/portable\/source\/release-[a-zA-Z0-9]+\/([a-f0-9]{64})\.gz$/;
const outputObject = /^cd-release\/portable\/output\/release-[a-zA-Z0-9]+\/[a-f0-9]{64}\.gz$/;
const referenceObject = /^cd-release\/portable\/refs\/([a-f0-9]{64})\.json$/;
const referenceKey = id => `${PREFIX}/refs/${id}.json`;
const CLEANUP = `${PREFIX}/cleanup.json`;
const runName = /^release-[A-Za-z0-9]+$/;
// A reader can keep using a previously current baseline until its job timeout.
const CLEANUP_GRACE = 12 * 60 * 60 * 1000;
const sourceMetadata = ['manifest.json', 'identities.json', 'companies.json', 'company-assets.json'];
const isSecurityFile = key => /^data\/security\/[^/]+\.json(?:\.gz)?$/.test(key);
const isHistoryFile = key => /^data\/security-history\/[0-9a-f-]+\.(archive|current)\.json(?:\.gz)?$/.test(key);

function describe(root, key) {
  const file = path.join(root, relativeFile(key));
  const stat = fs.lstatSync(file);
  if (!stat.isFile()) throw new Error('Portable snapshot entry must be a regular file');
  return { key, bytes: stat.size, sha256: sha256(file) };
}

function groups(files) {
  const result = [];
  let group = [], size = 0;
  for (const file of files) {
    if (group.length && (size + file.bytes > MAX_BUNDLE || group.length >= 256)) {
      result.push(group);
      group = [];
      size = 0;
    }
    group.push(file);
    size += file.bytes;
  }
  if (group.length) result.push(group);
  return result;
}

async function bundle(client, kind, root, temporary, files, compressedHtml) {
  const filename = path.join(temporary, randomUUID() + '.gz');
  async function* contents() {
    for (const { key, bytes, sha256: hash } of files) {
      const actual = createHash('sha256');
      let length = 0;
      const compressed = compressedHtml?.get(key);
      const stream = fs.createReadStream(compressed ? compressed.file : path.join(root, key));
      for await (const chunk of compressed ? stream.compose(createGunzip()) : stream) {
        length += chunk.length;
        if (length > bytes) throw new Error('A candidate file changed while building its private bundle');
        actual.update(chunk);
        yield chunk;
      }
      if (length !== bytes || actual.digest('hex') !== hash) throw new Error('A candidate file changed while building its private bundle');
    }
  }
  try {
    await pipeline(Readable.from(contents()), createGzip({ level: 1 }), fs.createWriteStream(filename, { mode: 0o600 }));
    const hash = sha256(filename);
    const object = { key: `${PREFIX}/${kind}/${hash}.gz`, bytes: fs.statSync(filename).size, sha256: hash };
    await client.putPrivateObject(object, filename);
    return { ...object, files };
  } finally { fs.rmSync(filename, { force: true }); }
}

async function restoreBundle(client, kind, root, temporary, bundle) {
  const { key, bytes, sha256: hash, files } = bundle;
  const expectedKey = kind === 'source' ? sourceObject.exec(key)?.[1] === hash : key === `${PREFIX}/${kind}/${hash}.gz`;
  if (!digest.test(hash) || !expectedKey || !Number.isSafeInteger(bytes) || bytes <= 0
      || !Array.isArray(files) || !files.length) throw new Error('Invalid portable R2 bundle');
  for (const file of files) {
    relativeFile(file.key);
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || !digest.test(file.sha256)) throw new Error('Invalid portable R2 file');
    if (kind === 'source' && !sourceMetadata.includes(file.key) && !isSecurityFile(file.key) && !isHistoryFile(file.key)) {
      throw new Error('Unexpected portable source entry');
    }
  }
  const archive = path.join(temporary, randomUUID() + '.gz');
  let index = 0, descriptor, partial, target, remaining, hashFile;
  function start() {
    const file = files[index];
    target = path.join(root, file.key);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    partial = target + '.' + randomUUID() + '.tmp';
    descriptor = fs.openSync(partial, 'wx', 0o600);
    remaining = file.bytes;
    hashFile = createHash('sha256');
  }
  function finish() {
    fs.closeSync(descriptor);
    descriptor = undefined;
    if (hashFile.digest('hex') !== files[index].sha256) throw new Error('Portable R2 restored file digest mismatch');
    fs.renameSync(partial, target);
    partial = undefined;
    index++;
  }
  try {
    await client.getPrivateObject({ key, bytes, sha256: hash }, archive);
    await pipeline(fs.createReadStream(archive), createGunzip(), async chunks => {
      for await (const chunk of chunks) {
        let offset = 0;
        while (offset < chunk.length) {
          if (index >= files.length) throw new Error('Portable R2 bundle exceeds its expected size');
          if (descriptor === undefined) start();
          const length = Math.min(chunk.length - offset, remaining);
          let written = 0;
          while (written < length) written += fs.writeSync(descriptor, chunk, offset + written, length - written);
          hashFile.update(chunk.subarray(offset, offset + length));
          offset += length;
          remaining -= length;
          if (!remaining) finish();
        }
      }
    });
    while (descriptor === undefined && index < files.length && files[index].bytes === 0) { start(); finish(); }
    if (index !== files.length) throw new Error('Portable R2 bundle ended early');
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    if (partial) fs.rmSync(partial, { force: true });
    fs.rmSync(archive, { force: true });
  }
}

function portableHead(manifest) {
  return { sample: manifest.sample, sourcePublications: manifest.sourcePublications, referenceDate: manifest.referenceDate };
}

async function archiveSource({ client, state, run, temporary, previous, parallel }) {
  if (!runName.test(run)) throw new Error('Invalid portable R2 run');
  const { source, sourceCode, routes, documents, buildId, snapshotId, day } = state;
  const manifest = readJson(path.join(source, 'manifest.json'));
  if (manifest.sample?.enabled || !manifest.sourcePublications || manifest.referenceDate !== day
      || !manifest.separatedCompanyAssets || !manifest.historyPacks || !documents || !routes) {
    throw new Error('Portable daily baseline requires canonical frozen input and document dependencies');
  }
  const metadata = sourceMetadata.map(key => describe(source, key));
  const securityFiles = filesBelow(path.join(source, 'data/security')).map(key => `data/security/${key}`);
  const historyFiles = filesBelow(path.join(source, 'data/security-history')).map(key => `data/security-history/${key}`);
  const identities = readJson(path.join(source, 'identities.json'));
  const expectedSecurity = new Set(identities.map(({ securityId }) => `data/security/${securityId}.json`));
  const expectedHistory = new Set(identities.flatMap(({ securityId }) => {
    const name = createHash('sha256').update(securityId).digest('hex').slice(0, 32);
    return ['archive', 'current'].map(part => `data/security-history/${name}.${part}.json`);
  }));
  if (securityFiles.length !== expectedSecurity.size || historyFiles.length !== expectedHistory.size
      || !securityFiles.every(key => isSecurityFile(key) && expectedSecurity.delete(key.replace(/\.gz$/, '')))
      || !historyFiles.every(key => isHistoryFile(key) && expectedHistory.delete(key.replace(/\.gz$/, '')))) {
    throw new Error('Portable daily baseline has incomplete security source files');
  }
  const securities = securityFiles.map(key => describe(source, key));
  const history = historyFiles.map(key => describe(source, key));
  // Old-year parts keep their own bundle boundaries so they are reused on each trading day.
  const isArchive = file => /\.archive\.json(?:\.gz)?$/.test(file.key);
  const archived = history.filter(isArchive);
  const current = history.filter(file => !isArchive(file));
  const partitions = [metadata, securities, archived, current].flatMap(groups);
  const available = new Map((previous?.parts ?? []).map(part => [JSON.stringify(part.files), part]));
  const parts = new Array(partitions.length);
  await parallel(partitions.map((files, index) => ({ files, index })), 4, async ({ files, index }) => {
    parts[index] = available.get(JSON.stringify(files)) ?? await bundle(client, `source/${run}`, source, temporary, files);
  });
  return { version: 1, head: portableHead(manifest), state: { sourceCode, routes, documents, buildId, snapshotId }, parts };
}

async function restoreSource({ client, checkpoint, source, temporary, parallel }) {
  if (checkpoint?.version !== 1 || !checkpoint.state || !Array.isArray(checkpoint.parts)) {
    throw new Error('Invalid portable daily baseline');
  }
  await parallel(checkpoint.parts, 4, part => restoreBundle(client, 'source', source, temporary, part));
  const manifest = readJson(path.join(source, 'manifest.json'));
  if (JSON.stringify(portableHead(manifest)) !== JSON.stringify(checkpoint.head)) throw new Error('Portable publication head changed');
  return { ...checkpoint.state, source };
}

async function archiveOutput({ client, ordered, root, run, temporary, parallel, compressedHtml }) {
  const result = new Array(ordered.length);
  await parallel(ordered.map((batch, index) => ({ ...batch, index })), 4, async ({ operations, index }) => {
    const files = operations.filter(operation => operation.action === 'put').map(({ key, bytes, sha256 }) => {
      const compressed = compressedHtml?.get(key);
      const actual = compressed ?? describe(root, key);
      if (actual.bytes !== bytes || actual.sha256 !== sha256) throw new Error(`Candidate object changed: ${key}`);
      if (compressed && (!relativeFile(key).endsWith('.html') || !fs.lstatSync(compressed.file).isFile())) {
        throw new Error(`Invalid compressed candidate object: ${key}`);
      }
      return { key, bytes, sha256 };
    });
    result[index] = [];
    for (const part of groups(files)) result[index].push(await bundle(client, `output/${run}`, root, temporary, part, compressedHtml));
  });
  return result;
}

async function restoreOutput({ client, parts, operations, root, run, temporary }) {
  const expected = operations.filter(operation => operation.action === 'put').map(({ key, bytes, sha256 }) => ({ key, bytes, sha256 }));
  if (!Array.isArray(parts) || JSON.stringify(parts.flatMap(part => part.files)) !== JSON.stringify(expected)) {
    throw new Error('Portable R2 output differs from its pending batch');
  }
  for (const part of parts) await restoreBundle(client, `output/${run}`, root, temporary, part);
}

async function registerPortableReferences(client, bucket, id, descriptor) {
  const key = referenceKey(id);
  const value = { version: 1, mode: descriptor.mode, baseCandidateId: descriptor.baseCandidateId,
    source: descriptor.portable.parts.map(part => part.key),
    output: (descriptor.portable.output ?? []).flat().map(part => part.key) };
  try { await client.putJson(bucket, key, value); }
  catch (error) {
    if (error.code !== 'R2_CONFLICT') throw error;
    if (JSON.stringify((await client.getJson(bucket, key))?.value) !== JSON.stringify(value)) {
      throw new Error('Portable R2 candidate references differ');
    }
  }
}

async function cleanPortable({ client, bucket, readPointer, parallel, now = Date.now() }) {
  const pointer = await readPointer();
  const { current, previous, pending } = pointer.value;
  const protectedIds = new Set([current?.portable && current.candidateId, previous?.portable && previous.candidateId,
    pending?.portable && pending.id].filter(Boolean));
  const [previousMarks, listing] = await Promise.all([
    client.getJson(bucket, CLEANUP),
    (async () => {
      const refs = new Map(), keys = new Set();
      for await (const key of client.listPortableKeys()) {
        const id = referenceObject.exec(key)?.[1];
        if (id) refs.set(id, key);
        if (id || sourceObject.test(key) || outputObject.test(key)) keys.add(key);
      }
      return { refs, keys };
    })(),
  ]);
  for (const id of protectedIds) if (!listing.refs.has(id)) throw new Error('A live portable R2 reference is missing');
  const keep = new Set();
  await parallel([...listing.refs], 8, async ([id, key]) => {
    const ref = (await client.getJson(bucket, key))?.value;
    if (!ref || ref.version !== 1 || !Array.isArray(ref.source) || !ref.source.every(part => sourceObject.test(part))
      || !Array.isArray(ref.output) || !ref.output.every(part => outputObject.test(part))) {
      throw new Error('Invalid portable R2 candidate references');
    }
    const eligibleReview = ref.mode === 'verify' && ref.baseCandidateId === current?.candidateId;
    if (protectedIds.has(id) || eligibleReview) {
      keep.add(key);
      for (const part of ref.source) keep.add(part);
      if (pending?.id === id) for (const part of ref.output) keep.add(part);
    }
  });
  const oldMarks = previousMarks?.value;
  if (oldMarks && (oldMarks.version !== 1 || typeof oldMarks.keys !== 'object' || !oldMarks.keys)) {
    throw new Error('Invalid portable R2 cleanup state');
  }
  const grace = {}, obsolete = [];
  for (const key of listing.keys) {
    if (keep.has(key)) continue;
    const marked = oldMarks?.keys[key];
    if (Number.isSafeInteger(marked) && now - marked >= CLEANUP_GRACE) obsolete.push(key);
    else grace[key] = Number.isSafeInteger(marked) && marked <= now ? marked : now;
  }
  if (obsolete.length && (await readPointer()).etag !== pointer.etag) return;
  for (let offset = 0; offset < obsolete.length; offset += 1000) await client.deleteKeys(bucket, obsolete.slice(offset, offset + 1000));
  if (previousMarks || Object.keys(grace).length) await client.putJson(bucket, CLEANUP, { version: 1, keys: grace }, previousMarks?.etag);
}

module.exports = { archiveSource, restoreSource, archiveOutput, restoreOutput, registerPortableReferences, cleanPortable };
