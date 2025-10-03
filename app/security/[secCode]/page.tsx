import { notFound } from "next/navigation";
import { getSecurityByCode } from "@/lib/data/security";
import { getTopSecurityCodesByMetric } from "@/lib/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BaseImage from "@/components/BaseImage";
import Exchange from "@/components/exchange";
import Link from "next/link";

/**
 * Props for Security Detail Page
 */
interface SecurityDetailPageProps {
  params: Promise<{ secCode: string }>;
}

/**
 * Generate metadata for the security detail page
 */
export async function generateMetadata({ params }: SecurityDetailPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: "종목을 찾을 수 없습니다 - CD3",
      description: "요청하신 종목을 찾을 수 없습니다.",
    };
  }

  return {
    title: `${security.korName || security.name} 종목 정보 - CD3`,
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

  // Find the latest price data
  const latestPrice = security.prices?.[0];

  // Check if price is positive or negative
  const isPositive = latestPrice?.rate != null && latestPrice.rate > 0;

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col space-y-6">
        {/* Header Section */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center gap-4">
            <BaseImage
              alt={security.korName || security.name}
              className="rounded-full object-cover"
              height={64}
              width={64}
              src={`/images/round${security.name}.png`}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold">{security.korName || security.name}</h1>
                <Exchange exchange={security.exchange} />
                <Badge variant="secondary">{security.type}</Badge>
              </div>
              {security.name !== security.korName && (
                <p className="text-muted-foreground">{security.name}</p>
              )}
            </div>
          </div>

          {/* Price Information */}
          {latestPrice && (
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">현재가</p>
                    <p className="text-2xl font-bold">
                      {latestPrice.close?.toLocaleString()}원
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">등락율</p>
                    <p className={`text-lg font-semibold ${isPositive ? 'text-success' : 'text-danger'}`}>
                      {latestPrice.rate?.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">시가</p>
                    <p className="text-lg">{latestPrice.open?.toLocaleString()}원</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">기준일</p>
                    <p className="text-lg">
                      {new Date(latestPrice.date).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Navigation to Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>투자 지표</CardTitle>
            <CardDescription>
              다양한 투자 지표를 확인하여 투자 결정에 활용하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <Link
                href={`/security/${secCode}/marketcap`}
                className="p-4 rounded-lg border hover:bg-accent transition-colors text-center"
              >
                <div className="font-semibold">시가총액</div>
                <div className="text-sm text-muted-foreground">Market Cap</div>
              </Link>
              <Link
                href={`/security/${secCode}/per`}
                className="p-4 rounded-lg border hover:bg-accent transition-colors text-center"
              >
                <div className="font-semibold">PER</div>
                <div className="text-sm text-muted-foreground">주가수익비율</div>
              </Link>
              <Link
                href={`/security/${secCode}/pbr`}
                className="p-4 rounded-lg border hover:bg-accent transition-colors text-center"
              >
                <div className="font-semibold">PBR</div>
                <div className="text-sm text-muted-foreground">주가순자산비율</div>
              </Link>
              <Link
                href={`/security/${secCode}/bps`}
                className="p-4 rounded-lg border hover:bg-accent transition-colors text-center"
              >
                <div className="font-semibold">BPS</div>
                <div className="text-sm text-muted-foreground">주당순자산가치</div>
              </Link>
              <Link
                href={`/security/${secCode}/eps`}
                className="p-4 rounded-lg border hover:bg-accent transition-colors text-center"
              >
                <div className="font-semibold">EPS</div>
                <div className="text-sm text-muted-foreground">주당순이익</div>
              </Link>
              <Link
                href={`/security/${secCode}/dps`}
                className="p-4 rounded-lg border hover:bg-accent transition-colors text-center"
              >
                <div className="font-semibold">DPS</div>
                <div className="text-sm text-muted-foreground">주당배당금</div>
              </Link>
              <Link
                href={`/security/${secCode}/div`}
                className="p-4 rounded-lg border hover:bg-accent transition-colors text-center"
              >
                <div className="font-semibold">배당수익률</div>
                <div className="text-sm text-muted-foreground">Dividend Yield</div>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Company Information */}
        {security.company && (
          <Card>
            <CardHeader>
              <CardTitle>기업 정보</CardTitle>
              <CardDescription>
                {security.company.korName}에 대한 기본 정보
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {security.company.korName && (
                  <div>
                    <span className="font-medium">기업명: </span>
                    <Link
                      href={`/company/marketcaps?search=${encodeURIComponent(security.company.korName)}`}
                      className="text-primary hover:underline"
                    >
                      {security.company.korName}
                    </Link>
                  </div>
                )}
                {(security.company as any).sector && (
                  <div>
                    <span className="font-medium">섹터: </span>
                    {(security.company as any).sector}
                  </div>
                )}
                {security.company.industry && (
                  <div>
                    <span className="font-medium">업종: </span>
                    {security.company.industry}
                  </div>
                )}
                {security.company.establishedDate && (
                  <div>
                    <span className="font-medium">설립일: </span>
                    {new Date(security.company.establishedDate).toLocaleDateString('ko-KR')}
                  </div>
                )}
                {security.company.homepage && (
                  <div>
                    <span className="font-medium">홈페이지: </span>
                    <a
                      href={security.company.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      {security.company.homepage}
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
