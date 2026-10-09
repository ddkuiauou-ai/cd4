import { connection } from 'next/server';
import { isStaticBuild, getStaticRankingCsv } from '@/lib/static-build/server';
import { createRankingCsvResponse } from '@/lib/data/ranking-export';

export const revalidate = false;

export async function GET(request: Request) {
  if (isStaticBuild()) {
    const { body, headers, status } = getStaticRankingCsv('company', 'marketcap');
    return new Response(body, { headers, status });
  }
  await connection();
  const query = new URL(request.url).searchParams;
  return createRankingCsvResponse('company', 'marketcap', query.get('revision') ?? undefined);
}
