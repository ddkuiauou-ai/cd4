const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

function createStaticAssetWriter(directory, { hashLength = 20 } = {}) {
  if (!Number.isInteger(hashLength) || hashLength < 2 || hashLength > 64) throw new Error('Invalid asset hash length');
  const assets = [];
  const recorded = new Map();

  function writeBytes(value, extension = 'json') {
    if (extension !== 'json' && extension !== 'csv') throw new Error('Unsupported static asset extension');
    const data = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const hash = sha256(data);
    const family = extension === 'csv' ? 'static-data/ranking/shared' : 'static-data/shared';
    const relative = `${family}/${hash.slice(0, 2)}/${hash.slice(0, hashLength)}.${extension}`;
    const previous = recorded.get(relative);
    if (previous && previous.sha256 !== hash) throw new Error(`Static asset hash collision: ${relative}`);
    const file = path.join(directory, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      fs.writeFileSync(file, data, { flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const existing = fs.readFileSync(file);
      if (sha256(existing) !== hash || !existing.equals(data)) throw new Error(`Static asset hash collision or changed content: ${relative}`);
    }
    if (!previous) {
      const entry = { path: relative, bytes: data.length, sha256: hash };
      assets.push(entry);
      recorded.set(relative, entry);
    }
    return `/${relative}`;
  }

  function write(value, extension = 'json') {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    if (data === undefined) throw new TypeError('Static asset must have serializable content');
    return writeBytes(Buffer.from(data), extension);
  }

  return { assets, write, writeBytes };
}

module.exports = { createStaticAssetWriter };
