import { DetailInformation } from '@/components/detail-information';
import { getCompanyAggregatedMarketcap } from '@/lib/data/company';
import { notFound } from "next/navigation";
import { getSecurityByCode, getCompanySecurities } from "@/lib/data/security";
import { getTopCompanyCodesByMetric } from "@/lib/select";
import { corporationData } from "@/lib/structured-data";

/**
 * Props for Company Detail Page
 */
interface CompanyDetailPageProps {
  params: Promise<{ secCode: string }>;
}

/**
 * Generate metadata for the company detail page
 */
export async function generateMetadata({ params }: CompanyDetailPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: "기업을 찾을 수 없습니다",
      description: "요청하신 기업을 찾을 수 없습니다. 천하제일 단타대회에서 다른 기업 정보를 확인하세요.",
    };
  }

  const companyName = security.korName || security.name;
  const latestPrice = security.prices?.[0];
  const marketCap = security.company?.marketcap;

  // 재무 지표 정보 구성
  const financialInfo = [];
  if (latestPrice?.close) {
    financialInfo.push(`현재가 ${latestPrice.close.toLocaleString()}원`);
  }
  if (marketCap) {
    financialInfo.push(`시가총액 ${marketCap.toLocaleString()}원`);
  }
  if (latestPrice?.rate) {
    const rateText = latestPrice.rate > 0 ? `+${latestPrice.rate.toFixed(2)}%` : `${latestPrice.rate.toFixed(2)}%`;
    financialInfo.push(`등락률 ${rateText}`);
  }

  const financialString = financialInfo.length > 0 ? ` (${financialInfo.join(', ')})` : '';

  const title = `${companyName} 기업 정보`;
  const description = `${companyName}(${security.ticker})의 실시간 시가총액, 현재가, 재무지표 분석${financialString}. PER, PBR, BPS, EPS, 배당수익률 등 투자 정보 제공. 천하제일 단타대회에서 전문 기업 분석을 확인하세요.`;

  return {
    title,
    description,
    keywords: [
      companyName,
      security.ticker,
      `${companyName} 시가총액`,
      `${companyName} 주가`,
      `${companyName} 재무제표`,
      `${companyName} PER`,
      `${companyName} PBR`,
      `${companyName} 투자`,
      `${companyName} 분석`,
      '기업 정보',
      '주식 분석',
      '재무 지표',
      '시가총액',
      '천하제일 단타대회',
      '천단',
    ],
    openGraph: {
      title,
      description,
      url: `https://www.chundan.xyz/company/${secCode}/`,
      siteName: "천하제일 단타대회",
      images: [
        {
          url: `https://www.chundan.xyz/images/round/${companyName}.png`,
          width: 400,
          height: 400,
          alt: `${companyName} 기업 로고`,
          type: 'image/png',
        },
      ],
      locale: 'ko_KR',
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`https://www.chundan.xyz/images/round/${companyName}.png`],
      site: '@chundan_xyz',
      creator: '@chundan_xyz',
    },
    alternates: {
      canonical: `https://www.chundan.xyz/company/${secCode}/`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  };
}

/**
 * Generate static params for all company pages
 * This ensures all company pages are pre-rendered at build time
 */
export async function generateStaticParams() {
  const companyCodes = await getTopCompanyCodesByMetric('marketcap');

  return companyCodes.map((secCode) => ({
    secCode,
  }));
}

/**
 * Company Detail Page
 * Displays comprehensive company information for a specific security
 */
export default async function CompanyDetailPage({ params }: CompanyDetailPageProps) {
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
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(corporationData(security)) }} />
    <DetailInformation secCode={secCode} security={security} company={true}
      companySecs={companySecs} companyMarketcapData={companyMarketcapData} />
  </>;
}
