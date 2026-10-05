import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from "next";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { SecurityMetricEmpty } from "@/components/security-metric-empty";
import { Building2, BarChart3, ArrowLeftRight, TrendingUp, FileText } from "lucide-react";
import { getSecurityByCode, getCompanySecurities, getSecurityMetricsHistory } from "@/lib/data/security";
import { getCompanyAggregatedMarketcap } from "@/lib/data/company";
import { getPbrRank } from "@/lib/data/security";
import { getTopSecuritiesWithTypeByMetric } from "@/lib/select";
import ChartPBREnhanced from "@/components/chart-PBR-enhanced";
import ListPBRMarketcap from "@/components/list-pbr-marketcap";
import RankHeader from "@/components/header-rank";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";
import { InteractiveSecuritiesSection } from "@/components/simple-interactive-securities";
import { KeyMetricsSectionPBR } from "@/components/key-metrics-section-pbr";
import { KeyMetricsSidebarPBR } from "@/components/key-metrics-sidebar-pbr";
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
import { SecPbrPager } from "@/components/pager-marketcap-security";
import {
  EDGE_TO_EDGE_CARD_BASE,
  EDGE_TO_EDGE_SECTION_BASE,
  SECTION_GRADIENTS,
} from "@/components/marketcap/layout";

const ACTIVE_METRIC = {
  id: "pbr",
  label: "주가순자산비율",
  description: "PBR",
} as const;
import { processPBRData, calculatePBRPeriodAnalysis, coerceVolumeValue, type PBRData } from "@/lib/pbr-utils";
import PBRChartWithPeriodSwitcher from "@/components/pbr-chart-with-period-switcher";

/**
 * Props for Security PBR Page
 */
interface SecurityPBRPageProps {
  params: Promise<{ secCode: string }>;
}

/**
 * Generate metadata for the security PBR page
 */
export async function generateMetadata({ params }: SecurityPBRPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: "종목을 찾을 수 없습니다 - CD3",
      description: "요청하신 종목을 찾을 수 없습니다.",
    };
  }

  const canonical = `${siteConfig.url}/security/${secCode}/pbr/`;

  return {
    alternates: { canonical },
    openGraph: { ...(await parent).openGraph, url: canonical },
    title: `${security.korName || security.name} 주가순자산비율 PBR - CD3`,
    description: `${security.korName || security.name}의 연도별 주가순자산비율(PBR) 변동 차트와 상세 분석 정보를 확인하세요.`,
  };
}

/**
 * Generate static params for all PBR pages (SSG)
 * Only generates representative securities (보통주)
 */
export async function generateStaticParams() {
  try {
    const securities = await getTopSecuritiesWithTypeByMetric('pbr');

    // Filter to only include 보통주 (common stocks)
    const commonStocks = securities.filter((sec) =>
      sec.type?.includes("보통주")
    );

    const securityCodes = commonStocks.map((sec) => sec.code);

    console.log(`[GENERATE_STATIC_PARAMS] Generating PBR pages for ${securityCodes.length} common stocks`);

    return securityCodes.map((secCode) => ({
      secCode: secCode,
    }));
  } catch (error) {
    console.error('[GENERATE_STATIC_PARAMS] Error generating PBR params:', error);
    throw error;
  }
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
    pbrRank,
    companyMarketcapData
  ] = await Promise.all([
    // Get company-related securities if this security has a company
    security.companyId ? getCompanySecurities(security.companyId) : Promise.resolve([]),
    // Get PBR data
    getSecurityMetricsHistory(security.securityId),
    // Get PBR rank
    getPbrRank(security.securityId),
    // Get company marketcap data for Interactive Securities Section
    security.companyId ? getCompanyAggregatedMarketcap(security.companyId) : Promise.resolve(null)
  ]);

  if (!data || data.length === 0) {
    return <SecurityMetricEmpty
      secCode={secCode}
      displayName={security.korName || security.name || secCode}
      metricLabel={ACTIVE_METRIC.label}
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

  // 🔥 종목별 PBR 데이터 추가 - 종목 비교를 위해 현재 PBR 값을 포함
  const comparableSecuritiesWithPBR = await Promise.all(
    comparableSecurities.map(async (sec) => {
      try {
        // 각 종목의 최신 PBR 데이터 가져오기
        const securityWithPBR = await getSecurityByCode(`${sec.exchange}.${sec.ticker}`);
        return {
          ...sec,
          pbr: securityWithPBR?.pbr ?? null,
          pbrDate: securityWithPBR?.pbrDate ?? null,
        };
      } catch (error) {
        console.error(`Failed to get PBR data for ${sec.ticker}:`, error);
        throw error;
      }
    })
  );

  // Transform data to match expected format for PBR
  const result = processPBRData(data);

  const annualCsvData = result.map((item) => ({
    date: item.date,
    pbr: item.value,
    bps: item.bps || 0,
  }));

  const latestHistoryDate = annualCsvData.at(-1)?.date;
  const sanitizedSecCode = secCode.replace(/\./g, "-");
  const annualDownloadFilename = `${sanitizedSecCode}-pbr${latestHistoryDate ? `-${latestHistoryDate}` : ""}.csv`;

  // Calculate period analysis for PBR
  const periodAnalysis = calculatePBRPeriodAnalysis(result, displayName, market);

  const pbrValues = result.map(item => item.value).filter(val => val != null && val > 0);
  const rangeMin = pbrValues.length > 0 ? Math.min(...pbrValues) : 0;
  const rangeMax = pbrValues.length > 0 ? Math.max(...pbrValues) : 0;

  // 기간별 평균 PBR 계산 (기존 호환성을 위해 유지)
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

  const headerDetail = {
    label: "PBR",
    value: latestPBR ? `${latestPBR.toFixed(2)}배` : "—",
    badge: securityType,
  } as const;

  const titleSuffix = "PBR";

  const shareTitle = `${displayName} ${securityType} PBR 분석 | ${siteConfig.name}`;
  const shareText = `${displayName}의 주가순자산비율(PBR) 변동 차트와 상세 분석 정보를 ${siteConfig.name}에서 확인하세요.`;
  const shareUrl = `${siteConfig.url}/security/${secCode}/pbr`;

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
    <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-background bg-background rounded-lg border-2 border-dashed border-border border-border">
      <div className="w-12 h-12 bg-background bg-background rounded-full flex items-center justify-center">
        {iconType === "chart" ? (
          <svg className="w-6 h-6 text-muted-foreground text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-muted-foreground text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground text-muted-foreground">{description}</p>
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
        metricType="pbr"
        metricValue={security.pbr}
      />

      <div className="detail-content min-w-0">
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
          <span className="font-medium text-foreground">PBR</span>
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
        <RankHeader rank={pbrRank} marketcap={security.pbr ?? undefined} price={security.prices?.[0]?.close}
          exchange={security.exchange || market} isCompanyLevel={false}
          rankLabel="종목 PBR 순위" marketcapLabel="현재 PBR" marketcapUnit="배" />
        <p className="mt-2 text-xs text-muted-foreground">{security.type || "종목"} · {currentTicker} · 기준일 {security.pbrDate ? new Date(security.pbrDate!).toISOString().slice(0, 10) : '확인 중'} · 종목별 지표</p>
        <CompanyFinancialTabs secCode={secCode} className="mt-4" />

        <div className="mt-5 space-y-4 sm:mt-8 sm:space-y-6">
          <div className="space-y-3">
            <p className="text-base text-muted-foreground md:text-lg">
              <strong>{displayName}의 PBR(주가순자산비율, Price to Book Ratio)</strong>은 기업의 주가가 순자산에 비해 고평가 또는 저평가되어 있는지를 보여주는 중요한 투자 지표입니다. 낮은 PBR은 청산가치 대비 저평가 가능성을, 높은 PBR은 시장의 성장 기대감을 시사할 수 있습니다.
            </p>
            <div className="sm:hidden">
              <ShareButton
                title={shareTitle}
                text={shareText}
                url={shareUrl}
              />
            </div>
          </div>

          <details className="border-y border-border py-3 text-sm"><summary className="cursor-pointer font-medium">지표 설명 · 계산식</summary><div data-slot="alert"  className="relative  w-auto border border-border/60 bg-card/80 px-4 py-4 text-sm text-card-foreground  sm:mx-0 rounded-sm sm:px-5">
            <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info mt-0.5 h-5 w-5" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <div data-slot="alert-description" className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p className="font-medium">계산식: PBR = 주가 ÷ 주당순자산(BPS)</p>
                <div className="space-y-1">
                  <p className="font-medium">해석 방법</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>PBR이 1배 미만:</strong> 현재 주가가 청산가치보다 낮아 저평가된 상태일 수 있습니다. (가치투자 관점에서 매력적일 수 있음)</li>
                    <li><strong>PBR이 1배 이상:</strong> 현재 주가가 청산가치보다 높아 고평가된 상태일 수 있습니다. 미래 성장에 대한 기대가 반영된 경우가 많습니다.</li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  자세한 내용은 <a href="https://www.investopedia.com/terms/p/price-to-bookratio.asp" target="_blank" rel="noopener noreferrer" className="text-foreground text-foreground text-foreground text-foreground underline">Investopedia PBR 설명</a>을 참고하세요.
                </p>
              </div>
            </div>
          </div></details>
        </div>

        <div className="mt-6 space-y-6 sm:mt-8 sm:space-y-10">
          {/* 종목 개요 섹션 */}
          <section
            id="security-overview"
            className={`${EDGE_TO_EDGE_SECTION_BASE} border-border border-border bg-background`}
            style={SECTION_GRADIENTS.overview}
          >
            <header className="flex flex-wrap items-center gap-4">
              <div className="hidden bg-background bg-background">
                <Building2 className="h-6 w-6 text-foreground text-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">종목 개요</h2>
                <p className="text-sm text-muted-foreground text-muted-foreground md:text-base">PBR 순위와 기본 정보를 확인합니다</p>
              </div>
            </header>

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
                    <dt className="text-muted-foreground">현재 PBR</dt>
                    <dd className="font-medium text-right">{latestPBR ? `${latestPBR.toFixed(2)}배` : "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">기준일</dt>
                    <dd className="font-medium text-right">
                      {security.pbrDate ? new Date(security.pbrDate).toLocaleDateString('ko-KR') : "—"}
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
                    <dt className="text-muted-foreground">PBR 순위</dt>
                    <dd className="text-right font-medium">
                      {pbrRank ? `${pbrRank}위` : "—"}
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
            className={`${EDGE_TO_EDGE_SECTION_BASE} border-border border-border bg-background`}
            style={SECTION_GRADIENTS.charts}
          >
            <header className="flex flex-wrap items-center gap-4">
              <div className="hidden bg-background bg-background">
                <BarChart3 className="h-6 w-6 text-foreground text-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">차트 분석</h2>
                <p className="text-sm text-muted-foreground text-muted-foreground md:text-base">{displayName}의 PBR 변동 패턴과 분포를 다양한 차트로 분석합니다</p>
              </div>
            </header>

            <div className={`grid gap-4 sm:gap-6 lg:auto-rows-max lg:items-stretch lg:gap-6 xl:gap-8`}>
              {/* PBR 히트맵 */}
              <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE}`}>
                <div className="px-3 pt-3 sm:px-5 sm:pt-5">
                  <h3 className="text-base font-semibold text-foreground text-foreground">
                    PBR 히트맵
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {displayName}의 연도별 월간 PBR 변동을 히트맵으로 분석합니다.
                  </p>
                </div>
                <div className="flex flex-1 flex-col px-2 pb-3 pt-2 sm:px-5 sm:pb-5 sm:pt-3">
                  <div className="min-h-[200px] sm:min-h-[260px] flex-1">
                    {result && result.length > 0 ? (
                      <div className="mb-2 sm:mb-4">
                        <p className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">📌 보는 법</p>
                        <ul className="text-xs sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1 ml-3 sm:ml-4 list-disc list-inside">
                          <li>짙은 색: PBR이 높은 고평가 구간</li>
                          <li>옅은 색: PBR이 낮은 저평가 구간</li>
                          <li>연도별 월간 변동 패턴으로 시장 흐름 파악</li>
                        </ul>
                      </div>
                    ) : null}
                    <NoDataDisplay
                      title="PBR 히트맵 데이터 없음"
                      description="히트맵 데이터를 불러올 수 없습니다"
                      iconType="chart"
                    />
                  </div>
                </div>
              </div>

              {/* PBR 히스토그램 / KDE 분포 */}
              <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE}`}>
                <div className="px-3 pt-3 sm:px-5 sm:pt-5">
                  <h3 className="text-base font-semibold text-foreground text-foreground">
                    PBR 히스토그램 / KDE 분포
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {displayName}의 전체 기간 PBR 분포를 히스토그램과 KDE 곡선으로 분석합니다.
                  </p>
                </div>
                <div className="flex flex-1 flex-col px-2 pb-3 pt-2 sm:px-5 sm:pb-5 sm:pt-3">
                  <div className="min-h-[200px] sm:min-h-[260px] flex-1">
                    {result && result.length > 0 ? (
                      <div className="mb-2 sm:mb-4">
                        <p className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">📌 분석 포인트</p>
                        <ul className="text-xs sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1 ml-3 sm:ml-4 list-disc list-inside">
                          <li>막대: PBR 구간별 빈도 분포</li>
                          <li>곡선: KDE로 나타낸 연속 분포</li>
                          <li>평균과 중앙값으로 분포 중심 파악</li>
                        </ul>
                      </div>
                    ) : null}
                    <NoDataDisplay
                      title="PBR 분포 데이터 없음"
                      description="분포 데이터를 불러올 수 없습니다"
                      iconType="chart"
                    />
                  </div>
                </div>
              </div>

              {/* 최근 3개월 가격 차트 */}
              <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE}`}>
                <div className="px-3 pt-3 sm:px-5 sm:pt-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-foreground text-foreground">최근 3개월 가격 차트</h3>
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
                <div className="hidden bg-background bg-background">
                  <ArrowLeftRight className="h-6 w-6 text-foreground text-foreground" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">종목 비교</h2>
                  <p className="text-sm text-muted-foreground text-muted-foreground md:text-base">해당 기업 내 다른 종목과 PBR을 비교합니다</p>
                </div>
              </header>

              <InteractiveSecuritiesSection
                companyMarketcapData={companyMarketcapData}
                companySecs={comparableSecuritiesWithPBR}
                market={market}
                currentTicker={currentTicker}
                baseUrl="security"
                currentMetric="pbr"
                highlightActiveTicker
              />
            </section>
          )}

          <div className="space-y-4 sm:space-y-8">

            
          </div>

          {/* 핵심 지표 섹션 */}
          {periodAnalysis && (
            <KeyMetricsSectionPBR
              security={security}
              pbrRank={pbrRank}
              latestPBR={periodAnalysis.latestPBR}
              pbr12Month={periodAnalysis.periods.find(p => p.label === '12개월 평균')?.value ?? null}
              pbr3Year={periodAnalysis.periods.find(p => p.label === '3년 평균')?.value ?? null}
              pbr5Year={periodAnalysis.periods.find(p => p.label === '5년 평균')?.value ?? null}
              pbr10Year={periodAnalysis.periods.find(p => p.label === '10년 평균')?.value ?? null}
              pbr20Year={periodAnalysis.periods.find(p => p.label === '20년 평균')?.value ?? null}
              rangeMin={periodAnalysis.minMax.min}
              rangeMax={periodAnalysis.minMax.max}
              result={result}
            />
          )}

          {/* 연도별 데이터 섹션 */}
          <section
            id="annual-data"
            className={`${EDGE_TO_EDGE_SECTION_BASE} border-border border-border bg-background`}
            style={SECTION_GRADIENTS.annual}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground text-foreground">
              <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] uppercase tracking-widest text-foreground  bg-background text-foreground">
                탭 연동
              </span>
              <span className="text-sm font-semibold text-foreground text-foreground">
                PBR 연도별 데이터 흐름
              </span>
            </div>
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="hidden bg-background bg-background">
                  <FileText className="h-6 w-6 text-foreground text-foreground" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">연도별 데이터</h2>
                  <p className="text-sm text-muted-foreground text-muted-foreground md:text-base">PBR 차트와 연말 기준 상세 데이터를 확인합니다</p>
                </div>
              </div>
              {annualCsvData.length > 0 && (
                <CsvDownloadButton
                  data={annualCsvData}
                  filename={annualDownloadFilename}
                  className="self-start border-border text-foreground bg-background border-border text-foreground bg-background"
                />
              )}
            </header>

            <div className="space-y-5 sm:space-y-8">
              {result && result.length > 0 ? (
                <PBRChartWithPeriodSwitcher initialData={result} />
              ) : (
                <div className={`${EDGE_TO_EDGE_CARD_BASE} p-2 sm:p-4`}>
                  <NoDataDisplay
                    title="PBR 차트 데이터 없음"
                    description="연간 PBR 데이터를 불러올 수 없습니다"
                    iconType="chart"
                  />
                </div>
              )}

              <div className="space-y-4 sm:space-y-6">
                <p className="sr-only">연말 기준 PBR 추이를 통해 밸류에이션 변화를 분석합니다</p>

                {result && result.length > 0 ? (
                  <ListPBRMarketcap data={result} />
                ) : (
                  <NoDataDisplay
                    title="연도별 PBR 데이터 없음"
                    description="시계열 데이터를 불러올 수 없습니다"
                    iconType="table"
                  />
                )}
              </div>
            </div>
          </section>

          <div className="pt-1 sm:pt-2">
            <SecPbrPager rank={pbrRank || 1} />
          </div>
        </div>
      </div>

      {/* 사이드바 네비게이션 (데스크톱) */}
      <aside className="context-rail order-first xl:order-last">
        <SidebarManager
          navigationSections={navigationSections}
          periodAnalysis={periodAnalysis}
          perRank={pbrRank}
          security={security}
          secCode={secCode}
          hasCompanyMarketcapData={hasCompanyMarketcapData}
          companySecs={companySecs}
          comparableSecuritiesWithPER={comparableSecuritiesWithPBR}
          currentTicker={currentTicker}
          market={market}
          companyMarketcapData={companyMarketcapData}
          metricType="pbr"
        />
      </aside>
    </div>
  );
}
