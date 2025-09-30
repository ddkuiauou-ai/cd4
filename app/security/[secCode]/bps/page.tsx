import { notFound } from "next/navigation";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Building2, BarChart3, ArrowLeftRight, TrendingUp, FileText } from "lucide-react";
import { getSecurityByCode, getCompanySecurities, getSecurityMetricsHistory } from "@/lib/data/security";
import { getCompanyAggregatedMarketcap } from "@/lib/data/company";
import { getBpsRank } from "@/lib/data/security";
import { getAllSecuritiesWithType } from "@/lib/select";
import BPSHeatmap from "@/components/chart-bps-heatmap";
import ChartBPSDistribution from "@/components/chart-bps-distribution";
import type { HeatMapSerie } from '@nivo/heatmap';
import RankHeader from "@/components/header-rank";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";
import { InteractiveSecuritiesSection } from "@/components/simple-interactive-securities";
import { KeyMetricsSectionBPS } from "@/components/key-metrics-section-bps";
import { KeyMetricsSidebarBPS } from "@/components/key-metrics-sidebar-bps";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { RecentSecurityTracker } from "@/components/recent-security-tracker";
import { StickyCompanyHeader } from "@/components/sticky-company-header";
import ShareButton from "@/components/share-button";
import { siteConfig } from "@/config/site";
import { PageNavigation } from "@/components/page-navigation";
import { SidebarManager } from "@/components/sidebar-manager";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { SecBpsPager } from "@/components/pager-marketcap-security";
import { CandlestickChart } from "@/components/chart-candlestick";
import type { Price } from "@/typings";
import {
  EDGE_TO_EDGE_CARD_BASE,
  EDGE_TO_EDGE_SECTION_BASE,
  SECTION_GRADIENTS,
} from "@/components/marketcap/layout";

const ACTIVE_METRIC = {
  id: "bps",
  label: "주당순자산가치",
  description: "BPS",
} as const;
import { calculateBPSPeriodAnalysis, processBPSData } from "@/lib/bps-utils";
import { coerceVolumeValue } from "@/lib/per-utils";
import BPSChartWithPeriodSwitcher from "@/components/bps-chart-with-period-switcher";
import ListBPSMarketcap from "@/components/list-bps-marketcap";

/**
 * Props for Security BPS Page
 */
/**
 * Generate static params for all BPS pages (SSG)
 * Only generates representative securities (보통주)
 */
export async function generateStaticParams() {
  try {
    const securities = await getAllSecuritiesWithType();

    // Filter to only include 보통주 (common stocks)
    const commonStocks = securities.filter((sec) =>
      sec.type?.includes("보통주")
    );

    const securityCodes = commonStocks.map((sec) => `${sec.exchange}.${sec.ticker}`);


    return securityCodes.map((secCode) => ({
      secCode: secCode,
    }));
  } catch (error) {
    console.error("[GENERATE_STATIC_PARAMS] Error generating BPS params:", error);
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

  const security = await getSecurityByCode(secCode);

  if (!security) {
    notFound();
  }

  const displayName = security.korName || security.name;
  const securityType = security.type || "종목";

  // Extract market from secCode (e.g., "KOSPI.005930" -> "KOSPI")
  const market = secCode.includes('.') ? secCode.split('.')[0] : 'KOSPI';

  // Extract ticker from secCode (e.g., "KOSPI.005930" -> "005930")
  const currentTicker = secCode.includes('.') ? secCode.split('.')[1] : secCode;

  // Parallelize independent data fetching
  const [
    companySecs,
    data,
    bpsRank,
    companyMarketcapData
  ] = await Promise.all([
    // Get company-related securities if this security has a company
    security.companyId ? getCompanySecurities(security.companyId) : Promise.resolve([]),
    // Get BPS data
    getSecurityMetricsHistory(security.securityId),
    // Get BPS rank
    getBpsRank(security.securityId),
    // Get company marketcap data for Interactive Securities Section
    security.companyId ? getCompanyAggregatedMarketcap(security.companyId).catch(() => null) : Promise.resolve(null)
  ]);

  // 🔥 CD3 방어적 프로그래밍: 데이터가 없는 경우 404 처리
  if (!data || data.length === 0) {
    notFound();
  }

  // Find representative security (보통주)
  const representativeSecurity = companySecs.find((sec) =>
    sec.type?.includes("보통주"),
  );

  const companySecCode =
    representativeSecurity?.exchange && representativeSecurity?.ticker
      ? `${representativeSecurity.exchange}.${representativeSecurity.ticker}`
      : null;

  // 종목 비교용 필터링: 보통주와 우선주만 표시
  const comparableSecurities = companySecs.filter((sec) =>
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

  // Transform data to match expected format for BPS
  const result = processBPSData(data);

  // Prepare heatmap data
  function prepareHeatmapData(result: any[]) {
    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

    // Group by month and year
    const grouped: Record<number, Record<string, number>> = {};
    result.forEach(item => {
      const date = new Date(item.date);
      const year = date.getFullYear().toString();
      const month = date.getMonth(); // 0-11
      if (!grouped[month]) grouped[month] = {};
      grouped[month][year] = item.value;
    });

    // Get all years
    const allYears = Array.from(new Set(result.map(item => new Date(item.date).getFullYear().toString()))).sort();

    // Create data
    const data: HeatMapSerie<{ x: string, y: number }, object>[] = monthNames.map((monthName, index) => {
      const monthData = grouped[index] || {};
      const dataPoints = allYears.map(year => ({
        x: year,
        y: monthData[year] ?? null
      })).filter((point): point is { x: string, y: number } => point.y !== null); // Only include points with data

      return {
        id: monthName,
        data: dataPoints
      };
    }).filter(item => item.data.length > 0); // Only include months with data

    return data;
  }

  const heatmapData = prepareHeatmapData(result);

  // Process price data for candlestick chart 최적화
  const processPriceData = (prices: any[], daysLimit = 90) => {
    if (!Array.isArray(prices)) return { sortedPoints: [], candlestickData: [] };

    const validPoints = prices
      .map((price) => {
        // 날짜 파싱
        const date = price?.date instanceof Date
          ? price.date
          : new Date(price?.date ?? "");

        if (!date || Number.isNaN(date.getTime())) return null;

        // OHLC 값 검증 및 기본값 설정
        const close = price?.close ?? price?.open ?? null;
        const open = price?.open ?? price?.close ?? null;

        if (close === null || open === null) return null;

        const high = price?.high ?? Math.max(open, close);
        const low = price?.low ?? Math.min(open, close);
        const volume = coerceVolumeValue(price?.volume, price?.fvolume);

        // 유효성 검증
        if (!Number.isFinite(open) || !Number.isFinite(high) ||
          !Number.isFinite(low) || !Number.isFinite(close)) {
          return null;
        }

        return {
          date,
          time: Math.floor(date.getTime() / 1000) as any, // Unix timestamp (초 단위)
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
          volume: Number.isFinite(volume) ? Number(volume) : null,
        };
      })
      .filter((point) => point !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (!validPoints.length) return { sortedPoints: [], candlestickData: [] };

    // 최근 데이터 필터링 (최적화)
    const latestPoint = validPoints[validPoints.length - 1];
    const referenceDate = new Date(latestPoint.date.getTime());
    const startDate = new Date(referenceDate.getTime() - daysLimit * 24 * 60 * 60 * 1000);

    let recentData = validPoints.filter(point => point.date >= startDate);
    if (!recentData.length) {
      recentData = validPoints.slice(-daysLimit);
    }

    const candlestickData = recentData.map((point) => ({
      time: point.time,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: Number.isFinite(point.volume) ? point.volume : undefined,
    }));

    return { sortedPoints: validPoints, candlestickData };
  };

  const { sortedPoints: sortedPricePoints, candlestickData } = processPriceData(security.prices);

  const annualCsvData = result.map((item) => ({
    date: item.date,
    bps: item.value,
  }));

  const latestHistoryDate = annualCsvData.at(-1)?.date;
  const sanitizedSecCode = secCode.replace(/\./g, "-");
  const annualDownloadFilename = `${sanitizedSecCode}-bps${latestHistoryDate ? `-${latestHistoryDate}` : ""}.csv`;

  // Calculate period analysis for BPS
  const periodAnalysis = calculateBPSPeriodAnalysis(result, displayName, market);

  const headerDetail = {
    label: "BPS",
    value: periodAnalysis?.latestBPS ? `${periodAnalysis.latestBPS.toLocaleString()}원` : "—",
    badge: securityType,
  } as const;

  const titleSuffix = "BPS";

  const shareTitle = `${displayName} ${securityType} BPS 분석 | ${siteConfig.name}`;
  const shareText = `${displayName}의 주당순자산가치(BPS) 변동 차트와 상세 분석 정보를 ${siteConfig.name}에서 확인하세요.`;
  const shareUrl = `${siteConfig.url}/security/${secCode}/bps`;

  const hasCompanyMarketcapData = Boolean(
    companyMarketcapData?.aggregatedHistory?.length &&
    companyMarketcapData?.securities?.length,
  );

  const navigationSections = [
    {
      id: "security-overview",
      label: "종목 개요",
      icon: <Building2 className="h-3 w-3" />,
    },
    {
      id: "chart-analysis",
      label: "차트 분석",
      icon: <BarChart3 className="h-3 w-3" />,
    },
    ...(hasCompanyMarketcapData && companySecs.length > 0
      ? [
        {
          id: "securities-summary",
          label: "종목 비교",
          icon: <ArrowLeftRight className="h-3 w-3" />,
        },
      ]
      : []),
    {
      id: "indicators",
      label: "핵심 지표",
      icon: <TrendingUp className="h-3 w-3" />,
    },
    {
      id: "annual-data",
      label: "연도별 데이터",
      icon: <FileText className="h-3 w-3" />,
    },
  ];

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
    <main className="relative py-4 sm:py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px]">
      {/* 최근 본 종목 추적 */}
      <RecentSecurityTracker
        secCode={secCode}
        name={security.name || ""}
        korName={security.korName}
        ticker={currentTicker}
        exchange={market}
        metricType="bps"
        metricValue={security.bps}
      />

      <div className="mx-auto w-full min-w-0">
        {/* 브레드크럼 네비게이션 */}
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
        >
          <Link href="/" className="transition-colors hover:text-foreground">
            홈
          </Link>
          <ChevronRightIcon className="h-4 w-4" />
          <Link href="/company" className="transition-colors hover:text-foreground">
            기업
          </Link>
          <ChevronRightIcon className="h-4 w-4" />
          {companySecCode ? (
            <Link
              href={`/company/${companySecCode}/bps`}
              className="transition-colors hover:text-foreground"
            >
              {security.company?.korName || displayName}
            </Link>
          ) : (
            <span className="truncate text-foreground">
              {security.company?.korName || displayName}
            </span>
          )}
          <ChevronRightIcon className="h-4 w-4" />
          <span className="text-foreground">{securityType}</span>
          <ChevronRightIcon className="h-4 w-4" />
          <span className="font-medium text-foreground">BPS</span>
        </nav>

        <StickyCompanyHeader
          displayName={displayName}
          companyName={security.company?.korName || security.company?.name}
          logoUrl={security.company?.logo}
          titleSuffix={titleSuffix}
          titleBadge={security.type ?? null}
          detail={headerDetail}
          actions={
            <ShareButton
              title={shareTitle}
              text={shareText}
              url={shareUrl}
            />
          }
        />

        <div className="mt-5 space-y-4 sm:mt-8 sm:space-y-6">
          <div className="space-y-3">
            <p className="text-base text-muted-foreground md:text-lg">
              <strong>{displayName}의 BPS(주당순자산가치, Book Value Per Share)</strong>은 기업의 순자산을 발행주식총수로 나눈 값으로, 주주가 받을 수 있는 1주당 자산 가치를 나타냅니다. PBR(주가순자산비율) 계산의 기초가 되는 중요한 재무 지표입니다.
            </p>
            <div className="sm:hidden">
              <ShareButton
                title={shareTitle}
                text={shareText}
                url={shareUrl}
              />
            </div>
          </div>

          <div data-slot="alert" role="alert" className="relative -mx-4 w-auto border border-border/60 bg-card/80 px-4 py-4 text-sm shadow-sm sm:mx-0 sm:rounded-2xl sm:px-5">
            <div data-slot="alert-description" className="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <p className="font-medium">계산식: BPS = 기업 순자산 ÷ 발행주식총수</p>
              <div className="space-y-1">
                <p className="font-medium">해석 방법</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>BPS가 높을수록:</strong> 기업의 자산가치가 높아 안정적인 기업임을 시사합니다.</li>
                  <li><strong>BPS가 낮을수록:</strong> 기업의 자산가치가 낮아 재무 건전성에 주의를 기울여야 합니다.</li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground/70 mt-2">
                자세한 내용은 <a href="https://www.investopedia.com/terms/b/bookvaluepershare.asp" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline">Investopedia BPS 설명</a>을 참고하세요.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-6 sm:mt-14 sm:space-y-16">
          {/* 종목 개요 섹션 */}
          <section
            id="security-overview"
            className={`${EDGE_TO_EDGE_SECTION_BASE} border-blue-200/70 dark:border-blue-900/40 dark:bg-blue-950/20`}
            style={SECTION_GRADIENTS.overview}
          >
            <header className="flex flex-wrap items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-800/50">
                <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">종목 개요</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">BPS 순위와 기본 정보를 확인합니다</p>
              </div>
            </header>

            <div className="space-y-6">
              <RankHeader
                rank={bpsRank}
                marketcap={periodAnalysis?.latestBPS || undefined}
                price={security.prices?.[0]?.close}
                exchange={security.exchange || market}
                isCompanyLevel={false}
                rankLabel="BPS 랭킹"
                marketcapLabel="현재 BPS"
                marketcapUnit="원"
              />

              <div className={`${EDGE_TO_EDGE_CARD_BASE} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
                <dl className="space-y-2 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">종목명</dt>
                    <dd className="font-medium text-right">{displayName}</dd>
                  </div>
                  {security.name && security.korName && security.name !== security.korName && (
                    <div className="flex items-center justify-between text-sm">
                      <dt className="text-muted-foreground">영문명</dt>
                      <dd className="font-medium text-right">{security.name}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">구분</dt>
                    <dd className="font-medium text-right">{securityType}</dd>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">거래소</dt>
                    <dd className="font-medium text-right">{security.exchange || market}</dd>
                  </div>
                </dl>
                <dl className="space-y-2 border-t border-border/60 p-4 sm:border-t-0 sm:border-l">
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">티커</dt>
                    <dd className="font-medium text-right">{currentTicker}</dd>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">현재 BPS</dt>
                    <dd className="font-medium text-right">{periodAnalysis?.latestBPS ? `${periodAnalysis.latestBPS.toLocaleString()}원` : "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">기준일</dt>
                    <dd className="font-medium text-right">
                      {security.bpsDate ? new Date(security.bpsDate).toLocaleDateString('ko-KR') : "—"}
                    </dd>
                  </div>
                </dl>
                <dl className="space-y-2 border-t border-border/60 p-4 sm:col-span-2 sm:border-t-0 lg:col-span-1 lg:border-l">
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">소속 기업</dt>
                    <dd className="text-right font-medium">
                      {security.company?.korName || security.company?.name || "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">BPS 순위</dt>
                    <dd className="text-right font-medium">
                      {bpsRank ? `${bpsRank}위` : "—"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">대표 종목</dt>
                    <dd className="text-right font-medium">
                      {representativeSecurity?.type?.includes("보통주")
                        ? "보통주"
                        : representativeSecurity
                          ? representativeSecurity.type
                          : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          {/* 차트 분석 섹션 */}
          <section
            id="chart-analysis"
            className={`${EDGE_TO_EDGE_SECTION_BASE} border-green-200/70 dark:border-green-900/40 dark:bg-green-950/20`}
            style={SECTION_GRADIENTS.charts}
          >
            <header className="flex flex-wrap items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-800/50">
                <BarChart3 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">차트 분석</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">{displayName}의 BPS 변동 패턴과 분포를 다양한 차트로 분석합니다</p>
              </div>
            </header>

            <div className={`grid gap-4 sm:gap-6 lg:auto-rows-max lg:items-stretch lg:gap-6 xl:gap-8`}>
              {/* BPS 히트맵 */}
              <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE}`}>
                <div className="px-3 pt-3 sm:px-5 sm:pt-5">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    BPS 히트맵
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {displayName}의 연도별 월간 BPS 변동을 히트맵으로 분석합니다.
                  </p>
                </div>
                <div className="flex flex-1 flex-col px-2 pb-3 pt-2 sm:px-5 sm:pb-5 sm:pt-3">
                  <div className="min-h-[200px] sm:min-h-[260px] flex-1">
                    {heatmapData && heatmapData.length > 0 ? (
                      <div className="mb-2 sm:mb-4">
                        <p className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">📌 보는 법</p>
                        <ul className="text-xs sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1 ml-3 sm:ml-4 list-disc list-inside">
                          <li>짙은 색: BPS가 높은 고평가 구간</li>
                          <li>옅은 색: BPS가 낮은 저평가 구간</li>
                          <li>연도별 월간 변동 패턴으로 시장 흐름 파악</li>
                        </ul>
                      </div>
                    ) : null}
                    {heatmapData && heatmapData.length > 0 ? (
                      <BPSHeatmap
                        data={heatmapData}
                        minValue={periodAnalysis?.minMax.min || 0}
                        maxValue={periodAnalysis?.minMax.max || 100}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 sm:p-8 space-y-2 sm:space-y-4 text-center">
                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 sm:w-6 sm:h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div className="space-y-1 sm:space-y-2">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">BPS 히트맵 데이터 없음</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">히트맵 데이터를 불러올 수 없습니다</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* BPS 히스토그램 / KDE 분포 */}
              <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE}`}>
                <div className="px-3 pt-3 sm:px-5 sm:pt-5">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    BPS 히스토그램 / KDE 분포
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {displayName}의 전체 기간 BPS 분포를 히스토그램과 KDE 곡선으로 분석합니다.
                  </p>
                </div>
                <div className="flex flex-1 flex-col px-2 pb-3 pt-2 sm:px-5 sm:pb-5 sm:pt-3">
                  <div className="min-h-[200px] sm:min-h-[260px] flex-1">
                    {result && result.length > 0 ? (
                      <div className="mb-2 sm:mb-4">
                        <p className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">📌 분석 포인트</p>
                        <ul className="text-xs sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1 ml-3 sm:ml-4 list-disc list-inside">
                          <li>막대: BPS 구간별 빈도 분포</li>
                          <li>곡선: KDE로 나타낸 연속 분포</li>
                          <li>평균과 중앙값으로 분포 중심 파악</li>
                        </ul>
                      </div>
                    ) : null}
                    {result && result.length > 0 ? (
                      <ChartBPSDistribution data={result} />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 sm:p-8 space-y-2 sm:space-y-4 text-center">
                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 sm:w-6 sm:h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div className="space-y-1 sm:space-y-2">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">BPS 분포 데이터 없음</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">분포 데이터를 불러올 수 없습니다</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 최근 3개월 가격 차트 */}
              <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE}`}>
                <div className="px-3 pt-3 sm:px-5 sm:pt-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">최근 3개월 가격 차트</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {displayName} ({currentTicker})의 일별 시가 · 고가 · 저가 · 종가와 거래량 흐름을 확인합니다.
                      </p>
                    </div>
                    <span className="self-start sm:self-center rounded-full bg-muted px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold tracking-[0.08em] text-muted-foreground whitespace-nowrap">
                      최근 3개월
                    </span>
                  </div>
                </div>
                <div className="px-3 pb-4 pt-3 sm:px-5 sm:pb-5">
                  <CandlestickChart data={candlestickData} />
                </div>
              </div>
            </div>
          </section>

          {/* 종목 비교 섹션 */}
          {hasCompanyMarketcapData && companySecs.length > 0 && (
            <section
              id="securities-summary"
              className={`${EDGE_TO_EDGE_SECTION_BASE} border-purple-200/70 dark:border-purple-900/40 dark:bg-purple-950/20`}
              style={SECTION_GRADIENTS.securities}
            >
              <header className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-800/50">
                  <ArrowLeftRight className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">종목 비교</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">해당 기업 내 다른 종목과 BPS을 비교합니다</p>
                </div>
              </header>

              <InteractiveSecuritiesSection
                companyMarketcapData={companyMarketcapData}
                companySecs={comparableSecuritiesWithBPS}
                market={market}
                currentTicker={currentTicker}
                baseUrl="security"
                currentMetric="bps"
                highlightActiveTicker
              />
            </section>
          )}

          <div className="space-y-4 sm:space-y-8">
            <CompanyFinancialTabs secCode={secCode} className="-mx-4 sm:mx-0" />

            <div
              className="relative -mx-4 overflow-hidden border border-orange-200/60 bg-orange-50/60 px-4 py-4 text-sm shadow-sm sm:mx-0 sm:rounded-3xl sm:px-6 sm:py-5 dark:border-orange-900/40 dark:bg-orange-950/10"
              style={SECTION_GRADIENTS.indicators}
            >
              <div className="flex flex-col gap-3 text-orange-800/80 dark:text-orange-200/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold tracking-tight text-orange-900 dark:text-orange-200">
                    선택한 지표가 아래 분석 카드에 바로 반영됩니다
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700 shadow-sm dark:bg-orange-900/40 dark:text-orange-200/90">
                    Tab Sync
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-orange-700/90 dark:text-orange-100/80 md:text-sm">
                  <strong className="font-semibold text-orange-900 dark:text-orange-100">{ACTIVE_METRIC.label}</strong>을 포함한 탭을 선택하면 <strong className="font-semibold text-orange-900 dark:text-orange-50">핵심 지표</strong>와 <strong className="font-semibold text-orange-900 dark:text-orange-50">연도별 데이터</strong> 모듈이 함께 갱신되어, 한 화면에서 흐름을 비교할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          {/* 핵심 지표 섹션 */}
          {periodAnalysis && (
            <KeyMetricsSectionBPS
              security={security}
              bpsRank={bpsRank}
              latestBPS={periodAnalysis.latestBPS}
              bps12Month={periodAnalysis.periods.find(p => p.label === '12개월 평균')?.value || null}
              bps3Year={periodAnalysis.periods.find(p => p.label === '3년 평균')?.value || null}
              bps5Year={periodAnalysis.periods.find(p => p.label === '5년 평균')?.value || null}
              bps10Year={periodAnalysis.periods.find(p => p.label === '10년 평균')?.value || null}
              bps20Year={periodAnalysis.periods.find(p => p.label === '20년 평균')?.value || null}
              rangeMin={periodAnalysis.minMax.min}
              rangeMax={periodAnalysis.minMax.max}
              result={result}
            />
          )}

          {/* 연도별 데이터 섹션 */}
          <section
            id="annual-data"
            className={`${EDGE_TO_EDGE_SECTION_BASE} border-red-200/70 dark:border-red-900/40 dark:bg-red-950/20`}
            style={SECTION_GRADIENTS.annual}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-red-700/80 dark:text-red-200/80">
              <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] uppercase tracking-widest text-red-700 shadow-sm dark:bg-red-900/40 dark:text-red-200">
                탭 연동
              </span>
              <span className="text-sm font-semibold text-red-800/90 dark:text-red-100/90">
                {ACTIVE_METRIC.label} 연도별 데이터 흐름
              </span>
              {ACTIVE_METRIC.description && (
                <span className="text-[11px] font-medium text-red-700/70 dark:text-red-100/70">
                  {ACTIVE_METRIC.description}
                </span>
              )}
            </div>
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-800/50">
                  <FileText className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">연도별 데이터</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">BPS 차트와 연말 기준 상세 데이터를 확인합니다</p>
                </div>
              </div>
              {annualCsvData.length > 0 && (
                <CsvDownloadButton
                  data={annualCsvData}
                  filename={annualDownloadFilename}
                  className="self-start border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-100 dark:hover:bg-red-900/30"
                />
              )}
            </header>

            <div className="space-y-5 sm:space-y-8">
              {result && result.length > 0 ? (
                <BPSChartWithPeriodSwitcher initialData={result} />
              ) : (
                <div className={`${EDGE_TO_EDGE_CARD_BASE} p-2 sm:p-4`}>
                  <NoDataDisplay
                    title="BPS 차트 데이터 없음"
                    description="연간 BPS 데이터를 불러올 수 없습니다"
                    iconType="chart"
                  />
                </div>
              )}

              <div className="space-y-4 sm:space-y-6">
                <p className="sr-only">연말 기준 BPS 추이를 통해 자산 가치 변화를 분석합니다</p>

                <ListBPSMarketcap data={result.map(item => ({ date: item.date, value: item.value }))} />
              </div>
            </div>
          </section>

          <div className="pt-1 sm:pt-2">
            <SecBpsPager rank={bpsRank || 1} />
          </div>
        </div>
      </div>

      {/* 사이드바 네비게이션 (데스크톱) */}
      <div className="hidden xl:block">
        <SidebarManager
          navigationSections={navigationSections}
          periodAnalysis={periodAnalysis ? {
            ...periodAnalysis,
            latestValue: periodAnalysis.latestBPS
          } : null}
          perRank={bpsRank}
          security={security}
          secCode={secCode}
          hasCompanyMarketcapData={hasCompanyMarketcapData}
          companySecs={companySecs}
          comparableSecuritiesWithPER={comparableSecuritiesWithBPS}
          currentTicker={currentTicker}
          market={market}
          companyMarketcapData={undefined}
          metricType="bps"
        />
      </div>
    </main >
  );
}
