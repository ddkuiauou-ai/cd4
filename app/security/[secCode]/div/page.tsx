import { isStaticBuild, getStaticRouteParams } from '@/lib/static-build/server';
import { readPageSearch } from '@/lib/static-page-search';
import { RestoredSecurityDetail, type DetailSearch } from '@/components/restored-detail-page';
import { securityMetadata } from '@/lib/business-metadata';


export const generateStaticParams = isStaticBuild() ? async () => getStaticRouteParams('security') : undefined;

export async function generateMetadata({ params }: { params: Promise<{ secCode: string }> }) {
  return securityMetadata((await params).secCode, 'div');
}

export default async function Page({ params, searchParams }: {
  params: Promise<{ secCode: string }>;
  searchParams: Promise<DetailSearch>;
}) {
  const { secCode } = await params;
  return <RestoredSecurityDetail code={secCode} metric="div" search={await readPageSearch(searchParams)} />;
}
