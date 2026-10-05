import { createRankingCsvResponse } from "@/lib/data/ranking-export";

export const dynamic = "force-static";
export const revalidate = 300;

export async function GET() {
  return createRankingCsvResponse("security", "dps");
}
