import { toDataDTO, type DataDTO } from "./dto";

export type CachedResult<Value> = DataDTO<Value>;
export const DATA_REVALIDATE_SECONDS = 0;
export const STATIC_CODES_REVALIDATE_SECONDS = 0;
export const EXPORT_CACHE_MAX_ENTRIES = 0;

/** Current result rows are mutable. Always read them with their current header. */
export function cachedData<Args extends unknown[], Result>(
  query: (...args: Args) => Promise<Result>,
  _key: string,
  _tags: string[],
  _options: { revalidate?: number } = {},
): (...args: Args) => Promise<DataDTO<Result>> {
  void _options;
  return async (...args: Args) => toDataDTO(await query(...args));
}
