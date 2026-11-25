import { connection } from 'next/server';
import { getMarketCsvMetadata, getMarketCsvResponse } from '@/lib/data/market-csv';
import { MARKET_CSV_EMPTY_PARAM } from '@/lib/csv/market';
import { isStaticBuild } from '@/lib/static-build/server';

export const revalidate = false;

export const generateStaticParams = isStaticBuild() ? async () => {
  const csv = await getMarketCsvMetadata();
  return [{ file: csv ? `${csv.date}.csv` : MARKET_CSV_EMPTY_PARAM }];
} : undefined;

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }) {
  if (!isStaticBuild()) await connection();
  const { file } = await context.params;
  return getMarketCsvResponse(file);
}
