import { notFound } from "next/navigation";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Balancer } from "react-wrap-balancer";
import { Scale, TrendingUp, BarChart3, FileText, Target, DollarSign, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSecurityByCode, getCompanySecurities, getSecurityMetricsHistory } from "@/lib/data/security";
import { getCompanyAggregatedMarketcap } from "@/lib/data/company";
import { getPbrRank } from "@/lib/data/security";
import { getSecuritySearchNames } from "@/lib/getSearch";
import { getAllSecurityCodes } from "@/lib/select";
import ChartPBREnhanced from "@/components/chart-PBR-enhanced";
import ListPBREnhanced from "@/components/list-PBR-enhanced";
import CardMarketcap from "@/components/card-marketcap";
import RankHeader from "@/components/header-rank";
import { MarketcapPager } from "@/components/pager-marketcap";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";
import { InteractiveSecuritiesSection } from "@/components/simple-interactive-securities";
import CompanyLogo from "@/components/CompanyLogo";
import { LayoutWrapper } from "@/components/layout-wrapper";
import { Security } from "@/typings";

/**
 * Props for Security PBR Page
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


interface SecurityPBRPageProps {
  params: Promise<{ secCode: string }>;
}

/**
 * Generate metadata for the security PBR page
 */
export async function generateMetadata({ params }: SecurityPBRPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: "종목을 찾을 수 없습니다 - CD3",
      description: "요청하신 종목을 찾을 수 없습니다.",
    };
  }

  return {
    title: `${security.korName || security.name} 주가순자산비율 PBR - CD3`,
    description: `${security.korName || security.name}의 연도별 주가순자산비율(PBR) 변동 차트와 상세 분석 정보를 확인하세요.`,
  };
}

/**
 * Security PBR Page
 * Displays PBR data and charts for a specific security
 */
export default async function SecurityPBRPage({ params }: SecurityPBRPageProps) {
  const { secCode } = await params;

  const security = await getSecurityByCode(secCode);

  if (!security) {
    notFound();
  }

  // Extract ticker from secCode (e.g., "KOSPI.005930" -> "005930")
  const currentTicker = secCode.includes('.') ? secCode.split('.')[1] : secCode;

  // Get related securities for company navigation
  const securities = security.companyId ? await getCompanySecurities(security.companyId) : [];
  const commonSecurities = securities.filter((sec) => sec.type === "보통주");

  // 종목 비교용 필터링: 보통주와 우선주만 표시
  const comparableSecurities = securities.filter((sec) =>
    sec.type === "보통주" || sec.type === "우선주"
  );

  // 🔥 종목별 PBR 데이터 추가 - 종목 비교를 위해 현재 PBR 값을 포함
  const comparableSecuritiesWithPBR = await Promise.all(
    comparableSecurities.map(async (sec) => {
      try {
        // 각 종목의 최신 PBR 데이터 가져오기
        const securityWithPBR = await getSecurityByCode(`${sec.exchange}.${sec.ticker}`);
        return {
          ...sec,
          pbr: securityWithPBR?.pbr || null,
          pbrDate: securityWithPBR?.pbrDate || null,
        };
      } catch (error) {
        console.error(`Failed to get PBR data for ${sec.ticker}:`, error);
        return {
          ...sec,
          pbr: null,
          pbrDate: null,
        };
      }
    })
  );

  // Get PBR data
  const data = await getSecurityMetricsHistory(security.securityId);

  // 🔥 CD3 방어적 프로그래밍: 데이터가 없는 경우 404 처리
  if (!data || data.length === 0) {
    notFound();
  }

  // Get PBR rank
  const pbrRank = await getPbrRank(security.securityId);

  // Get company marketcap data for Interactive Securities Section
  let companyMarketcapData = null;
  if (security.companyId) {
    try {
      companyMarketcapData = await getCompanyAggregatedMarketcap(security.companyId);
    } catch (error) {
      // Error is silently handled - fallback to null
    }
  }

  // 🔥 중복 날짜 데이터 제거 및 고유 키 생성으로 React key 오류 방지
  const processedData = data.map((item) => ({
    date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date),
    value: item.pbr,
  })).filter((item): item is { date: string; value: number } =>
    item.value !== null &&
    item.value !== undefined &&
    !isNaN(item.value) &&
    item.value > 0 &&
    item.value < 1000 // PBR이 1000배를 넘는 경우는 이상치로 간주
  );

  // 🔥 같은 날짜의 중복 데이터 제거 (최신 값 유지)
  const dateMap = new Map<string, { date: string; value: number }>();
  processedData.forEach(item => {
    const existingItem = dateMap.get(item.date);
    if (!existingItem || item.value > existingItem.value) {
      dateMap.set(item.date, item);
    }
  });

  const result = Array.from(dateMap.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((item, index) => ({
      ...item,
      uniqueKey: `pbr-${item.date}-${index}` // 고유 키 생성
    }));

  // Calculate range for chart
  const pbrValues = result.map(item => item.value).filter(val => val != null && val > 0);
  const rangeMin = pbrValues.length > 0 ? Math.min(...pbrValues) : 0;
  const rangeMax = pbrValues.length > 0 ? Math.max(...pbrValues) : 0;

  // 🔥 기간별 PBR 통계 계산
  const now = new Date();
  const getDateYearsAgo = (years: number) => {
    const date = new Date(now);
    date.setFullYear(date.getFullYear() - years);
    return date;
  };

  const getAveragePBRForPeriod = (years: number) => {
    const cutoffDate = getDateYearsAgo(years);
    const periodData = result.filter(item => {
      const itemDate = typeof item.date === 'string' ? new Date(item.date) : item.date;
      return itemDate >= cutoffDate && item.value != null && item.value > 0;
    });

    if (periodData.length === 0) return null;
    const sum = periodData.reduce((acc, item) => acc + (item.value || 0), 0);
    return sum / periodData.length;
  };

  // 기간별 평균 PBR 계산
  const pbr20Year = getAveragePBRForPeriod(20);
  const pbr10Year = getAveragePBRForPeriod(10);
  const pbr5Year = getAveragePBRForPeriod(5);
  const pbr3Year = getAveragePBRForPeriod(3);
  const pbr12Month = getAveragePBRForPeriod(1);

  // 최신 PBR 값
  const latestPBR = result.length > 0 ? result[result.length - 1].value : null;

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
            <div className="font-medium text-foreground">주가순자산비율</div>
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
                      {security.company?.korName || security.korName || security.name} {security.type} PBR
                    </Balancer>
                  </h1>
                </div>
              </div>
              <p className="text-lg md:text-xl text-muted-foreground mt-2">
                {security.korName || security.name}의 주가순자산비율 Price to Book Ratio 분석
              </p>
            </div>

            {/* PBR 설명 알림 */}
            <div data-slot="alert" role="alert" className="relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current bg-card text-card-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info h-4 w-4" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <div data-slot="alert-description" className="text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed">
                주가순자산비율(PBR)은 주가를 주당순자산으로 나눈 값으로, 기업의 자산가치 대비 주가 수준을 나타내는 핵심 밸류에이션 지표입니다.
                낮은 PBR은 상대적으로 저평가된 상태를 의미할 수 있습니다.
              </div>
            </div>
          </div>

          {/* PBR 개요 섹션 */}
          <div id="pbr-overview" className="space-y-8 relative border-t border-blue-100 dark:border-blue-800/50 pt-8 pb-8 bg-blue-50/20 dark:bg-blue-900/20 rounded-xl -mx-4 px-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-800/50">
                <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">PBR 개요</h2>
                <p className="text-base text-gray-600 dark:text-gray-400 mt-1">주가순자산비율 순위와 기본 정보</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* PBR 순위 카드 */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700 dark:bg-slate-600 text-white">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{pbrRank ? `${pbrRank}위` : "—"}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">PBR 랭킹</p>
                  </div>
                </div>
              </div>

              {/* 최근 PBR 카드 */}
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-800/50 dark:to-blue-900/50 border border-blue-200 dark:border-blue-700 hover:shadow-md transition-shadow rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 dark:bg-blue-700 text-white">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
                      {latestPBR ? `${latestPBR.toFixed(2)}배` : "—"}
                    </p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">최근 PBR</p>
                  </div>
                </div>
              </div>

              {/* 3년 평균 PBR 카드 */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-800/50 dark:to-green-900/50 border border-green-200 dark:border-green-700 hover:shadow-md transition-shadow rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-600 dark:bg-green-700 text-white">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-900 dark:text-green-100">
                      {pbr3Year ? `${pbr3Year.toFixed(2)}배` : "—"}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">3년 평균</p>
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
          {companyMarketcapData && comparableSecuritiesWithPBR.length > 1 && (
            <div id="securities-comparison" className="space-y-8 relative border-t border-teal-100 dark:border-teal-800/50 pt-8 pb-8 bg-teal-50/20 dark:bg-teal-900/20 rounded-xl -mx-4 px-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-800/50">
                  <Scale className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">종목 비교</h2>
                  <p className="text-base text-gray-600 dark:text-gray-400 mt-1">보통주 및 우선주 간 PBR 비교 분석</p>
                </div>
              </div>

              <InteractiveSecuritiesSection
                companyMarketcapData={companyMarketcapData}
                companySecs={comparableSecuritiesWithPBR}
                currentTicker={currentTicker}
                market={security.exchange || ""}
                baseUrl="security"
                currentMetric="pbr"
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
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">PBR 핵심 지표</h2>
                <p className="text-base text-gray-600 dark:text-gray-400 mt-1">기간별 주가순자산비율 평균과 추이 분석</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {latestPBR ? `${latestPBR.toFixed(2)}배` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">현재 PBR</div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {pbr12Month ? `${pbr12Month.toFixed(2)}배` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">1년 평균</div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {pbr3Year ? `${pbr3Year.toFixed(2)}배` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">3년 평균</div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {pbr5Year ? `${pbr5Year.toFixed(2)}배` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">5년 평균</div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {pbr10Year ? `${pbr10Year.toFixed(2)}배` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">10년 평균</div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-center">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {pbr20Year ? `${pbr20Year.toFixed(2)}배` : "—"}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">20년 평균</div>
              </div>
            </div>
          </div>

          {/* 연도별 PBR 데이터 섹션 */}
          <div id="pbr-data" className="border-t border-red-100 dark:border-red-800/50 pt-8 pb-8 bg-red-50/20 dark:bg-red-900/20 rounded-xl -mx-4 px-4">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 dark:bg-red-800/50">
                <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">연도별 데이터</h2>
                <p className="text-base text-gray-600 dark:text-gray-400 mt-1">PBR 차트와 연말 기준 상세 데이터</p>
              </div>
            </div>

            <div className="space-y-8">
              {/* 차트 부분 */}
              <div>
                {result && result.length > 0 ? (
                  <div className="bg-background rounded-xl border p-2 sm:p-4 shadow-sm">
                    <ChartPBREnhanced
                      data={result}
                      format="formatRatio"
                      formatTooltip="formatNumberRatio"
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
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">PBR 차트 데이터 없음</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">연간 PBR 데이터를 불러올 수 없습니다</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 테이블 부분 */}
              <div className="space-y-6">
                <p className="sr-only">연말 기준 PBR 추이를 통해 밸류에이션 변화를 분석합니다</p>

                {result && result.length > 0 ? (
                  <ListPBREnhanced data={result} />
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">연도별 PBR 데이터 없음</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">시계열 데이터를 불러올 수 없습니다</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* MarketcapPager */}
          <div id="ranking">
            <MarketcapPager rank={security.company?.marketcapRank || 1} />
          </div>
        </div>

        {/* 🔥 사이드바 네비게이션 (데스크톱) */}
        <div className="hidden xl:sticky xl:top-[100px] xl:block xl:h-[calc(100vh-120px)] xl:overflow-y-auto">
          <div className="space-y-6">
            {/* 페이지 네비게이션 */}
            <div className="rounded-xl border bg-background p-4">
              <h3 className="text-sm font-semibold mb-3">페이지 내비게이션</h3>
              <nav className="space-y-2">
                <a
                  href="#pbr-overview"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  <BookOpen className="h-3 w-3" />
                  PBR 개요
                </a>
                {companyMarketcapData && comparableSecuritiesWithPBR.length > 1 && (
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
                  PBR 핵심 지표
                </a>
                <a
                  href="#pbr-data"
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
                  <span className="text-muted-foreground">현재 PBR</span>
                  <span className="font-medium text-foreground">{latestPBR ? `${latestPBR.toFixed(2)}배` : "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">PBR 랭킹</span>
                  <span className="font-medium text-foreground">{pbrRank ? `${pbrRank}위` : "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">현재 주가</span>
                  <span className="font-medium text-foreground">{security.prices?.[0]?.close ? `${security.prices[0].close.toLocaleString()}원` : "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">5년 평균</span>
                  <span className="font-medium text-foreground">{pbr5Year ? `${pbr5Year.toFixed(2)}배` : "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">최저 PBR</span>
                  <span className="font-medium text-foreground">{pbrValues.length > 0 ? `${rangeMin.toFixed(2)}배` : "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">최고 PBR</span>
                  <span className="font-medium text-foreground">{pbrValues.length > 0 ? `${rangeMax.toFixed(2)}배` : "—"}</span>
                </div>
              </div>
            </div>

            {/* 종목별 PBR 비교 */}
            {comparableSecuritiesWithPBR && comparableSecuritiesWithPBR.length > 0 && (
              <InteractiveSecuritiesSection
                companyMarketcapData={{
                  securities: comparableSecuritiesWithPBR.map(sec => ({
                    securityId: sec.securityId,
                    type: sec.type,
                    ticker: sec.ticker,
                    name: sec.korName || sec.name,
                    exchange: sec.exchange,
                    pbr: sec.pbr,
                    pbrDate: sec.pbrDate
                  }))
                }}
                companySecs={comparableSecuritiesWithPBR}
                currentTicker={currentTicker}
                market={secCode.includes('.') ? secCode.split('.')[0] : 'KOSPI'}
                layout="sidebar"
                maxItems={4}
                showSummaryCard={false}
                compactMode={false}
                baseUrl="security"
                currentMetric="pbr"
              />
            )}
          </div>
        </div>
      </main>
    </LayoutWrapper>
  );
}
