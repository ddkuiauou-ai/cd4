import { connection } from "next/server";

type PageSearch = Record<string, string | string[] | undefined>;

/** Export renders the default snapshot; browser adapters own URL queries. */
export async function readPageSearch(search: Promise<PageSearch>): Promise<PageSearch> {
  if (process.env.NEXT_OUTPUT_MODE?.toLowerCase() === "export") return {};
  await connection();
  return search;
}
