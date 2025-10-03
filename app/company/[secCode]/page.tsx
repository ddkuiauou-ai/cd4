import { notFound } from "next/navigation";
import { getSecurityByCode } from "@/lib/data/security";
import { getTopCompanyCodesByMetric } from "@/lib/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BaseImage from "@/components/BaseImage";
import Exchange from "@/components/exchange";
import Link from "next/link";

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
      title: "기업을 찾을 수 없습니다 - CD3",
      description: "요청하신 기업을 찾을 수 없습니다.",
    };
  }

  return {
    title: `${security.korName || security.name} 기업 정보 - CD3`,
    description: `${security.korName || security.name}의 기업 개요, 재무 정보, 시가총액 등 투자 지표를 확인하세요.`,
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
  );
}
