import { PublishedRankingPage } from '@/components/published-ranking-page';
import type { RankingSearch } from '@/lib/ranking-view';
import { rankingMetadata } from '@/lib/business-metadata';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ page: string }>; searchParams: Promise<RankingSearch>;
}) {
  const { page } = await params;
  const number = Number(page);
  const path = Number.isSafeInteger(number) && number > 1 ? `/dps/${number}` : '/dps';
  return rankingMetadata('dps', path, await searchParams);
}

export default async function Page({ params, searchParams }: {
  params: Promise<{ page: string }>;
  searchParams: Promise<RankingSearch>;
}) {
  const { page } = await params;
  return <PublishedRankingPage metric="dps" page={Number(page)} search={await searchParams} />;
}
