import { connection } from 'next/server';
import { isStaticBuild, getStaticRankingCsv } from '@/lib/static-build/server';
import { createRankingCsvResponse } from '@/lib/data/ranking-export';

export const revalidate = false;

export async function GET(request: Request) {
  if (isStaticBuild()) {
    const { body, headers, status } = getStaticRankingCsv('security', 'pbr');
    return new Response(body, { headers, status });
  }
  await connection();
  const query = new URL(request.url).searchParams;
  return createRankingCsvResponse('security', 'pbr', query.get('revision') ?? undefined, query.get('scope') ?? 'krx-all');
}
