import { RestoredSecurityDetail, type DetailSearch } from '@/components/restored-detail-page';
import { securityMetadata } from '@/lib/business-metadata';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ secCode: string }> }) {
  return securityMetadata((await params).secCode, 'dps');
}

export default async function Page({ params, searchParams }: {
  params: Promise<{ secCode: string }>;
  searchParams: Promise<DetailSearch>;
}) {
  const { secCode } = await params;
  return <RestoredSecurityDetail code={secCode} metric="dps" search={await searchParams} />;
}
