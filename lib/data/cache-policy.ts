import { unstable_cache } from "next/cache";

// Do not reuse legacy empty results or Date-shaped entries after the upgrade.
const CACHE_NAMESPACE = "financial-data-v3";
export const DATA_REVALIDATE_SECONDS = 300;
export const STATIC_CODES_REVALIDATE_SECONDS = 86400;
export const EXPORT_CACHE_MAX_ENTRIES = 32;

// unstable_cache stores JSON. Normalize before returning on a miss as well, so
// callers receive the same DTO in development, static builds and cache hits.
export type CachedResult<Value> = Value extends Date
  ? string
  : Value extends Array<infer Item>
    ? Array<CachedResult<Item>>
    : Value extends object
      ? { [Key in keyof Value]: CachedResult<Value[Key]> }
      : Value;

function toCacheDTO<Value>(value: Value): CachedResult<Value> {
  if (value === undefined) return value as CachedResult<Value>;
  return JSON.parse(JSON.stringify(value)) as CachedResult<Value>;
}

export function cachedData<Args extends unknown[], Result>(
  query: (...args: Args) => Promise<Result>,
  key: string,
  tags: string[],
  options: { revalidate?: number } = {},
): (...args: Args) => Promise<CachedResult<Result>> {
  const read = async (...args: Args) => toCacheDTO(await query(...args));
  // Local verification should always read the current database state.
  if (process.env.NODE_ENV === "development") return read;

  const outputMode = process.env.NEXT_OUTPUT_MODE?.toLowerCase() === "export"
    ? "export"
    : "standalone";

  if (outputMode === "export") {
    // Export has no runtime revalidation. Read this build's DB snapshot instead
    // of reusing persistent server entries, and deduplicate within each worker.
    // Bound retention because detail queries can include large history arrays.
    const entries = new Map<string, Promise<CachedResult<Result>>>();
    return (...args: Args) => {
      const invocation = JSON.stringify(args);
      const existing = entries.get(invocation);
      if (existing) {
        entries.delete(invocation);
        entries.set(invocation, existing);
        return existing;
      }

      const pending = read(...args).catch((error: unknown) => {
        if (entries.get(invocation) === pending) entries.delete(invocation);
        throw error;
      });
      entries.set(invocation, pending);
      if (entries.size > EXPORT_CACHE_MAX_ENTRIES) {
        entries.delete(entries.keys().next().value!);
      }
      return pending;
    };
  }

  return unstable_cache(read, [CACHE_NAMESPACE, outputMode, key, query.toString()], {
    revalidate: options.revalidate ?? DATA_REVALIDATE_SECONDS,
    tags,
  });
}
