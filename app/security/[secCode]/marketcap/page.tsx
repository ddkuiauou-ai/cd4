import { notFound } from "next/navigation";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Balancer } from "react-wrap-balancer";
import { cn } from "@/lib/utils";
import { getSecurityByCode, getCompanySecurities } from "@/lib/data/security";
import { getMarketCapHistoryBySecurityId as getMarketcapsBySecId } from "@/lib/data/security";
import { getSecurityRank } from "@/lib/data/ranking";
import { getAllSecurityCodes } from "@/lib/select";
import { MidNavWrapper } from "@/components/mid-nav-wrapper";
import ChartMarketcap from "@/components/chart-marketcap";
import ListMarketcap from "@/components/list-marketcap";
import CardMarketcap from "@/components/card-marketcap";
import CardMarketcapDetail from "@/components/card-marketcap-detail";
import RankHeader from "@/components/header-rank";
import { MarketcapPager } from "@/components/pager-marketcap";
import { SecMarketcapPager } from "@/components/pager-marketcap-security";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";

/**
 * Props for Security Marketcap Page
 */
interface SecurityMarketcapPageProps {
  params: Promise<{ secCode: string }>;
}

/**
 * Generate static params for all security marketcap pages
 * This ensures all security marketcap pages are pre-rendered at build time
 */
export async function generateStaticParams() {
  const securityCodes = await getAllSecurityCodes();

  return securityCodes.map((secCode) => ({
    secCode,
  }));
}

/**
 * Generate metadata for the security marketcap page
 */
export async function generateMetadata({ params }: SecurityMarketcapPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: "종목을 찾을 수 없습니다 - CD3",
      description: "요청하신 종목을 찾을 수 없습니다.",
    };
  }

  return {
    title: `${security.korName || security.name} 시가총액 - CD3`,
    description: `${security.korName || security.name}의 시가총액 변동 추이와 상세 분석 정보를 확인하세요.`,
  };
}

/**
 * Security Marketcap Page
 * Displays marketcap data and charts for a specific security
 */
export default async function SecurityMarketcapPage({ params }: SecurityMarketcapPageProps) {
  const { secCode } = await params;

  console.log('=== SECURITY MARKETCAP PAGE DEBUG ===');
  console.log('secCode:', secCode);

  const security = await getSecurityByCode(secCode);
  console.log('Found security:', security?.securityId);

  if (!security) {
    console.log('Security not found');
    notFound();
  }

  // Get marketcap ranking for this security
  const marketcapRank = await getSecurityRank(security.securityId, 'marketcap');

  // Get related securities for company navigation
  const securities = security.companyId ? await getCompanySecurities(security.companyId) : [];
  const commonSecurities = securities.filter((sec) => sec.type === "보통주");
  console.log('Common securities found:', commonSecurities?.length || 0);

  // Get marketcap data
  const marketcaps = await getMarketcapsBySecId(security.securityId);
  console.log('Marketcap data found:', marketcaps?.length || 0);

  // 🔥 CD3 방어적 프로그래밍: 데이터가 없는 경우 404 처리
  if (!marketcaps || marketcaps.length === 0) {
    console.log('No marketcap data found');
    notFound();
  }

  // Transform marketcap data for chart
  const chartData = marketcaps
    .filter((item) => item.marketcap !== null)
    .map((item) => ({
      date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date),
      value: item.marketcap as number,
    }));

  // Transform marketcap data for list component
  const listData = marketcaps
    .filter((item) => item.marketcap !== null)
    .map((item) => ({
      date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date),
      value: item.marketcap as number,
    }));

  return (
    <>
      <main className="relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px]">
        <div className="mx-auto w-full min-w-0">
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
            <div className="font-medium text-foreground">시가총액</div>
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
              <Balancer>{security.korName || security.name}의 시가총액</Balancer>
            </p>
          </div>

          {/* 🔥 RankHeader 컴포넌트 */}
          {commonSecurities.length > 0 ? (
            <RankHeader
              rank={commonSecurities[0].company?.marketcapRank || 1}
              marketcap={commonSecurities[0].marketcap || undefined}
              price={commonSecurities[0].prices?.[0]?.close}
              exchange={commonSecurities[0].exchange}
            />
          ) : (
            <RankHeader
              rank={marketcapRank || 1}
              marketcap={security.marketcap || 0}
              price={security.prices?.[0]?.close || 0}
              exchange={security.exchange || ""}
            />
          )}

          <div className="pb-12 pt-8">
            <CompanyFinancialTabs secCode={secCode} />

            {/* 🔥 CardMarketcapDetail */}
            {securities.length > 0 ? (
              <CardMarketcapDetail securities={securities as any} />
            ) : (
              <CardMarketcapDetail securities={[{ ...security, marketcaps: [] }] as any} />
            )}

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

            {/* 🔥 증권 카드 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mt-8">
              {securities && securities.length > 0 ? (
                securities.filter(s => s.companyId).map((sec) => (
                  <CardMarketcap
                    key={sec.securityId}
                    security={sec as any}
                    currentMetric="marketcap"
                    isCompanyPage={false}
                  />
                ))
              ) : (
                <CardMarketcap
                  security={security as any}
                  currentMetric="marketcap"
                  isCompanyPage={false}
                />
              )}
            </div>
          </div>

          {/* 🔥 MidNav */}
          <MidNavWrapper sectype={security.type || "보통주"} />
          <div className="mt-16"></div>

          {/* 🔥 차트 컴포넌트 */}
          <ChartMarketcap
            data={chartData}
            format="formatNumber"
            formatTooltip="formatNumberTooltip"
          />
          <div className="mt-6 sm:mt-12"></div>

          {/* 🔥 리스트 컴포넌트 */}
          <ListMarketcap data={listData} />

          {/* 🔥 페이저 */}
          {security.companyId ? (
            <MarketcapPager rank={security.company?.marketcapRank || 1} />
          ) : (
            <SecMarketcapPager rank={marketcapRank || 1} />
          )}
        </div>

        {/* 🔥 사이드바 */}
        <div className="hidden xl:block">
          <div className="sticky top-16 -mt-10 pt-10">
            <CardMarketcap
              security={security as any}
              currentMetric="marketcap"
              isCompanyPage={false}
            />
          </div>
        </div>
      </main>
    </>
  );
}
