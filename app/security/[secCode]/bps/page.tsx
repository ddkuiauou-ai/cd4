import { notFound } from "next/navigation";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Balancer } from "react-wrap-balancer";
import { Coins, Scale, TrendingUp, BarChart3, FileText, Target, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSecurityByCode, getCompanySecurities, getSecurityMetricsHistory } from "@/lib/data/security";
import { getCompanyAggregatedMarketcap } from "@/lib/data/company";
import { getBpsRank } from "@/lib/data/security";
import { getSecuritySearchNames } from "@/lib/getSearch";
import { getAllSecurityCodes } from "@/lib/select";
import ChartBPSEnhanced from "@/components/chart-BPS-enhanced";
import ListBPSEnhanced from "@/components/list-BPS-enhanced";
import CardMarketcap from "@/components/card-marketcap";
import RankHeader from "@/components/header-rank";
import { MarketcapPager } from "@/components/pager-marketcap";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";
import { InteractiveSecuritiesSection } from "@/components/simple-interactive-securities";
import CompanyLogo from "@/components/CompanyLogo";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { Security } from "@/typings";

/**
 * Props for Security BPS Page
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


interface SecurityBPSPageProps {
  params: Promise<{ secCode: string }>;
}

/**
 * Generate metadata for the security BPS page
 */
export async function generateMetadata({ params }: SecurityBPSPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: "종목을 찾을 수 없습니다 - CD3",
      description: "요청하신 종목을 찾을 수 없습니다.",
    };
  }

  return {
    title: `${security.korName || security.name} 주당순자산가치 BPS - CD3`,
    description: `${security.korName || security.name}의 연도별 주당순자산가치(BPS) 변동 차트와 상세 분석 정보를 확인하세요.`,
  };
}

/**
 * Security BPS Page
 * Displays BPS (Book Value Per Share) data and charts for a specific security
 */
export default async function SecurityBPSPage({ params }: SecurityBPSPageProps) {
  const { secCode } = await params;

  console.log('=== SECURITY BPS PAGE DEBUG ===');
  console.log('secCode:', secCode);

  const security = await getSecurityByCode(secCode);
  console.log('Found security:', security?.securityId);

  if (!security) {
    console.log('Security not found');
    notFound();
  }

  // Get related securities for company navigation  
  const securities = security.companyId ? await getCompanySecurities(security.companyId) : [];

  // 종목 비교용 필터링: 보통주와 우선주만 표시
  const comparableSecurities = securities.filter((sec) =>
    sec.type === "보통주" || sec.type === "우선주"
  );

  // 🔥 종목별 BPS 데이터 추가 - 종목 비교를 위해 현재 BPS 값을 포함
  const comparableSecuritiesWithBPS = await Promise.all(
    comparableSecurities.map(async (sec) => {
      try {
        // 각 종목의 최신 BPS 데이터 가져오기
        const securityWithBPS = await getSecurityByCode(`${sec.exchange}.${sec.ticker}`);
        return {
          ...sec,
          bps: securityWithBPS?.bps || null,
          bpsDate: securityWithBPS?.bpsDate || null,
        };
      } catch (error) {
        console.error(`Failed to get BPS data for ${sec.ticker}:`, error);
        return {
          ...sec,
          bps: null,
          bpsDate: null,
        };
      }
    })
  );

  const currentTicker = secCode.split('.')[1] || secCode;

  // Get BPS data
  const data = await getSecurityMetricsHistory(security.securityId);
  console.log('BPS data found:', data?.length || 0);

  // 🔥 CD3 방어적 프로그래밍: 데이터가 없는 경우 404 처리
  if (!data || data.length === 0) {
    notFound();
  }

  // Get BPS rank
  const bpsRank = await getBpsRank(security.securityId);

  // Get company marketcap data for Interactive Securities Section
  let companyMarketcapData = null;
  if (security.companyId) {
    try {
      companyMarketcapData = await getCompanyAggregatedMarketcap(security.companyId);
    } catch (error) {
      // Error is silently handled - fallback to null
    }
  }

  // BPS 데이터 처리 및 중복 제거
  const rawResult = data.map((item, index) => ({
    date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date),
    value: item.bps,
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

  // Calculate range for chart
  const bpsValues = result.map(item => item.value).filter(val => val != null);
  const rangeMin = Math.min(...bpsValues);
  const rangeMax = Math.max(...bpsValues);

  // 🔥 기간별 BPS 통계 계산
  const now = new Date();
  const getDateYearsAgo = (years: number) => {
    const date = new Date(now);
    date.setFullYear(date.getFullYear() - years);
    return date;
  };

  const getAverageBPSForPeriod = (years: number) => {
    const cutoffDate = getDateYearsAgo(years);
    const periodData = result.filter(item => {
      const itemDate = typeof item.date === 'string' ? new Date(item.date) : item.date;
      return itemDate >= cutoffDate && item.value != null;
    });

    if (periodData.length === 0) return null;
    const sum = periodData.reduce((acc, item) => acc + (item.value || 0), 0);
    return sum / periodData.length;
  };

  // 기간별 평균 BPS 계산
  const bps20Year = getAverageBPSForPeriod(20);
  const bps10Year = getAverageBPSForPeriod(10);
  const bps5Year = getAverageBPSForPeriod(5);
  const bps3Year = getAverageBPSForPeriod(3);
  const bps12Month = getAverageBPSForPeriod(1);

  // 최신 BPS 값
  const latestBPS = result.length > 0 ? result[result.length - 1].value : null;

  // Get search data for header
  const searchData = await getSecuritySearchNames();

  return (
    <LayoutWrapper searchData={searchData}>
      <main className="relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px]">
        <div className="mx-auto w-full min-w-0">
          {/* 🔥 브레드크럼 */}
          <div className="mb-4 flex items-center space-x-1 text-sm text-muted-foreground">
            <div className="overflow-hidden text-ellipsis whitespace-nowrap">
              {security.companyId ? "기업" : "증권"}
            </div>
            <ChevronRightIcon className="h-4 w-4" />
            <div className="font-medium text-muted-foreground">
              {securities.length > 0 ? (
                <Link
                  href={`/company/marketcaps?search=${encodeURIComponent(securities[0].company?.korName || securities[0].korName || securities[0].name)}`}
                  className="hover:text-primary underline underline-offset-4"
                >
                  {securities[0].company?.korName || securities[0].korName || securities[0].name}
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
            <div className="font-medium text-foreground">주당순자산가치</div>
          </div>

          {/* 🔥 제목 영역 */}
          <div className="space-y-8 relative">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <CompanyLogo
                  companyName={security.company?.korName || security.korName || security.name}
                  size={64}
                />
                <div className="flex-1 min-w-0">
                  <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
                    <Balancer>
                      {security.company?.korName || security.korName || security.name} {security.type} BPS
                    </Balancer>
                  </h1>
                </div>
              </div>
              <p className="text-lg md:text-xl text-muted-foreground mt-2">
                {security.korName || security.name}의 주당순자산가치 Book Value Per Share 분석
              </p>
            </div>

            {/* BPS 설명 알림 */}
            <div data-slot="alert" role="alert" className="relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current bg-card text-card-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info h-4 w-4" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <div data-slot="alert-description" className="text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed">
                주당순자산가치(BPS)는 기업의 순자산을 주식 수로 나눈 값으로, 주주가 받을 수 있는 1주당 자산 가치를 나타냅니다.
                PBR(주가순자산비율) 계산의 기초가 되는 중요한 재무 지표입니다.
              </div>
            </div>
          </div>

          {/* BPS 개요 섹션 */}
          <div id="bps-overview" className="space-y-8 relative border-t border-purple-100 dark:border-purple-800/50 pt-8 pb-8 bg-purple-50/20 dark:bg-purple-900/20 rounded-xl -mx-4 px-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-800/50">
                <Building className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">BPS 개요</h2>
                <p className="text-base text-gray-600 dark:text-gray-400 mt-1">주당순자산가치 순위와 기본 정보</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* BPS 순위 카드 */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700 dark:bg-slate-600 text-white">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{bpsRank ? `${bpsRank}위` : "—"}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">BPS 랭킹</p>
                  </div>
                </div>
              </div>

              {/* 거래소 카드 */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-800/50 dark:to-green-900/50 border border-green-200 dark:border-green-700 hover:shadow-md transition-shadow rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-600 dark:bg-green-700 text-white">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12h20"></path>
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-900 dark:text-green-100 leading-tight">
                      {security.exchange || "—"}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">거래소</p>
                  </div>
                </div>
              </div>

              {/* 최근 BPS 카드 */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-800/50 dark:to-purple-900/50 border border-purple-200 dark:border-purple-700 hover:shadow-md transition-shadow rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-600 dark:bg-purple-700 text-white">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-purple-900 dark:text-purple-100">
                      {latestBPS ? `${latestBPS.toLocaleString()}원` : "—"}
                    </p>
                    <p className="text-sm text-purple-600 dark:text-purple-400">최근 BPS</p>
                  </div>
                </div>
              </div>

              {/* 3년 평균 BPS 카드 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-800/50 dark:to-blue-900/50 border border-blue-200 dark:border-blue-700 hover:shadow-md transition-shadow rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 dark:bg-blue-700 text-white">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                      {bps3Year ? `${Math.round(bps3Year).toLocaleString()}원` : "—"}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">3년 평균</p>
                  </div>
                </div>
              </div>

              {/* 데이터 기간 카드 */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-600 dark:bg-gray-700 text-white">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{result.length}년</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">데이터 기간</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 🔥 Interactive Section - 종목 비교 */}
          {companyMarketcapData && comparableSecuritiesWithBPS.length > 1 && (
            <div id="securities-comparison" className="space-y-8 relative border-t border-teal-100 dark:border-teal-800/50 pt-8 pb-8 bg-teal-50/20 dark:bg-teal-900/20 rounded-xl -mx-4 px-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-800/50">
                  <Scale className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">종목 비교</h2>
                  <p className="text-base text-gray-600 dark:text-gray-400 mt-1">보통주 및 우선주 간 BPS 비교 분석</p>
                </div>
              </div>

              <InteractiveSecuritiesSection
                companyMarketcapData={companyMarketcapData}
                companySecs={comparableSecuritiesWithBPS}
                currentTicker={currentTicker}
                market={security.exchange || ""}
                baseUrl="security"
                currentMetric="bps"
              />
            </div>
          )}

          {/* CompanyFinancialTabs */}
          <div id="financial" className="mb-8">
            <CompanyFinancialTabs secCode={secCode} />
          </div>

          {/* 핵심 지표 섹션 */}
          <div id="key-metrics" className="border-t border-indigo-100 dark:border-indigo-800/50 pt-8 pb-8 bg-indigo-50/20 dark:bg-indigo-900/20 rounded-xl -mx-4 px-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-800/50">
                <BarChart3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">BPS 핵심 지표</h2>
                <p className="text-base text-gray-600 dark:text-gray-400 mt-1">기간별 주당순자산가치 평균과 추이 분석</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {latestBPS ? `${latestBPS.toLocaleString()}원` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">현재 BPS</div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {bps12Month ? `${Math.round(bps12Month).toLocaleString()}원` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">1년 평균</div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {bps3Year ? `${Math.round(bps3Year).toLocaleString()}원` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">3년 평균</div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {bps5Year ? `${Math.round(bps5Year).toLocaleString()}원` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">5년 평균</div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {bps10Year ? `${Math.round(bps10Year).toLocaleString()}원` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">10년 평균</div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {bps20Year ? `${Math.round(bps20Year).toLocaleString()}원` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">20년 평균</div>
              </div>
            </div>
          </div>

          {/* 연도별 BPS 데이터 섹션 */}
          <div id="bps-data" className="border-t border-red-100 dark:border-red-800/50 pt-8 pb-8 bg-red-50/20 dark:bg-red-900/20 rounded-xl -mx-4 px-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 dark:bg-red-800/50">
                <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">연도별 데이터</h2>
                <p className="text-base text-gray-600 dark:text-gray-400 mt-1">BPS 차트와 연말 기준 상세 데이터</p>
              </div>
            </div>

            <div className="space-y-8">
              {/* 차트 부분 */}
              <div>
                {result && result.length > 0 ? (
                  <div className="bg-background rounded-xl border p-2 sm:p-4 shadow-sm">
                    <ChartBPSEnhanced
                      data={result.map(item => ({
                        date: item.date,
                        value: item.value
                      }))}
                      format="number"
                      formatTooltip="number"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">BPS 차트 데이터 없음</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">연간 BPS 데이터를 불러올 수 없습니다</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 테이블 부분 */}
              <div className="space-y-6">
                <p className="sr-only">연말 기준 BPS 추이를 통해 자산 가치 변화를 분석합니다</p>

                {result && result.length > 0 ? (
                  <ListBPSEnhanced data={result} />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">연도별 BPS 데이터 없음</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">시계열 데이터를 불러올 수 없습니다</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MarketcapPager */}
          <div id="ranking" className="border-t pt-8">
            <MarketcapPager rank={security.company?.marketcapRank || 1} />
          </div>
        </div>

        {/* 사이드바 네비게이션 (데스크톱) */}
        <div className="hidden xl:block">
          <div className="sticky top-16 -mt-10 pt-4">
            <div className="space-y-4">
              <div className="rounded-xl border bg-background p-4">
                <h3 className="text-sm font-semibold mb-3">목차</h3>
                <nav className="space-y-2">
                  <a
                    href="#bps-overview"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    <Building className="h-3 w-3" />
                    BPS 개요
                  </a>
                  {companyMarketcapData && comparableSecuritiesWithBPS.length > 1 && (
                    <a
                      href="#securities-comparison"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                    >
                      <Scale className="h-3 w-3" />
                      종목 비교
                    </a>
                  )}
                  <a
                    href="#key-metrics"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    <BarChart3 className="h-3 w-3" />
                    BPS 핵심 지표
                  </a>
                  <a
                    href="#bps-data"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    <FileText className="h-3 w-3" />
                    연도별 데이터
                  </a>
                </nav>
              </div>

              {/* 핵심 지표 카드 */}
              <div className="rounded-xl border bg-background p-4">
                <h3 className="text-sm font-semibold mb-3">핵심 지표</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">현재 BPS</span>
                    <span className="font-medium text-foreground">{latestBPS ? `${latestBPS.toLocaleString()}원` : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">BPS 랭킹</span>
                    <span className="font-medium text-foreground">{bpsRank ? `${bpsRank}위` : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">현재 주가</span>
                    <span className="font-medium text-foreground">{security.prices?.[0]?.close ? `${security.prices[0].close.toLocaleString()}원` : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">5년 평균</span>
                    <span className="font-medium text-foreground">{bps5Year ? `${Math.round(bps5Year).toLocaleString()}원` : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">최저 BPS</span>
                    <span className="font-medium text-foreground">{result.length > 1 ? `${rangeMin.toLocaleString()}원` : "—"}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">최고 BPS</span>
                    <span className="font-medium text-foreground">{result.length > 1 ? `${rangeMax.toLocaleString()}원` : "—"}</span>
                  </div>
                </div>
              </div>

              {/* 종목별 BPS 비교 */}
              {comparableSecuritiesWithBPS && comparableSecuritiesWithBPS.length > 0 && (
                <InteractiveSecuritiesSection
                  companyMarketcapData={{
                    securities: comparableSecuritiesWithBPS.map(sec => ({
                      securityId: sec.securityId,
                      type: sec.type,
                      ticker: sec.ticker,
                      name: sec.korName || sec.name,
                      exchange: sec.exchange,
                      bps: sec.bps,
                      bpsDate: sec.bpsDate
                    }))
                  }}
                  companySecs={comparableSecuritiesWithBPS}
                  currentTicker={currentTicker}
                  market={secCode.includes('.') ? secCode.split('.')[0] : 'KOSPI'}
                  layout="sidebar"
                  maxItems={4}
                  showSummaryCard={false}
                  compactMode={false}
                  baseUrl="security"
                  currentMetric="bps"
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </LayoutWrapper>
  );
}
