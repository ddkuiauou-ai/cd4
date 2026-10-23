import type { SearchMenuItem } from "@/components/search-data";

export const SEARCH_RESULT_LIMIT = 40;

const CHOSEONG = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const RANK_COUNT = 10;

interface SearchEntry {
  item: SearchMenuItem;
  name: string;
  ticker: string;
  exchange: string;
  type: string;
  initials: string;
}

export type SecuritySearchIndex = readonly SearchEntry[];

function normalize(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/\s+/gu, "")
    .replace(/[ᄀ-ᄒ]/gu, character => CHOSEONG[character.charCodeAt(0) - 0x1100]);
}

function getInitials(value: string): string {
  return Array.from(value, character => {
    const syllable = character.charCodeAt(0) - 0xac00;
    return syllable >= 0 && syllable < 11_172
      ? CHOSEONG[Math.floor(syllable / 588)]
      : character;
  }).join("");
}

/** Prepare searchable text once when the shared dataset changes. */
export function createSecuritySearchIndex(data: readonly SearchMenuItem[]): SecuritySearchIndex {
  return data.map(item => {
    const name = normalize(item.korName);
    return {
      item,
      name,
      ticker: normalize(item.ticker),
      exchange: normalize(item.exchange),
      type: normalize(item.type ?? ""),
      initials: getInitials(name),
    };
  });
}

function tickerRank(ticker: string, query: string): number {
  if (ticker === query) return 0;
  if (ticker.startsWith(query)) return 2;
  return ticker.includes(query) ? 4 : -1;
}

// Each typed syllable must match literally; only a typed initial may stand for
// a whole syllable. This supports 삼성ㅈㅈ without making it an arbitrary typo.
function mixedInitialPosition(entry: SearchEntry, query: string, initialPositions: readonly boolean[]): number {
  for (let start = 0; start <= entry.name.length - query.length; start++) {
    let matched = true;
    for (let offset = 0; offset < query.length; offset++) {
      const text = initialPositions[offset] ? entry.initials : entry.name;
      if (text[start + offset] !== query[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return start;
  }
  return -1;
}

function prepareQuery(query: string) {
  const normalized = normalize(query);
  const qualified = /^([a-z][a-z0-9_-]*)\.(.+)$/.exec(normalized);
  const initialPositions = normalized.split("").map(character => CHOSEONG.includes(character));
  return {
    normalized,
    qualified,
    codeOnly: /^\d+$/.test(normalized) || qualified !== null,
    codeQuery: qualified?.[2] ?? normalized,
    initialPositions,
    hasInitial: initialPositions.some(Boolean),
    allInitials: initialPositions.every(Boolean),
  };
}

function entryRank(entry: SearchEntry, query: ReturnType<typeof prepareQuery>): number {
  const { normalized, qualified, codeOnly, codeQuery, initialPositions, hasInitial, allInitials } = query;
  if (qualified && entry.exchange !== qualified[1]) return -1;
  let rank = tickerRank(entry.ticker, codeQuery);
  if (codeOnly) return rank;

  let nameRank = -1;
  if (entry.name === normalized) nameRank = 1;
  else if (entry.name.startsWith(normalized)) nameRank = 3;
  else if (entry.name.includes(normalized)) nameRank = 5;
  else if (hasInitial) {
    const position = allInitials
      ? entry.initials.indexOf(normalized)
      : mixedInitialPosition(entry, normalized, initialPositions);
    if (position >= 0) {
      nameRank = position === 0 ? (entry.name.length === normalized.length ? 6 : 7) : 8;
    }
  }
  if (nameRank >= 0 && (rank < 0 || nameRank < rank)) rank = nameRank;
  if (rank < 0 && (entry.exchange.includes(normalized) || entry.type.includes(normalized))) rank = 9;
  return rank;
}

/** Rank only public search fields; stable IDs are selection identities, not keywords. */
export function searchSecurityIndex(
  index: SecuritySearchIndex,
  query: string,
  limit = SEARCH_RESULT_LIMIT,
): { items: SearchMenuItem[]; total: number } {
  const resultLimit = Math.max(0, Math.min(index.length,
    Number.isNaN(limit) ? SEARCH_RESULT_LIMIT : Math.floor(limit)));
  const prepared = prepareQuery(query);
  if (!prepared.normalized) {
    return { items: index.slice(0, resultLimit).map(entry => entry.item), total: index.length };
  }

  const tokens = query.trim().split(/\s+/u).map(prepareQuery);
  // Each score bucket retains at most the requested limit. We count every
  // match, but never sort or materialize the entire matching dataset.
  const buckets: SearchMenuItem[][] = Array.from({ length: RANK_COUNT }, () => []);
  let total = 0;

  for (const entry of index) {
    let rank = entryRank(entry, prepared);
    // Preserve spaces within a name first. If that does not match, every word
    // must match a public field on this same security (e.g. 삼성 005930).
    if (rank < 0 && tokens.length > 1) {
      let bestRank = RANK_COUNT;
      let codeRank = RANK_COUNT;
      for (const token of tokens) {
        const tokenRank = entryRank(entry, token);
        if (tokenRank < 0) {
          bestRank = -1;
          break;
        }
        bestRank = Math.min(bestRank, tokenRank);
        if (token.codeOnly) codeRank = Math.min(codeRank, tokenRank);
      }
      if (bestRank >= 0) {
        rank = codeRank < RANK_COUNT ? codeRank : bestRank;
      }
    }

    if (rank < 0) continue;
    total++;
    if (buckets[rank].length < resultLimit) buckets[rank].push(entry.item);
  }

  const items: SearchMenuItem[] = [];
  for (const bucket of buckets) {
    for (const item of bucket) {
      if (items.length === resultLimit) return { items, total };
      items.push(item);
    }
  }
  return { items, total };
}
