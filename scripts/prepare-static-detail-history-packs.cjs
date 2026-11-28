const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { createStaticAssetWriter } = require('./static-asset-writer.cjs');

const INDEX = 'history-packs.json';
const SOURCES = 'history-sources.json';
const PAIRS = [['per', 'eps'], ['pbr', 'bps'], ['div', 'dps']];
const pairKey = (first, second) => [first, second].sort().join('|');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return JSON.parse(gunzipSync(fs.readFileSync(file + '.gz')));
  }
}

function combinePair(left, first, right, second) {
  const dates = new Map();
  for (const [table, field, offset] of [[left, first, 1], [right, second, 4]]) {
    const dateColumn = table.columns.indexOf('date');
    const valueColumn = table.columns.indexOf(field);
    const stateColumn = table.columns.indexOf(field + 'State');
    if (dateColumn < 0 || valueColumn < 0) throw new Error('Invalid paired history fields');
    for (const source of table.rows) {
      const date = source[dateColumn];
      const row = dates.get(date) ?? [date, null, null, false, null, null, false];
      if (row[offset + 2]) throw new Error('Duplicate paired history day: ' + date);
      row[offset] = source[valueColumn];
      row[offset + 1] = stateColumn < 0 ? null : source[stateColumn];
      row[offset + 2] = true;
      dates.set(date, row);
    }
  }
  return { schemaVersion: 1, columns: ['date', first, first + 'State', first + 'Present', second, second + 'State', second + 'Present'],
    rows: [...dates.values()] };
}

function createHistoryPackIndex({ cutoff, companyCutoff, writer }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) throw new Error('Published day required for yearly history');
  const currentStart = cutoff.slice(0, 4) + '-01-01';
  const entries = Object.create(null);

  function add(key, table, { original = key, pair, previousArchive, through } = {}) {
    if (Object.hasOwn(entries, key)) return entries[key];
    if (table?.schemaVersion !== 1 || !Array.isArray(table.columns) || !Array.isArray(table.rows)) return;
    const dateColumn = table.columns.indexOf('date');
    if (dateColumn < 0) return;
    const limit = through ?? (table.columns.includes('totalMarketcap') ? companyCutoff ?? cutoff : cutoff);
    const splitDay = limit.slice(0, 4) + '-01-01';
    const sorted = table.rows.every((row, index) => index === 0 || table.rows[index - 1][dateColumn] <= row[dateColumn])
      ? table.rows : [...table.rows].sort((left, right) => left[dateColumn].localeCompare(right[dateColumn]));
    const archiveRows = [], currentRows = [];
    let previousDate;
    for (const row of sorted) {
      const date = row[dateColumn];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date === previousDate) throw new Error('Invalid or duplicate history day in ' + key);
      previousDate = date;
      if (date <= limit && (!previousArchive || date >= splitDay)) (date < splitDay ? archiveRows : currentRows).push(row);
    }
    const writePart = rows => !rows.length ? undefined
      : original && !pair && rows.length === table.rows.length && sorted === table.rows ? original
        : writer.write({ schemaVersion: 1, columns: table.columns, rows });
    const bounds = rows => rows.length ? [rows[0][dateColumn], rows.at(-1)[dateColumn]] : undefined;
    const result = {
      currentStart: splitDay, archive: previousArchive?.archive ?? writePart(archiveRows), current: writePart(currentRows), pair, cutoff: limit,
      archiveDates: previousArchive?.archiveDates ?? bounds(archiveRows), currentDates: bounds(currentRows),
      latestDate: currentRows.at(-1)?.[dateColumn] ?? previousArchive?.archiveDates?.[1] ?? archiveRows.at(-1)?.[dateColumn],
    };
    const close = table.columns.indexOf('close');
    const candles = ['open', 'high', 'low', 'close'].map(column => table.columns.indexOf(column));
    if (close >= 0 && candles.every(column => column >= 0)) {
      const closeWarmup = currentRows.filter(row => row[close] != null)[9]?.[dateColumn];
      const candleWarmup = currentRows.filter(row => candles.every(column => row[column] != null))[9]?.[dateColumn];
      if (closeWarmup && candleWarmup) result.warmupThrough = closeWarmup > candleWarmup ? closeWarmup : candleWarmup;
    }
    entries[key] = result;
    return result;
  }

  function addPair(firstUrl, first, secondUrl, second, read) {
    const key = pairKey(firstUrl, secondUrl);
    return entries[key] ?? add(key, combinePair(read(firstUrl), first, read(secondUrl), second), { pair: [first, second] });
  }
  return { add, addPair, entries, currentStart };
}

/** Older inputs have no lightweight history source index. Read only the assets object in each private record. */
function* financialSources(input) {
  const index = path.join(input, SOURCES);
  if (fs.existsSync(index)) {
    yield* Object.values(readJson(index));
    return;
  }
  const directory = path.join(input, 'data/security');
  if (!fs.existsSync(directory)) return;
  for (const filename of fs.readdirSync(directory)) {
    if (!/\.json(?:\.gz)?$/.test(filename)) continue;
    const file = path.join(directory, filename);
    const encoded = fs.readFileSync(file);
    const text = (filename.endsWith('.gz') ? gunzipSync(encoded) : encoded).toString('utf8');
    const start = text.lastIndexOf(',"assets":');
    const end = text.indexOf(',"rankings":', start + 10);
    const refs = start >= 0 && end > start ? JSON.parse(text.slice(start + 10, end)) : JSON.parse(text).assets;
    if (refs?.metrics) yield refs.metrics;
  }
}

/** Prepare a complete private input view without modifying the frozen source. */
function augmentDetailHistoryPacks({ input, output, previous }) {
  const snapshot = readJson(path.join(input, 'manifest.json'));
  if (snapshot.historyPacks) return input;
  const cutoff = snapshot.sourcePublications?.['security_latest/krx-all']?.asOf;
  if (!cutoff) return input;
  const companyCutoff = snapshot.sourcePublications?.['company_marketcap/krx-all']?.asOf;
  fs.mkdirSync(output);
  const assetsDir = path.join(output, 'assets');
  fs.mkdirSync(assetsDir);
  for (const name of fs.readdirSync(input)) {
    if (['manifest.json', 'assets', INDEX].includes(name)) continue;
    const file = path.join(input, name);
    fs.symlinkSync(fs.realpathSync(file), path.join(output, name));
  }
  const assets = new Map();
  function linkAsset(entry, source) {
    if (assets.has(entry.path)) return;
    const target = path.join(assetsDir, entry.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.linkSync(path.join(source, 'assets', entry.path), target);
    assets.set(entry.path, entry);
  }
  for (const entry of snapshot.assets) linkAsset(entry, input);
  const writer = createStaticAssetWriter(assetsDir);
  const index = createHistoryPackIndex({ cutoff, companyCutoff, writer });
  const oldIndex = previous && fs.existsSync(path.join(previous, INDEX)) ? readJson(path.join(previous, INDEX)) : null;
  const oldEntries = oldIndex ? new Map(readJson(path.join(previous, 'manifest.json')).assets.map(entry => ['/' + entry.path, entry])) : new Map();
  function reuse(key) {
    const old = oldIndex?.[key];
    if (!old?.cutoff || ![cutoff, companyCutoff].includes(old.cutoff) || ![old.current, old.archive].every(part => !part || oldEntries.has(part))) return false;
    for (const part of [old.current, old.archive]) if (part && !assets.has(part.slice(1))) linkAsset(oldEntries.get(part), previous);
    index.entries[key] = old;
    return true;
  }

  const readAsset = url => readJson(path.join(input, 'assets', url));
  const paired = new Set(), unpaired = new Set();
  for (const sources of financialSources(input)) {
    for (const [first, second] of PAIRS) {
      const left = sources[first], right = sources[second];
      if (!left || !right) {
        if (left || right) unpaired.add(left || right);
        continue;
      }
      paired.add(left); paired.add(right);
      const key = pairKey(left, right);
      if (!Object.hasOwn(index.entries, key) && !reuse(key)) index.addPair(left, first, right, second, readAsset);
    }
  }
  const legacyHistory = new Set(paired);
  for (const entry of snapshot.assets) {
    if (!entry.path.startsWith('static-data/shared/') || !entry.path.endsWith('.json')) continue;
    const url = '/' + entry.path;
    if (paired.has(url) && !unpaired.has(url)) continue;
    if (reuse(url) || index.add(url, readAsset(url))) legacyHistory.add(url);
  }
  for (const entry of writer.assets) assets.set(entry.path, entry);
  const retained = new Set(Object.values(index.entries).flatMap(({ archive, current }) => [archive, current]).filter(Boolean));
  const publicAssets = [...assets.values()].filter(entry => {
    const url = '/' + entry.path;
    return !legacyHistory.has(url) || retained.has(url);
  });
  fs.writeFileSync(path.join(output, INDEX), JSON.stringify(index.entries));
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ ...snapshot, historyPacks: true, assets: publicAssets }));
  return output;
}

module.exports = { INDEX, SOURCES, PAIRS, pairKey, augmentDetailHistoryPacks, createHistoryPackIndex };
