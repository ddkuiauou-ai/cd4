import { isStaticBuild, getStaticRankingParams } from '@/lib/static-build/server';
import { readPageSearch } from '@/lib/static-page-search';
import { PublishedRankingPage } from '@/components/published-ranking-page';
import type { RankingSearch } from '@/lib/ranking-view';
import { parseRankingPageSegment, scopedRankingPagePath } from '@/lib/ranking-page-address';
import { rankingMetadata } from '@/lib/business-metadata';


export const generateStaticParams = isStaticBuild() ? async () => getStaticRankingParams('marketcap', 'security') : undefined;

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ page: string }>; searchParams: Promise<RankingSearch>;
}) {
  const { page } = await params;
  const { page: number, scopeKey } = parseRankingPageSegment(page);
  const path = Number.isSafeInteger(number) && number > 0 ? scopedRankingPagePath('/marketcap', scopeKey ?? 'krx-all', number) : '/marketcap';
  const search = await readPageSearch(searchParams);
  return rankingMetadata('marketcap', path, scopeKey ? { ...search, scope: undefined } : search);
}

export default async function Page({ params, searchParams }: {
  params: Promise<{ page: string }>;
  searchParams: Promise<RankingSearch>;
}) {
  const { page } = await params;
  const { page: number, scopeKey } = parseRankingPageSegment(page);
  return <PublishedRankingPage metric="marketcap" page={number} documentScope={scopeKey} search={await readPageSearch(searchParams)} />;
}
