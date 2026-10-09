import { createRankingCsvResponse } from '@/lib/data/ranking-export';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  return createRankingCsvResponse('security', 'div', query.get('revision') ?? undefined, query.get('scope') ?? 'krx-all');
}
