const { createHash } = require('node:crypto');
const FILE = 'source-index.json';
const compare = (a, b) => a < b ? -1 : Number(a > b);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function canonical(value) {
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort(compare)
    .filter(key => key !== 'createdAt' && key !== 'updatedAt')
    .map(key => [key, canonical(value[key])]));
  return value;
}

function buildSourceIndex(metadata) {
  const groups = Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key,
    Array.isArray(value) ? value.map(canonical).sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b))) : canonical(value),
  ]));
  const index = { version: 1, metadata: hash(canonical(groups)),
    partitions: [] };
  return { ...index, digest: hash(index) };
}

function rankNeighborsByValue(ordered, rankOf) {
  const firsts = [];
  for (const row of ordered) {
    const rank = rankOf(row);
    if (rank == null || rank === firsts.at(-1)?.rank) continue;
    firsts.push({ rank, row });
  }
  return rank => {
    if (rank == null) return [];
    let lower = 0, upper = firsts.length;
    while (lower < upper) {
      const mid = (lower + upper) >>> 1;
      if (firsts[mid].rank < rank) lower = mid + 1;
      else upper = mid;
    }
    return [firsts[lower - 1]?.row, firsts[lower + Number(firsts[lower]?.rank === rank)]?.row];
  };
}

module.exports = { FILE, buildSourceIndex, rankNeighborsByValue };
