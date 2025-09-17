// Mixed pagination helpers for marketcap listings
// Rule: page 1 => 20 items, page >= 2 => 100 items each

export function computeMixedPagination(page: number) {
  const p = Math.max(1, Math.floor(page) || 1);
  if (p === 1) {
    return { page: 1, pageSize: 20, limit: 20, skip: 0 };
  }
  const limit = 100;
  const skip = 20 + (p - 2) * 100;
  return { page: p, pageSize: limit, limit, skip };
}

export function computeTotalPagesMixed(totalCount: number) {
  const count = Math.max(0, Math.floor(totalCount) || 0);
  if (count === 0) return 1;
  if (count <= 20) return 1;
  const remaining = count - 20;
  return 1 + Math.ceil(remaining / 100);
}

