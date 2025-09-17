import { notFound } from "next/navigation";
import { ChevronRightIcon, BarChartIcon } from "@radix-ui/react-icons";
import { TrendingUp, TrendingDown, Minus, Table } from "lucide-react";
import Link from "next/link";
import { Balancer } from "react-wrap-balancer";
import { cn } from "@/lib/utils";
import { getSecurityByCode, getCompanySecurities, getSecurityMetricsHistory } from "@/lib/data/security";
import { getAllSecurityCodes } from "@/lib/select";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { MidNavWrapper } from "@/components/mid-nav-wrapper";
import ChartDPS from "@/components/chart-DPS";
import ListDPS from "@/components/list-DPS";
import CardMarketcap from "@/components/card-marketcap";
import CardMarketcapDetail from "@/components/card-marketcap-detail";
import RankHeader from "@/components/header-rank";
import { MarketcapPager } from "@/components/pager-marketcap";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";

/**
 * Props for Security DPS Page
 */
/**
 * Generate static params for all security pages (SSG)
 */
export async function generateStaticParams() {
  try {
    const securityCodes = await getAllSecurityCodes();

    return securityCodes.map((secCode) => ({
      secCode: secCode,
    }));
  } catch (error) {
    console.error("[GENERATE_STATIC_PARAMS] Error generating security params:", error);
    return [];
  }
}


interface SecurityDPSPageProps {
  params: Promise<{ secCode: string }>;
}

/**
 * Generate metadata for the security DPS page
 */
export async function generateMetadata({ params }: SecurityDPSPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: "종목을 찾을 수 없습니다 - CD3",
      description: "요청하신 종목을 찾을 수 없습니다.",
    };
  }

  return {
    title: `${security.korName || security.name} 주당배당금 DPS - CD3`,
    description: `${security.korName || security.name}의 연도별 주당배당금(DPS) 변동 차트와 상세 분석 정보를 확인하세요.`,
  };
}

/**
 * Security DPS Page
 * Displays DPS data and charts for a specific security
 */
export default async function SecurityDPSPage({ params }: SecurityDPSPageProps) {
  const { secCode } = await params;

  console.log('=== SECURITY DPS PAGE DEBUG ===');
  console.log('secCode:', secCode);

  const security = await getSecurityByCode(secCode);
  console.log('Found security:', security?.securityId);

  if (!security) {
    console.log('Security not found');
    notFound();
  }

  // Get related securities for company navigation
  const securities = security.companyId ? await getCompanySecurities(security.companyId) : [];
  const commonSecurities = securities.filter((sec) => sec.type === "보통주");
  console.log('Common securities found:', commonSecurities?.length || 0);

  // Get DPS data
  const data = await getSecurityMetricsHistory(security.securityId);
  console.log('DPS data found:', data?.length || 0);

  // 🔥 CD3 방어적 프로그래밍: 데이터가 없는 경우 404 처리
  if (!data || data.length === 0) {
    console.log('No DPS data found');
    notFound();
  }

  // Get search data for LayoutWrapper
  const searchData = securities.map(sec => ({
    securityId: sec.securityId,
    companyId: sec.companyId,
    korName: sec.korName || sec.name,
    type: sec.type,
    exchange: sec.exchange
  }));

  const result = data.map((item) => ({
    date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : item.date,
    value: item.dps,
  })).filter((item): item is { date: string; value: number } => item.value !== null);

  return (
    <LayoutWrapper searchData={searchData}>
      <main className="relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px]">
        <div className="mx-auto w-full min-w-0">
          {/* 🔥 페이지 헤더 */}
          <div className="mb-8 space-y-6">
            {/* 🔥 브레드크럼 */}
            <div className="mb-4 flex items-center space-x-1 text-sm text-muted-foreground">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                {security.companyId ? "기업" : "증권"}
              </div>
              <ChevronRightIcon className="h-4 w-4" />
              <div className="font-medium text-muted-foreground">
                {commonSecurities[0] ? (
                  <Link
                    href={`/company/marketcaps?search=${encodeURIComponent(commonSecurities[0].korName)}`}
                    className="hover:text-primary underline underline-offset-4"
                  >
                    {commonSecurities[0].korName}
                  </Link>
                ) : (
                  security.korName || security.name
                )}
              </div>
              <ChevronRightIcon className="h-4 w-4" />
              <div className="font-medium text-muted-foreground">
                {security.type}
              </div>
              <ChevronRightIcon className="h-4 w-4" />
              <div className="font-medium text-foreground">주당배당금</div>
            </div>

            {/* 🔥 제목 영역 */}
            <div className="space-y-2">
              <h1 className={cn("scroll-m-20 text-4xl font-bold tracking-tight")}>
                {security.companyId ? (
                  <Link
                    href={`/company/marketcaps?search=${encodeURIComponent(security.company?.korName || security.korName || security.name)}`}
                    className="hover:underline"
                  >
                    {security.company?.korName || security.korName || security.name}
                  </Link>
                ) : (
                  security.korName || security.name
                )}
                <span className="text-muted-foreground ml-2">
                  {security.type}
                </span>
              </h1>
              <p className="text-lg text-muted-foreground">
                <Balancer>{security.korName || security.name}의 주당배당금 Dividend Per Shares</Balancer>
              </p>
            </div>
          </div>

          {commonSecurities.length > 0 && (
            <RankHeader
              rank={commonSecurities[0].company?.marketcapRank || 1}
              marketcap={commonSecurities[0].marketcap || undefined}
              price={commonSecurities[0].prices?.[0]?.close}
              exchange={commonSecurities[0].exchange}
            />
          )}

          {/* 🔥 Unified Financial Navigation */}
          <div className="mt-8 mb-8">
            <CompanyFinancialTabs secCode={secCode} />
          </div>

          <div className="pb-12 pt-8">
            <CardMarketcapDetail securities={securities as any} />

            <h2
              className="font-heading mt-12 scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0"
              id="securities"
            >
              증권
              <Link
                href="#securities"
                className="font-medium underline underline-offset-4 subheading-anchor"
              >
                <span className="icon icon-link"></span>
              </Link>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-8">
              {securities?.filter(s => s.companyId).map((security) => (
                <CardMarketcap
                  key={security.securityId}
                  security={security as any}
                  currentMetric="dps"
                  isCompanyPage={false}
                />
              ))}
            </div>
          </div>

          <MidNavWrapper sectype={security.type} />
          <div className="mt-16"></div>

          {/* 🔥 DPS 차트 섹션 */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <BarChartIcon className="h-5 w-5 text-blue-600" />
              <h2 className="text-2xl font-bold">주당배당금 차트</h2>
            </div>
            <ChartDPS
              data={result}
              format="formatNumber"
              formatTooltip="formatNumberTooltip"
            />
          </section>

          <div className="mt-6 sm:mt-12"></div>

          {/* 🔥 DPS 테이블 섹션 */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Table className="h-5 w-5 text-green-600" />
              <h2 className="text-2xl font-bold">연도별 데이터</h2>
            </div>
            <ListDPS data={result} />
          </section>

          <MarketcapPager rank={security?.company?.marketcapRank || 1} />
        </div>
      </main>
    </LayoutWrapper>
  );
}
