import { DetailInformation } from '@/components/detail-information';
import { getCompanyAggregatedMarketcap } from '@/lib/data/company';
import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from "next";
import { getSecurityByCode, getCompanySecurities } from "@/lib/data/security";
import { getTopSecurityCodesByMetric } from "@/lib/select";
import { siteConfig } from "@/config/site";

/**
 * Props for Security Detail Page
 */
interface SecurityDetailPageProps {
  params: Promise<{ secCode: string }>;
}

/**
 * Generate metadata for the security detail page
 */
export async function generateMetadata({ params }: SecurityDetailPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: `종목을 찾을 수 없습니다`,
      description: "요청하신 종목을 찾을 수 없습니다.",
    };
  }

  const canonical = `${siteConfig.url}/security/${secCode}/`;

  return {
    alternates: { canonical },
    openGraph: { ...(await parent).openGraph, url: canonical },
    title: `${security.korName || security.name} 종목 정보`,
    description: `${security.korName || security.name}의 상세 정보, 시가총액, PER, PBR 등 투자 지표를 확인하세요.`,
  };
}

/**
 * Generate static params for all security pages
 * This ensures all security pages are pre-rendered at build time
 */
export async function generateStaticParams() {
  const securityCodes = await getTopSecurityCodesByMetric('marketcap');

  return securityCodes.map((secCode) => ({
    secCode,
  }));
}

/**
 * Security Detail Page
 * Displays comprehensive information for a specific security
 */
export default async function SecurityDetailPage({ params }: SecurityDetailPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    notFound();
  }

  const [companySecs, companyMarketcapData] = await Promise.all([
    security.companyId ? getCompanySecurities(security.companyId) : Promise.resolve([]),
    security.companyId ? getCompanyAggregatedMarketcap(security.companyId) : Promise.resolve(null),
  ]);
  return <>

    <DetailInformation secCode={secCode} security={security} company={false}
      companySecs={companySecs} companyMarketcapData={companyMarketcapData} />
  </>;
}
