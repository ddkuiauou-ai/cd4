import { notFound } from "next/navigation";
import { getSecurityByCode } from "@/lib/data/security";
import { getTopCompanyCodesByMetric } from "@/lib/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BaseImage from "@/components/BaseImage";
import Exchange from "@/components/exchange";
import Link from "next/link";
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
      title: "기업을 찾을 수 없습니다 - 천하제일 단타대회",
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

  const title = `${companyName} 시가총액, 주가, 재무정보 - 천하제일 단타대회`;
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
      url: `https://www.chundan.xyz/company/${secCode}`,
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
      canonical: `https://www.chundan.xyz/company/${secCode}`,
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

  // Find the latest price data
  const latestPrice = security.prices?.[0];

  // Check if price is positive or negative
  const isPositive = latestPrice?.rate != null && latestPrice.rate > 0;

  return (
    <>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(corporationData(security)),
          }}
        />
      </head>
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <BaseImage
              alt={security.korName || security.name}
              height={64}
              width={64}
              src={`/images/round/${security.korName || security.name}.png`}
              className="rounded-full"
            />
            <div>
              <h1 className="text-3xl font-bold">{security.korName || security.name}</h1>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline">{security.ticker}</Badge>
                <Exchange exchange={security.exchange} />
              </div>
            </div>
          </div>
        </div>

        {/* Company Overview Card */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>기업 개요</CardTitle>
              <CardDescription>기본 정보</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">종목코드</span>
                  <span className="font-medium">{security.ticker}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">거래소</span>
                  <Exchange exchange={security.exchange} />
                </div>
              </div>
            </CardContent>
          </Card>

          {latestPrice && (
            <Card>
              <CardHeader>
                <CardTitle>현재 주가 정보</CardTitle>
                <CardDescription>최신 거래 데이터</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">현재가</span>
                    <span className="font-medium">{latestPrice.close?.toLocaleString()}원</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">등락률</span>
                    <span className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {latestPrice.rate != null ? `${latestPrice.rate > 0 ? '+' : ''}${latestPrice.rate.toFixed(2)}%` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">거래량</span>
                    <span className="font-medium">{latestPrice.volume?.toLocaleString() || '—'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>주가 정보</CardTitle>
              <CardDescription>최근 거래 정보</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {latestPrice && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">현재가</span>
                      <span className="font-medium">{latestPrice.close.toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">거래량</span>
                      <span className="font-medium">{latestPrice.volume.toLocaleString()}</span>
                    </div>
                    {latestPrice.rate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">등락률</span>
                        <span className={`font-medium ${latestPrice.rate > 0 ? 'text-green-600' : latestPrice.rate < 0 ? 'text-red-600' : ''}`}>
                          {latestPrice.rate > 0 ? '+' : ''}{latestPrice.rate.toFixed(2)}%
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation to Metric Pages */}
        <Card>
          <CardHeader>
            <CardTitle>상세 분석</CardTitle>
            <CardDescription>기업별 주요 지표 분석</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Link href={`/company/${secCode}/marketcap`} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="font-medium">시가총액</div>
                <div className="text-sm text-muted-foreground">Market Cap</div>
              </Link>
              <Link href={`/company/${secCode}/per`} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="font-medium">주가수익비율</div>
                <div className="text-sm text-muted-foreground">PER</div>
              </Link>
              <Link href={`/company/${secCode}/pbr`} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="font-medium">주가순자산비율</div>
                <div className="text-sm text-muted-foreground">PBR</div>
              </Link>
              <Link href={`/company/${secCode}/div`} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="font-medium">배당수익률</div>
                <div className="text-sm text-muted-foreground">Dividend Yield</div>
              </Link>
              <Link href={`/company/${secCode}/dps`} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="font-medium">주당배당금</div>
                <div className="text-sm text-muted-foreground">DPS</div>
              </Link>
              <Link href={`/company/${secCode}/bps`} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="font-medium">주당순자산가치</div>
                <div className="text-sm text-muted-foreground">BPS</div>
              </Link>
              <Link href={`/company/${secCode}/eps`} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="font-medium">주당순이익</div>
                <div className="text-sm text-muted-foreground">EPS</div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
