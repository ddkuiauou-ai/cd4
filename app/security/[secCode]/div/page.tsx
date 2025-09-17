import { notFound } from "next/navigation";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import { Percent, TrendingUp, Building2, ArrowLeftRight, FileText } from "lucide-react";
import Link from "next/link";
import { Balancer } from "react-wrap-balancer";
import { cn } from "@/lib/utils";
import { getSecurityByCode, getCompanySecurities, getSecurityMetricsHistory } from "@/lib/data/security";
import { getSecuritySearchNames } from "@/lib/getSearch";
import { getAllSecurityCodes } from "@/lib/select";
import { getSecurityDivPage as getDividendYieldRankingData } from "@/lib/data/security";
import { MidNavWrapper } from "@/components/mid-nav-wrapper";
import ChartDIV from "@/components/chart-DIV";
import ListDIV from "@/components/list-DIV";
import CardMarketcap from "@/components/card-marketcap";
import CardMarketcapDetail from "@/components/card-marketcap-detail";
import RankHeader from "@/components/header-rank";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";
import { LayoutWrapper } from "@/components/layout-wrapper";

/**
 * Props for Security DIV Page
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


interface SecurityDIVPageProps {
  params: Promise<{ secCode: string }>;
}

/**
 * Generate metadata for the security DIV page
 */
export async function generateMetadata({ params }: SecurityDIVPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: "종목을 찾을 수 없습니다 - CD3",
      description: "요청하신 종목을 찾을 수 없습니다.",
    };
  }

  return {
    title: `${security.korName || security.name} 배당수익률 DIV - CD3`,
    description: `${security.korName || security.name}의 연도별 배당수익률(DIV) 변동 차트와 상세 분석 정보를 확인하세요.`,
  };
}

/**
 * Security DIV Page
 * Displays dividend yield data and charts for a specific security
 */
export default async function SecurityDIVPage({ params }: SecurityDIVPageProps) {
  const { secCode } = await params;

  console.log('=== SECURITY DIV PAGE DEBUG ===');
  console.log('secCode:', secCode);

  const security = await getSecurityByCode(secCode);
  console.log('Found security:', security?.securityId);

  if (!security) {
    console.log('Security not found');
    notFound();
  }

  // Get search data for LayoutWrapper
  const searchData = await getSecuritySearchNames();

  // Get related securities for company navigation
  const securities = security.companyId ? await getCompanySecurities(security.companyId) : [];
  const commonSecurities = securities.filter((sec) => sec.type === "보통주");
  console.log('Common securities found:', commonSecurities?.length || 0);

  // Get DIV data
  const data = await getSecurityMetricsHistory(security.securityId);
  console.log('DIV data found:', data?.length || 0);

  // 🔥 CD3 방어적 프로그래밍: 데이터가 없는 경우 404 처리
  if (!data || data.length === 0) {
    console.log('No DIV data found');
    notFound();
  }

  // DIV 데이터 처리 및 중복 제거
  const rawResult = data.map((item, index) => ({
    date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date),
    value: item.div,
    originalIndex: index,
  })).filter((item) => item.value !== null);

  // 같은 날짜의 중복 데이터 제거 (최신 데이터 우선)
  const uniqueDataMap = new Map();
  rawResult.forEach((item) => {
    const key = item.date;
    if (!uniqueDataMap.has(key) || uniqueDataMap.get(key).originalIndex < item.originalIndex) {
      uniqueDataMap.set(key, item);
    }
  });

  const result = Array.from(uniqueDataMap.values()).map((item, index) => ({
    date: item.date,
    value: item.value,
    uniqueKey: `${item.date}-${index}`,
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const displayName = security.korName || security.name;

  return (
    <LayoutWrapper searchData={searchData}>
      <main className="relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px] space-y-8">
        <div className="mx-auto w-full min-w-0 space-y-12">
          {/* 브레드크럼 네비게이션 */}
          <div className="space-y-0">
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
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
              <div className="font-medium text-foreground">배당수익률</div>
            </div>

            {/* 제목 영역 */}
            <div className="space-y-2 pt-4">
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
                <Balancer>{displayName}의 배당수익률 Dividend Yield</Balancer>
              </p>
            </div>

            {/* 랭킹 헤더 */}
            {commonSecurities.length > 0 && (
              <RankHeader
                rank={commonSecurities[0].company?.marketcapRank || 1}
                marketcap={commonSecurities[0].marketcap || undefined}
                price={commonSecurities[0].prices?.[0]?.close}
                exchange={commonSecurities[0].exchange}
              />
            )}
          </div>

          {/* 네비게이션 탭 */}
          <div className="space-y-8">
            <CompanyFinancialTabs secCode={secCode} />

            {/* 기업 정보 섹션 */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xl font-semibold">기업 정보</h2>
              </div>
              <CardMarketcapDetail securities={securities as any} />
            </div>

            {/* 증권 비교 섹션 */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <h2 className="text-xl font-semibold">증권 비교</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {securities?.filter(s => s.companyId).map((security) => (
                  <CardMarketcap
                    key={security.securityId}
                    security={security as any}
                    currentMetric="div"
                    isCompanyPage={false}
                  />
                ))}
              </div>
            </div>
          </div>

          <MidNavWrapper sectype={security.type} />

          {/* 배당수익률 차트 및 데이터 섹션 */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
              <h2 className="text-xl font-semibold">배당수익률 분석</h2>
            </div>

            {security?.type === "보통주" && result && result.length > 0 ? (
              <div className="space-y-6">
                <div className="bg-background rounded-xl border p-2 sm:p-4 shadow-sm">
                  <ChartDIV
                    data={result}
                    format="formatNumberPercent"
                    formatTooltip="formatNumberPercent"
                  />
                </div>
                <div className="bg-background rounded-xl border p-2 sm:p-4 shadow-sm">
                  <ListDIV data={result} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <TrendingUp className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                <p className="mt-4 text-lg font-medium text-gray-600 dark:text-gray-400">
                  배당수익률 데이터가 없습니다
                </p>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                  해당 종목의 배당수익률 정보를 확인할 수 없습니다.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 사이드바 */}
        <div className="hidden text-sm xl:block">
          <div className="sticky top-16 -mt-10 pt-4">
            <div className="space-y-6">
              <div>
                <h3 className="font-medium">배당수익률 개요</h3>
                <p className="text-muted-foreground mt-1">
                  배당수익률은 주가 대비 배당금의 비율로,
                  투자자가 받을 수 있는 배당 수익의 정도를 나타냅니다.
                </p>
              </div>

              {security.div && (
                <div>
                  <h3 className="font-medium">현재 배당수익률</h3>
                  <p className="text-2xl font-bold mt-1">
                    {(security.div * 100).toFixed(2)}%
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-medium">해석 가이드</h3>
                <ul className="text-muted-foreground mt-1 space-y-1 text-xs">
                  <li>• 높은 배당수익률이 항상 좋은 것은 아님</li>
                  <li>• 배당 지속성과 안정성이 중요</li>
                  <li>• 업종별 평균과 비교 필요</li>
                  <li>• 주가 하락으로 인한 수익률 상승 주의</li>
                </ul>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <Percent className="h-3 w-3" />
                  <span>배당수익률</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3 w-3" />
                  <span>기업 정보</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-3 w-3" />
                  <span>증권 비교</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3" />
                  <span>분석 데이터</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </LayoutWrapper>
  );
}
