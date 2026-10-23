import Fuse from "fuse.js";
import { disassemble } from "es-hangul";
import type { SearchMenuItem } from "@/components/search-data";

const SUGGESTION_LIMIT = 5;
const MAX_FUZZINESS = 0.2;

interface TypoSearchEntry {
  item: SearchMenuItem;
  nameLength: number;
  jamoName: string;
}

export type SecurityTypoIndex = Fuse<TypoSearchEntry>;

function normalizeName(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/\s+/gu, "");
}

/** Build the optional name-only fallback once for each shared data snapshot. */
export function createSecurityTypoIndex(data: readonly SearchMenuItem[]): SecurityTypoIndex {
  const seen = new Set<string>();
  const entries: TypoSearchEntry[] = [];
  for (const item of data) {
    if (seen.has(item.securityId)) continue;
    seen.add(item.securityId);
    const name = normalizeName(item.korName);
    if (name) entries.push({ item, nameLength: name.length, jamoName: disassemble(name) });
  }

  return new Fuse(entries, {
    keys: ["jamoName"],
    threshold: MAX_FUZZINESS,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    includeScore: true,
    // Equally close names prefer the shorter security name before a longer
    // product containing it. Stable source order breaks any remaining tie.
    sortFn: (left, right) => left.score - right.score
      || entries[left.idx].nameLength - entries[right.idx].nameLength
      || left.idx - right.idx,
  });
}

/** Call only after direct search found nothing and Korean IME composition ended. */
export function searchSecurityTypos(index: SecurityTypoIndex, query: string): SearchMenuItem[] {
  if (query.length > 256) return [];
  const name = normalizeName(query);
  // Numeric identifiers, standalone/mixed initials and search operators keep
  // their direct-search meaning. Short fragments are too ambiguous to correct.
  if (name.length < 3 || name.length > 32 || !/^[a-z가-힣]+$/u.test(name)) return [];
  const pattern = disassemble(name);
  if (pattern.length > 64) return [];

  // A fixed percentage alone grows too permissive for long Korean names.
  // Keep the score budget near two jamo edits without implementing another
  // fuzzy matcher. Fuse owns substring matching, scoring and candidate order.
  const maximumScore = Math.min(MAX_FUZZINESS, 2 / pattern.length);
  return index.search(pattern, { limit: SUGGESTION_LIMIT })
    .filter(result => (result.score ?? 1) <= maximumScore)
    .map(result => result.item.item);
}
