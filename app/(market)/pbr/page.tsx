import { readPageSearch } from '@/lib/static-page-search';
import { PublishedRankingPage } from '@/components/published-ranking-page';
import type { RankingSearch } from '@/lib/ranking-view';
import { rankingMetadata } from '@/lib/business-metadata';


export async function generateMetadata({ searchParams }: { searchParams: Promise<RankingSearch> }) {
  return rankingMetadata('pbr', '/pbr', await readPageSearch(searchParams));
}

export default async function Page({ searchParams }: {
  searchParams: Promise<RankingSearch>;
}) {
  return <PublishedRankingPage metric="pbr" search={await readPageSearch(searchParams)} />;
}
