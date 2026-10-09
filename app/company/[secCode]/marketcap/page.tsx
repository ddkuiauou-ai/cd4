import { RestoredCompanyDetail, type DetailSearch } from '@/components/restored-detail-page';
import { companyMetadata } from '@/lib/business-metadata';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ secCode: string }> }) {
  return companyMetadata((await params).secCode, true);
}

export default async function Page({ params, searchParams }: { params: Promise<{ secCode: string }>; searchParams: Promise<DetailSearch> }) {
  return <RestoredCompanyDetail code={(await params).secCode} search={await searchParams} />;
}
