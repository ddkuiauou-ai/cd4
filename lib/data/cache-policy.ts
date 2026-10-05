import { unstable_cache } from "next/cache";

// A new namespace stops old empty results from surviving this recovery.
const CACHE_NAMESPACE = "financial-data-v2";
export const DATA_REVALIDATE_SECONDS = 300;

export function cachedData<Args extends unknown[], Result>(
  query: (...args: Args) => Promise<Result>,
  key: string,
  tags: string[],
): (...args: Args) => Promise<Result> {
  // Local verification should always read the current database state.
  if (process.env.NODE_ENV === "development") return query;

  return unstable_cache(query, [CACHE_NAMESPACE, key], {
    revalidate: DATA_REVALIDATE_SECONDS,
    tags,
  });
}
