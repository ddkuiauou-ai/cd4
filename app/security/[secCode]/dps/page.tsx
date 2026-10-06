import { DetailMobileNavigation } from '@/components/detail-mobile-navigation';
import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from "next";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { SecurityMetricEmpty } from "@/components/detail-metric-empty";
import { Building2, BarChart3, ArrowLeftRight, TrendingUp, FileText } from "lucide-react";
import { getSecurityByCode, getCompanySecurities, getSecurityMetricsHistory } from "@/lib/data/security";
import { getCompanyAggregatedMarketcap } from "@/lib/data/company";
import { getSecurityMetricDetailRanking } from '@/lib/data/security-ranking-detail';
import { getTopSecurityCodesByMetric } from "@/lib/select";
import DPSChartWithPeriodSwitcher from "@/components/dps-chart-with-period-switcher";
import ListDPSMarketcap from "@/components/list-dps-marketcap";
import DPSHeatmap from "@/components/chart-dps-heatmap";
import ChartDPSDistribution from "@/components/chart-dps-distribution";
import type { HeatMapSerie } from '@nivo/heatmap';
import RankHeader from "@/components/header-rank";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";
import { InteractiveSecuritiesSection } from "@/components/simple-interactive-securities";
import { KeyMetricsSectionDPS } from "@/components/key-metrics-section-dps";
import { KeyMetricsSidebarDPS } from "@/components/key-metrics-sidebar-dps";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { RecentSecurityTracker } from "@/components/recent-security-tracker";
import { SidebarManager } from "@/components/sidebar-manager";
import { StickyCompanyHeader } from "@/components/sticky-company-header";
import ShareButton from "@/components/share-button";
import { siteConfig } from "@/config/site";
import { CandlestickChart } from "@/components/chart-candlestick";
import type { Price } from "@/typings";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { PageNavigation } from "@/components/page-navigation";
import { SecDpsPager } from "@/components/pager-marketcap-security";
import {
  EDGE_TO_EDGE_CARD_BASE,
  EDGE_TO_EDGE_SECTION_BASE,
  SECTION_GRADIENTS,
} from "@/components/marketcap/layout";

const ACTIVE_METRIC = {
  id: "dps",
  label: "주당배당금",
  description: "DPS",
} as const;
import { calculateDPSPeriodAnalysis, processDPSDataWithGrowth, coerceVolumeValue } from "@/lib/dps-utils";

/**
 * Props for Security DPS Page
 */
interface SecurityDPSPageProps {
  params: Promise<{ secCode: string }>;
}

/**
 * Generate metadata for the security DPS page
 */
export async function generateMetadata({ params }: SecurityDPSPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: `종목을 찾을 수 없습니다`,
      description: "요청하신 종목을 찾을 수 없습니다.",
    };
  }

  const canonical = `${siteConfig.url}/security/${secCode}/dps/`;

  return {
    alternates: { canonical },
    openGraph: { ...(await parent).openGraph, url: canonical },
    title: `${security.korName || security.name} 주당배당금 DPS`,
    description: `${security.korName || security.name}의 연도별 주당배당금(DPS) 변동 차트와 상세 분석 정보를 확인하세요.`,
  };
}

/**
 * Generate static params for all DPS pages (SSG)
 */
export async function generateStaticParams() {
  try {
    const securityCodes = await getTopSecurityCodesByMetric('dps');

    return securityCodes.map((secCode) => ({
      secCode: secCode,
    }));
  } catch (error) {
    console.error('[GENERATE_STATIC_PARAMS] Error generating DPS params:', error);
    throw error;
  }
}

/**
 * Security DPS Page
 * Displays DPS data and charts for a specific security
 */
export default async function SecurityDPSPage({ params }: SecurityDPSPageProps) {
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
    rankingEvidence,
    companyMarketcapData
  ] = await Promise.all([
    // Get company-related securities if this security has a company
    security.companyId ? getCompanySecurities(security.companyId) : Promise.resolve([]),
    // Get DPS data
    getSecurityMetricsHistory(security.securityId),
    // Get DPS rank
    getSecurityMetricDetailRanking(security.securityId, 'dps'),
    // Get company marketcap data for Interactive Securities Section
    security.companyId ? getCompanyAggregatedMarketcap(security.companyId) : Promise.resolve(null)
  ]);
  const { currentRank: dpsRank, rankDate } = rankingEvidence;


  if (!data || data.length === 0) {
    return <SecurityMetricEmpty
      secCode={secCode}
      displayName={security.korName || security.name || secCode}
      metricLabel={ACTIVE_METRIC.label}
      metricType="dps" security={security} companySecs={companySecs} companyMarketcapData={companyMarketcapData}
      rank={dpsRank} rankDate={rankDate}
    />;
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
    sec.type?.includes("보통주") || sec.type?.includes("우선주")
  );

  // 🔥 종목별 DPS 데이터 추가 - 종목 비교를 위해 현재 DPS 값을 포함
  const comparableSecuritiesWithDPS = await Promise.all(
    comparableSecurities.map(async (sec) => {
      try {
        // 각 종목의 최신 DPS 데이터 가져오기
        const securityWithDPS = await getSecurityByCode(`${sec.exchange}.${sec.ticker}`);
        return {
          ...sec,
          dps: securityWithDPS?.dps ?? null,
          dpsDate: securityWithDPS?.dpsDate ?? null,
        };
      } catch (error) {
        console.error(`Failed to get DPS data for ${sec.ticker}:`, error);
        throw error;
      }
    })
  );

  // Transform data to match expected format for DPS with growth rate
  const result = processDPSDataWithGrowth(data);

  const annualCsvData = result.map((item) => ({
    date: item.date,
    dps: item.value,
  }));

  const latestHistoryDate = annualCsvData.at(-1)?.date;
  const sanitizedSecCode = secCode.replace(/\./g, "-");
  const annualDownloadFilename = `${sanitizedSecCode}-dps${latestHistoryDate ? `-${latestHistoryDate}` : ""}.csv`;

  // Calculate period analysis for DPS
  const periodAnalysis = calculateDPSPeriodAnalysis(result, displayName, market);

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

  // Prepare heatmap data 최적화
  const prepareHeatmapData = (result: any[]) => {
    if (!result?.length) return [];

    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

    // 단일 패스로 데이터 그룹화 및 연도 수집
    const grouped: Record<number, Record<string, number>> = {};
    const yearSet = new Set<string>();

    result.forEach(item => {
      const date = new Date(item.date);
      const year = date.getFullYear().toString();
      const month = date.getMonth();

      if (!grouped[month]) grouped[month] = {};
      grouped[month][year] = item.value;
      yearSet.add(year);
    });

    const allYears = Array.from(yearSet).sort();

    // 효율적인 데이터 생성
    return monthNames
      .map((monthName, index) => {
        const monthData = grouped[index] || {};
        const dataPoints = allYears
          .map(year => ({
            x: year,
            y: monthData[year] ?? null
          }))
          .filter((point): point is { x: string; y: number } => point.y !== null);

        return dataPoints.length > 0 ? {
          id: monthName,
          data: dataPoints
        } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  };

  const heatmapData = prepareHeatmapData(result);

  const headerDetail = {
    label: "DPS",
    value: security.dps != null ? `${security.dps!.toFixed(2)}원` : "—",
    badge: securityType,
  } as const;

  const titleSuffix = "DPS";

  const shareTitle = `${displayName} ${securityType} DPS 분석`;
  const shareText = `${displayName}의 주당배당금(DPS) 변동 차트와 상세 분석 정보를 ${siteConfig.name}에서 확인하세요.`;
  const shareUrl = `${siteConfig.url}/security/${secCode}/dps`;

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

  // Common NoData display component
  const NoDataDisplay = ({ title, description, iconType = "chart" }: {
    title: string;
    description: string;
    iconType?: "chart" | "table";
  }) => (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-background rounded-lg border-2 border-dashed border-border">
      <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center">
        {iconType === "chart" ? (
          <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );

  return (
    <div className="app-container detail-grid">
      {/* 최근 본 종목 추적 */}
      <RecentSecurityTracker
        secCode={secCode}
        name={security.name || ""}
        korName={security.korName}
        ticker={currentTicker}
        exchange={market}
        metricType="dps"
        metricValue={security.dps}
      />

      <div className="detail-content min-w-0">
        {/* 브레드크럼 네비게이션 */}
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
        >
          <Link href="/" className="transition-colors hover:text-foreground">
            홈
          </Link>
          <ChevronRightIcon className="h-4 w-4" />
          <Link href="/marketcaps" className="transition-colors hover:text-foreground">
            기업 순위
          </Link>
          <ChevronRightIcon className="h-4 w-4" />
          {companySecCode ? (
            <Link
              href={`/company/${companySecCode}`}
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
          <span className="font-medium text-foreground">DPS</span>
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
        <RankHeader rank={dpsRank} marketcap={security.dps ?? undefined} price={security.prices?.[0]?.close}
          exchange={security.exchange || market} isCompanyLevel={false}
          rankLabel="종목 주당배당금 순위" marketcapLabel="현재 주당배당금" marketcapUnit="원" />
        <p className="mt-2 text-xs text-muted-foreground">{security.type || "종목"} · {currentTicker} · 기준일 {security.dpsDate ? new Date(security.dpsDate!).toISOString().slice(0, 10) : '확인 중'} · 종목별 지표 · 순위 기준 {rankDate || '—'}</p>
        <CompanyFinancialTabs secCode={secCode} className="mt-4" />
        <DetailMobileNavigation sections={navigationSections} />



        <div className="detail-primary-sections space-y-6 sm:space-y-8">

          {/* 종목 개요 섹션 */}
          <details
            id="security-overview"
            className={`${EDGE_TO_EDGE_SECTION_BASE} border-border border-border bg-background`}
            style={SECTION_GRADIENTS.overview}
          >
            <summary className="cursor-pointer text-sm font-semibold">기본 정보</summary>

            <div className="space-y-6">


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
                    <dt className="text-muted-foreground">현재 DPS</dt>
                    <dd className="font-medium text-right">{security.dps != null ? `${security.dps!.toFixed(2)}원` : "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">기준일</dt>
                    <dd className="font-medium text-right">
                      {security.dpsDate ? new Date(security.dpsDate).toLocaleDateString('ko-KR') : "—"}
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
                    <dt className="text-muted-foreground">DPS 순위</dt>
                    <dd className="text-right font-medium">
                      {dpsRank ? `${dpsRank}위` : "—"}
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
          </details>

          {/* 차트 분석 섹션 */}
          <section
            id="chart-analysis"
            className={`${EDGE_TO_EDGE_SECTION_BASE} border-border border-border bg-background`}
            style={SECTION_GRADIENTS.charts}
          >
            <header className="flex flex-wrap items-center gap-4">
              <div className="hidden bg-background">
                <BarChart3 className="h-6 w-6 text-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">차트 분석</h2>
                <p className="text-sm text-muted-foreground md:text-base">{displayName}의 DPS 변동 패턴과 분포를 다양한 차트로 분석합니다</p>
              </div>
            </header>

            <div className={`grid gap-4 sm:gap-6 lg:auto-rows-max lg:items-stretch lg:gap-6 xl:gap-8`}>
              {/* DPS 히트맵 */}
              <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE}`}>
                <div className="px-3 pt-3 sm:px-5 sm:pt-5">
                  <h3 className="text-base font-semibold text-foreground">
                    DPS 히트맵
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {displayName}의 연도별 월간 DPS 변동을 히트맵으로 분석합니다.
                  </p>
                </div>
                <div className="flex flex-1 flex-col px-2 pb-3 pt-2 sm:px-5 sm:pb-5 sm:pt-3">
                  <div className="min-h-[200px] sm:min-h-[260px] flex-1">
                    {heatmapData && heatmapData.length > 0 ? (
                      <div className="mb-2 sm:mb-4">
                        <p className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">📌 보는 법</p>
                        <ul className="text-xs sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1 ml-3 sm:ml-4 list-disc list-inside">
                          <li>짙은 색: DPS가 높은 배당 구간</li>
                          <li>옅은 색: DPS가 낮은 배당 구간</li>
                          <li>연도별 월간 변동 패턴으로 배당 정책 파악</li>
                        </ul>
                      </div>
                    ) : null}
                    {heatmapData && heatmapData.length > 0 ? (
                      <DPSHeatmap
                        data={heatmapData}
                        minValue={periodAnalysis?.minMax.min || 0}
                        maxValue={periodAnalysis?.minMax.max || 100}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 sm:p-8 space-y-2 sm:space-y-4 text-center">
                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-background rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 sm:w-6 sm:h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div className="space-y-1 sm:space-y-2">
                          <p className="text-xs sm:text-sm font-medium text-foreground">DPS 히트맵 데이터 없음</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">히트맵 데이터를 불러올 수 없습니다</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* DPS 히스토그램 / KDE 분포 */}
              <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE}`}>
                <div className="px-3 pt-3 sm:px-5 sm:pt-5">
                  <h3 className="text-base font-semibold text-foreground">
                    DPS 히스토그램 / KDE 분포
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {displayName}의 전체 기간 DPS 분포를 히스토그램과 KDE 곡선으로 분석합니다.
                  </p>
                </div>
                <div className="flex flex-1 flex-col px-2 pb-3 pt-2 sm:px-5 sm:pb-5 sm:pt-3">
                  <div className="min-h-[200px] sm:min-h-[260px] flex-1">
                    {result && result.length > 0 ? (
                      <div className="mb-2 sm:mb-4">
                        <p className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">📌 분석 포인트</p>
                        <ul className="text-xs sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1 ml-3 sm:ml-4 list-disc list-inside">
                          <li>막대: DPS 구간별 빈도 분포</li>
                          <li>곡선: KDE로 나타낸 연속 분포</li>
                          <li>평균과 중앙값으로 배당 중심 파악</li>
                        </ul>
                      </div>
                    ) : null}
                    {result && result.length > 0 ? (
                      <ChartDPSDistribution data={result} />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 sm:p-8 space-y-2 sm:space-y-4 text-center">
                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-background rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 sm:w-6 sm:h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div className="space-y-1 sm:space-y-2">
                          <p className="text-xs sm:text-sm font-medium text-foreground">DPS 분포 데이터 없음</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">분포 데이터를 불러올 수 없습니다</p>
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
                      <h3 className="text-base font-semibold text-foreground">최근 3개월 가격 차트</h3>
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
              className={`${EDGE_TO_EDGE_SECTION_BASE} border-border border-border bg-background`}
              style={SECTION_GRADIENTS.securities}
            >
              <header className="flex flex-wrap items-center gap-4">
                <div className="hidden bg-background">
                  <ArrowLeftRight className="h-6 w-6 text-foreground" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">종목 비교</h2>
                  <p className="text-sm text-muted-foreground md:text-base">해당 기업 내 다른 종목과 DPS을 비교합니다</p>
                </div>
              </header>

              <InteractiveSecuritiesSection
                companyMarketcapData={companyMarketcapData}
                companySecs={comparableSecuritiesWithDPS}
                market={market}
                currentTicker={currentTicker}
                baseUrl="security"
                currentMetric="dps"
                highlightActiveTicker
              />
            </section>
          )}



          {/* 핵심 지표 섹션 */}
          {periodAnalysis && (
            <KeyMetricsSectionDPS
              security={security}
              dpsRank={dpsRank}
              latestDPS={security.dps ?? null}
              dps12Month={periodAnalysis.periods.find(p => p.label === '12개월 평균')?.value ?? null}
              dps3Year={periodAnalysis.periods.find(p => p.label === '3년 평균')?.value ?? null}
              dps5Year={periodAnalysis.periods.find(p => p.label === '5년 평균')?.value ?? null}
              dps10Year={periodAnalysis.periods.find(p => p.label === '10년 평균')?.value ?? null}
              dps20Year={periodAnalysis.periods.find(p => p.label === '20년 평균')?.value ?? null}
              rangeMin={periodAnalysis.minMax.min}
              rangeMax={periodAnalysis.minMax.max}
              result={result.filter(item => item.value !== null).map(item => ({ date: item.date, value: item.value as number }))}
            />
          )}

          {/* 연도별 데이터 섹션 */}
          <section
            id="annual-data"
            className={`${EDGE_TO_EDGE_SECTION_BASE} border-border border-border bg-background`}
            style={SECTION_GRADIENTS.annual}
          >

            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="hidden bg-background">
                  <FileText className="h-6 w-6 text-foreground" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">연도별 데이터</h2>
                  <p className="text-sm text-muted-foreground md:text-base">DPS 차트와 연말 기준 상세 데이터를 확인합니다</p>
                </div>
              </div>
              {annualCsvData.length > 0 && (
                <CsvDownloadButton
                  data={annualCsvData}
                  filename={annualDownloadFilename}
                  className="self-start border-border text-foreground bg-background"
                />
              )}
            </header>

            <div className="space-y-5 sm:space-y-8">
              {result && result.length > 0 ? (
                <DPSChartWithPeriodSwitcher initialData={result} />
              ) : (
                <div className={`${EDGE_TO_EDGE_CARD_BASE} p-2 sm:p-4`}>
                  <NoDataDisplay
                    title="DPS 차트 데이터 없음"
                    description="연간 DPS 데이터를 불러올 수 없습니다"
                    iconType="chart"
                  />
                </div>
              )}

              <div className="space-y-4 sm:space-y-6">
                <p className="sr-only">연말 기준 DPS 추이를 통해 배당 정책의 변화를 분석합니다</p>

                <ListDPSMarketcap data={result.map(item => ({ date: item.date, value: item.value }))} />
              </div>
            </div>
          </section>

          <div className="pt-1 sm:pt-2">
            {dpsRank != null && <SecDpsPager rank={dpsRank} currentSecurityId={security.securityId} rankDate={rankDate} />}
          </div>
        </div>
        <div className="mt-6"><details className="border-y border-border py-3 text-sm"><summary className="cursor-pointer font-medium">지표 설명 · 계산식</summary><div data-slot="alert"  className="relative w-auto border border-border/60 bg-card/80 px-4 py-4 text-sm text-card-foreground sm:mx-0 rounded-sm sm:px-5">
            <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info mt-0.5 h-5 w-5" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <div data-slot="alert-description" className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p className="font-medium">계산식: DPS = 총 배당금 ÷ 발행 주식 수</p>
                <div className="space-y-1">
                  <p className="font-medium">해석 방법</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>DPS가 높을수록:</strong> 주주들에게 더 많은 배당금을 지급하는 기업으로, 배당 투자자에게 매력적일 수 있습니다.</li>
                    <li><strong>DPS가 안정적일수록:</strong> 기업의 수익 안정성과 배당 정책의 일관성을 나타냅니다.</li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  자세한 내용은 <a href="https://www.investopedia.com/terms/d/dividendper-share.asp" target="_blank" rel="noopener noreferrer" className="text-foreground underline">Investopedia DPS 설명</a>을 참고하세요.
                </p>
              </div>
            </div>
          </div></details></div>
      </div>

      {/* 사이드바 네비게이션 (데스크톱) */}
      <aside className="context-rail hidden xl:block">
        <SidebarManager
          navigationSections={navigationSections}
          periodAnalysis={periodAnalysis}
          perRank={dpsRank}
          security={security}
          secCode={secCode}
          rankDate={rankDate}
          hasCompanyMarketcapData={hasCompanyMarketcapData}
          companySecs={companySecs}
          comparableSecuritiesWithPER={comparableSecuritiesWithDPS}
          currentTicker={currentTicker}
          market={market}
          companyMarketcapData={companyMarketcapData}
          metricType="dps"
        />
      </aside>
    </div>
  );
}
