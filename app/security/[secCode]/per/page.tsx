import { notFound } from "next/navigation";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Balancer } from "react-wrap-balancer";
import { Building2, BarChart3, ArrowLeftRight, TrendingUp, FileText, Calculator } from "lucide-react";
import { getSecurityByCode, getCompanySecurities, getSecurityMetricsHistory } from "@/lib/data/security";
import { getCompanyAggregatedMarketcap } from "@/lib/data/company";
import { getPerRank } from "@/lib/data/security";
import { getSecuritySearchNames } from "@/lib/getSearch";
import { getAllSecurityCodes } from "@/lib/select";
import ChartPEREnhanced from "@/components/chart-PER-enhanced";
import ListPEREnhanced from "@/components/list-PER-enhanced";
import { formatNumber, formatDate, formatNumberWithSeparateUnit, formatChangeRate, formatDifference } from "@/lib/utils";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";
import { InteractiveSecuritiesSection } from "@/components/simple-interactive-securities";
import CompanyLogo from "@/components/CompanyLogo";
import { KeyMetricsSectionPER } from "@/components/key-metrics-section-per";
import { LayoutWrapper } from "@/components/layout-wrapper";

/**
 * Props for Security PER Page
 */
interface SecurityPERPageProps {
  params: Promise<{ secCode: string }>;
}

/**
 * Generate metadata for the security PER page
 */
export async function generateMetadata({ params }: SecurityPERPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: "종목을 찾을 수 없습니다 - CD3",
      description: "요청하신 종목을 찾을 수 없습니다.",
    };
  }

  return {
    title: `${security.korName || security.name} 주가수익비율 PER - CD3`,
    description: `${security.korName || security.name}의 연도별 주가수익비율(PER) 변동 차트와 상세 분석 정보를 확인하세요.`,
  };
}

/**
 * Generate static params for all PER pages (SSG)
 */
export async function generateStaticParams() {
  try {
    const securityCodes = await getAllSecurityCodes();

    return securityCodes.map((secCode) => ({
      secCode: secCode,
    }));
  } catch (error) {
    console.error('[GENERATE_STATIC_PARAMS] Error generating PER params:', error);
    return [];
  }
}

/**
 * Security PER Page
 * Displays PER data and charts for a specific security
 */
export default async function SecurityPERPage({ params }: SecurityPERPageProps) {
  const { secCode } = await params;

  const security = await getSecurityByCode(secCode);

  if (!security) {
    notFound();
  }

  const displayName = security.korName || security.name;

  // Extract market from secCode (e.g., "KOSPI.005930" -> "KOSPI")
  const market = secCode.includes('.') ? secCode.split('.')[0] : 'KOSPI';

  // Extract ticker from secCode (e.g., "KOSPI.005930" -> "005930")
  const currentTicker = secCode.includes('.') ? secCode.split('.')[1] : secCode;

  // Get company-related securities if this security has a company
  const companySecs = security.companyId
    ? await getCompanySecurities(security.companyId)
    : [];

  // 종목 비교용 필터링: 보통주와 우선주만 표시
  const comparableSecurities = companySecs.filter((sec) =>
    sec.type === "보통주" || sec.type === "우선주"
  );

  // 🔥 종목별 PER 데이터 추가 - 종목 비교를 위해 현재 PER 값을 포함
  const comparableSecuritiesWithPER = await Promise.all(
    comparableSecurities.map(async (sec) => {
      try {
        // 각 종목의 최신 PER 데이터 가져오기
        const securityWithPER = await getSecurityByCode(`${sec.exchange}.${sec.ticker}`);
        return {
          ...sec,
          per: securityWithPER?.per || null,
          perDate: securityWithPER?.perDate || null,
        };
      } catch (error) {
        console.error(`Failed to get PER data for ${sec.ticker}:`, error);
        return {
          ...sec,
          per: null,
          perDate: null,
        };
      }
    })
  );

  // Get PER data
  const data = await getSecurityMetricsHistory(security.securityId);

  // 🔥 CD3 방어적 프로그래밍: 데이터가 없는 경우 404 처리
  if (!data || data.length === 0) {
    notFound();
  }

  // Get PER rank
  const perRank = await getPerRank(security.securityId);

  // Get company marketcap data for Interactive Securities Section
  let companyMarketcapData = null;
  if (security.companyId) {
    try {
      companyMarketcapData = await getCompanyAggregatedMarketcap(security.companyId);
    } catch (error) {
      // Error is silently handled - fallback to null
    }
  }

  // Transform data to match expected format for PER
  const result = data
    .filter((item) => item.per !== null && item.per !== undefined)
    .map((item) => ({
      date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : String(item.date).split('T')[0],
      value: Number(item.per),
      eps: Number(item.eps || 0),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate period analysis for PER
  function calculatePERPeriodAnalysis() {
    if (!result || result.length === 0) return null;

    const latestPER = result.length > 0 ? result[result.length - 1].value : null;

    // 기간별 데이터 필터링 함수
    const getDataForPeriod = (months: number) => {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);
      return result.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= cutoffDate;
      });
    };

    // 기간별 평균 계산
    const periods = [
      { label: '최근 PER', months: 0, desc: '현재 기준' },
      { label: '12개월 평균', months: 12, desc: '직전 1년' },
      { label: '3년 평균', months: 36, desc: '최근 3년' },
      { label: '5년 평균', months: 60, desc: '최근 5년' },
      { label: '10년 평균', months: 120, desc: '최근 10년' },
      { label: '20년 평균', months: 240, desc: '최근 20년' }
    ];

    const analysis = periods.map(period => {
      if (period.months === 0) {
        return {
          label: period.label,
          value: latestPER || 0,
          desc: period.desc
        };
      }

      const periodData = getDataForPeriod(period.months);
      if (periodData.length === 0) return null;

      const average = periodData.reduce((sum, item) => sum + item.value, 0) / periodData.length;
      return {
        label: period.label,
        value: average,
        desc: period.desc
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    // 최저/최고 계산
    const allValues = result.map(item => item.value);
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    return {
      periods: analysis,
      minMax: { min: minValue, max: maxValue },
      currentSecurity: displayName,
      market,
      latestPER
    };
  }

  const periodAnalysis = calculatePERPeriodAnalysis();

  // Get search data for header
  const searchData = await getSecuritySearchNames();

  // 공통 NoData 컴포넌트
  const NoDataDisplay = ({ title, description, iconType = "chart" }: {
    title: string;
    description: string;
    iconType?: "chart" | "table";
  }) => (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
        {iconType === "chart" ? (
          <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
  );

  return (
    <LayoutWrapper searchData={searchData}>
      <main className="relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px] space-y-8">
        <div className="mx-auto w-full min-w-0 space-y-12">
          {/* 브레드크럼 네비게이션 */}
          <div className="space-y-0">
            <div className="flex items-center space-x-1 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">
                홈
              </Link>
              <ChevronRightIcon className="h-4 w-4" />
              <Link href="/security" className="hover:text-foreground transition-colors">
                종목
              </Link>
              <ChevronRightIcon className="h-4 w-4" />
              <Link href={`/security/${secCode}`} className="hover:text-foreground transition-colors">
                {displayName}
              </Link>
              <ChevronRightIcon className="h-4 w-4" />
              <span className="font-medium text-foreground">PER</span>
            </div>
          </div>

          {/* 페이지 제목 섹션 */}
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-4 mb-4">
                <CompanyLogo
                  companyName={displayName}
                  logoUrl={security.company?.logo}
                  size={64}
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
                    <Balancer>
                      {displayName} PER
                    </Balancer>
                  </h1>
                </div>
              </div>
              <p className="text-lg md:text-xl text-muted-foreground mt-2">
                {displayName}의 주가수익비율 Price to Earnings Ratio 분석
              </p>
            </div>

            {/* PER 설명 알림 */}
            <div data-slot="alert" role="alert" className="relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current bg-card text-card-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info h-4 w-4" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <div data-slot="alert-description" className="text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed">
                PER(주가수익비율)은 주가를 주당순이익(EPS)으로 나눈 비율입니다.
                낮을수록 주가가 저평가되어 있다고 볼 수 있으며, 업종별 비교가 중요합니다.
              </div>
            </div>
          </div>

          <div className="space-y-16">
            {/* 종목 개요 섹션 */}
            <div id="security-overview" className="relative border-t border-blue-100 dark:border-blue-800/50 pt-8 pb-8 bg-blue-50/30 dark:bg-blue-900/20 rounded-xl -mx-4 px-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-800/50">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">종목 개요</h2>
                  <p className="text-base text-gray-600 dark:text-gray-400 mt-1">PER 순위와 기본 정보</p>
                </div>
              </div>

              {/* PER 랭킹 카드 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-700 dark:bg-slate-600 text-white">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{perRank ? `${perRank}위` : "—"}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">PER 랭킹</p>
                  </div>
                </div>

                {/* 최근 PER 카드 */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-800/50">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-green-900 dark:text-green-100">
                      {periodAnalysis?.latestPER ? `${periodAnalysis.latestPER.toFixed(2)}배` : "—"}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">현재 PER</p>
                  </div>
                </div>

                {/* 현재 주가 카드 */}
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-800/50">
                    <BarChart3 className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-orange-900 dark:text-orange-100">
                      {security.prices?.[0]?.close ? `${security.prices[0].close.toLocaleString()}원` : "—"}
                    </p>
                    <p className="text-sm text-orange-600 dark:text-orange-400">현재 주가</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 차트 분석 섹션 */}
            <div id="chart-analysis" className="space-y-8 relative border-t border-green-100 dark:border-green-800/50 pt-8 pb-8 bg-green-50/20 dark:bg-green-900/20 rounded-xl -mx-4 px-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-800/50">
                  <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">차트 분석</h2>
                  <p className="text-base text-gray-600 dark:text-gray-400 mt-1">PER 추이와 상세 분석</p>
                </div>
              </div>

              {/* 차트 분석 - 차트에만 집중 */}
              <div className="space-y-4">
                <div className="bg-background rounded-xl border p-2 sm:p-4 shadow-sm">
                  {result && result.length > 0 ? (
                    <ChartPEREnhanced data={result} />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">PER 차트 데이터 없음</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">연간 PER 데이터를 불러올 수 없습니다</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 종목 비교 섹션 */}
            {comparableSecuritiesWithPER && comparableSecuritiesWithPER.length > 1 && (
              <div id="securities-summary" className="space-y-8 relative border-t border-purple-100 dark:border-purple-800/50 pt-8 pb-8 bg-purple-50/20 dark:bg-purple-900/20 rounded-xl -mx-4 px-4">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-800/50">
                    <ArrowLeftRight className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">종목 비교</h2>
                    <p className="text-base text-gray-600 dark:text-gray-400 mt-1">동일 기업 내 각 종목 간 PER 비교</p>
                  </div>
                </div>

                {companyMarketcapData && (
                  <InteractiveSecuritiesSection
                    companyMarketcapData={companyMarketcapData}
                    companySecs={comparableSecuritiesWithPER}
                    market={market}
                    currentTicker={currentTicker}
                    baseUrl="security"
                    currentMetric="per"
                  />
                )}
              </div>
            )}

            <CompanyFinancialTabs secCode={secCode} />

            {/* 핵심 지표 섹션 */}
            <div id="indicators" className="border-t border-yellow-100 dark:border-yellow-800/50 pt-8 pb-8 bg-yellow-50/20 dark:bg-yellow-900/20 rounded-xl -mx-4 px-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-800/50">
                  <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">핵심 지표</h2>
                  <p className="text-base text-gray-600 dark:text-gray-400 mt-1">기간별 PER 분석 및 통계</p>
                </div>
              </div>

              {periodAnalysis && (
                <KeyMetricsSectionPER
                  security={security}
                  perRank={perRank}
                  latestPER={periodAnalysis.latestPER}
                  per12Month={periodAnalysis.periods.find(p => p.label === '12개월 평균')?.value || null}
                  per3Year={periodAnalysis.periods.find(p => p.label === '3년 평균')?.value || null}
                  per5Year={periodAnalysis.periods.find(p => p.label === '5년 평균')?.value || null}
                  per10Year={periodAnalysis.periods.find(p => p.label === '10년 평균')?.value || null}
                  per20Year={periodAnalysis.periods.find(p => p.label === '20년 평균')?.value || null}
                  rangeMin={periodAnalysis.minMax.min}
                  rangeMax={periodAnalysis.minMax.max}
                  result={result}
                />
              )}
            </div>

            {/* 연도별 데이터 섹션 */}
            <div id="annual-data" className="border-t border-red-100 dark:border-red-800/50 pt-8 pb-8 bg-red-50/20 dark:bg-red-900/20 rounded-xl -mx-4 px-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 dark:bg-red-800/50">
                  <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">연도별 데이터</h2>
                  <p className="text-base text-gray-600 dark:text-gray-400 mt-1">PER 차트와 연말 기준 상세 데이터</p>
                </div>
              </div>

              <div className="space-y-8">
                {/* 상세 차트 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">PER 상세 차트</h3>
                  {result && result.length > 0 ? (
                    <div className="bg-background rounded-xl border p-2 sm:p-4 shadow-sm">
                      <ChartPEREnhanced data={result} />
                    </div>
                  ) : (
                    <NoDataDisplay
                      title="PER 차트 데이터 없음"
                      description="연간 PER 데이터를 불러올 수 없습니다"
                      iconType="chart"
                    />
                  )}
                </div>

                {/* 데이터 테이블 */}
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold">연도별 PER 데이터</h3>
                  <p className="sr-only">연말 기준 PER 추이를 통해 밸류에이션 변화를 분석합니다</p>

                  {result && result.length > 0 ? (
                    <ListPEREnhanced data={result} />
                  ) : (
                    <NoDataDisplay
                      title="연도별 PER 데이터 없음"
                      description="시계열 데이터를 불러올 수 없습니다"
                      iconType="table"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 사이드바 네비게이션 (데스크톱) */}
        <div className="hidden xl:block">
          <div className="sticky top-20 space-y-6">
            {/* 페이지 네비게이션 */}
            <div className="rounded-xl border bg-background p-4">
              <h3 className="text-sm font-semibold mb-3">페이지 내비게이션</h3>
              <nav className="space-y-2">
                <a
                  href="#security-overview"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  <Building2 className="h-3 w-3" />
                  종목 개요
                </a>
                <a
                  href="#chart-analysis"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  <BarChart3 className="h-3 w-3" />
                  차트 분석
                </a>
                {comparableSecuritiesWithPER && comparableSecuritiesWithPER.length > 1 && (
                  <a
                    href="#securities-summary"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                    종목 비교
                  </a>
                )}
                <a
                  href="#indicators"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  <TrendingUp className="h-3 w-3" />
                  핵심 지표
                </a>
                <a
                  href="#annual-data"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  <FileText className="h-3 w-3" />
                  연도별 데이터
                </a>
              </nav>
            </div>

            {/* 빠른 요약 사이드바 카드 */}
            <div className="rounded-xl border bg-background p-4">
              <h3 className="text-sm font-semibold mb-3">빠른 요약</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">현재 PER</span>
                  <span className="font-medium text-foreground">{periodAnalysis?.latestPER ? `${periodAnalysis.latestPER.toFixed(2)}배` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PER 랭킹</span>
                  <span className="font-medium text-foreground">{perRank ? `${perRank}위` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">현재 주가</span>
                  <span className="font-medium text-foreground">{security.prices?.[0]?.close ? `${security.prices[0].close.toLocaleString()}원` : "—"}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground">데이터 기간</span>
                  <span className="font-medium text-foreground">{result.length > 0 ? `${result.length}년` : "—"}</span>
                </div>
              </div>
            </div>

            {/* 종목별 PER 비교 */}
            {comparableSecuritiesWithPER && comparableSecuritiesWithPER.length > 1 && companyMarketcapData && (
              <InteractiveSecuritiesSection
                companyMarketcapData={companyMarketcapData}
                companySecs={comparableSecuritiesWithPER}
                currentTicker={currentTicker}
                market={market}
                layout="sidebar"
                maxItems={4}
                showSummaryCard={true}
                compactMode={false}
                baseUrl="security"
                currentMetric="per"
              />
            )}
          </div>
        </div>
      </main>
    </LayoutWrapper>
  );
}
