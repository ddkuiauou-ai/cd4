import { notFound } from "next/navigation";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import { TrendingUp, Building2, FileText, BarChart, ArrowLeftRight, BarChart3 } from "lucide-react";
import Link from "next/link";
import { getSecurityByCode, getCompanySecurities, getSecurityMetricsHistory, getDivRank } from "@/lib/data/security";
import { getCompanyAggregatedMarketcap } from "@/lib/data/company";
import { getTopSecurityCodesByMetric } from "@/lib/select";
import { coerceVolumeValue } from "@/lib/per-utils";
import ListDIVMarketcap from "@/components/list-div-marketcap";
import DIVChartWithPeriodSwitcher from "@/components/div-chart-with-period-switcher";
import { StickyCompanyHeader } from "@/components/sticky-company-header";
import ShareButton from "@/components/share-button";
import { siteConfig } from "@/config/site";
import { PageNavigation } from "@/components/page-navigation";
import { SidebarManager } from "@/components/sidebar-manager";
import { CandlestickChart } from "@/components/chart-candlestick";
import { InteractiveSecuritiesSection } from "@/components/simple-interactive-securities";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";
import RankHeader from "@/components/header-rank";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { RecentSecurityTracker } from "@/components/recent-security-tracker";
import { Marquee } from "@/components/ui/marquee";
import { SecDivPager } from "@/components/pager-marketcap-security";
import type { Price } from "@/typings";

import {
  EDGE_TO_EDGE_CARD_BASE,
  EDGE_TO_EDGE_SECTION_BASE,
  SECTION_GRADIENTS,
} from "@/components/marketcap/layout";

const ACTIVE_METRIC = {
  id: "div",
  label: "배당수익률",
  description: "Dividend Yield",
} as const;

/**
 * Props for Security DIV Page
 */
/**
 * Generate static params for all security pages (SSG)
 */
export async function generateStaticParams() {
  try {
    const securityCodes = await getTopSecurityCodesByMetric('div');

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

  const security = await getSecurityByCode(secCode);

  if (!security) {
    notFound();
  }

  // Extract market from secCode (e.g., "KOSPI.005930" -> "KOSPI")
  const market = secCode.includes('.') ? secCode.split('.')[0] : 'KOSPI';

  // Extract ticker from secCode (e.g., "KOSPI.005930" -> "005930")
  const currentTicker = secCode.includes('.') ? secCode.split('.')[1] : secCode;

  // Parallelize independent data fetching
  const [
    securities,
    data,
    divRank,
    companyMarketcapData
  ] = await Promise.all([
    // Get company-related securities if this security has a company
    security.companyId ? getCompanySecurities(security.companyId) : Promise.resolve([]),
    // Get DIV data
    getSecurityMetricsHistory(security.securityId),
    // Get DIV rank
    getDivRank(security.securityId),
    // Get company marketcap data for Interactive Securities Section
    security.companyId ? getCompanyAggregatedMarketcap(security.companyId).catch(() => null) : Promise.resolve(null)
  ]);

  const commonSecurities = securities.filter((sec) => sec.type === "보통주");

  // 종목 비교용 필터링: 보통주와 우선주만 표시
  const comparableSecurities = securities.filter((sec) =>
    sec.type === "보통주" || sec.type === "우선주"
  );

  // 🔥 종목별 배당수익률 데이터 추가 - 종목 비교를 위해 현재 배당수익률 값을 포함
  const comparableSecuritiesWithDIV = await Promise.all(
    comparableSecurities.map(async (sec) => {
      try {
        // 각 종목의 최신 배당수익률 데이터 가져오기
        const securityWithDIV = await getSecurityByCode(`${sec.exchange}.${sec.ticker}`);
        return {
          ...sec,
          div: securityWithDIV?.div || null,
          divDate: securityWithDIV?.divDate || null,
        };
      } catch (error) {
        console.error(`Failed to get DIV data for ${sec.ticker}:`, error);
        return {
          ...sec,
          div: null,
          divDate: null,
        };
      }
    })
  );

  // 🔥 CD3 방어적 프로그래밍: 데이터가 없는 경우 404 처리
  if (!data || data.length === 0) {
    notFound();
  }

  // DIV 데이터 처리 및 중복 제거 최적화
  const processDIVData = (rawData: any[]) => {
    const dataMap = new Map<string, { value: number; index: number }>();

    // 단일 패스로 데이터 처리 및 중복 제거
    rawData.forEach((item, index) => {
      if (item.div !== null) {
        const dateKey = item.date instanceof Date
          ? item.date.toISOString().split('T')[0]
          : String(item.date);

        const existing = dataMap.get(dateKey);
        if (!existing || existing.index < index) {
          dataMap.set(dateKey, { value: item.div, index });
        }
      }
    });

    // 정렬된 결과 반환
    return Array.from(dataMap.entries())
      .map(([date, { value }], arrayIndex) => ({
        date,
        value,
        uniqueKey: `${date}-${arrayIndex}`,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const result = processDIVData(data);

  const displayName = security.korName || security.name;

  // 배당수익률 히스토그램 데이터 생성 함수 최적화
  const createDividendYieldHistogram = (data: Array<{ value: number }>) => {
    if (!data?.length) return [];

    const values = data.map(item => item.value).filter((val): val is number =>
      val !== null && val !== undefined && !Number.isNaN(val)
    );

    if (values.length === 0) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const binSize = 0.5;
    const binCount = Math.ceil((max - min) / binSize);

    // 빈도 계산을 위한 맵 사용으로 효율성 향상
    const frequencyMap = new Map<number, number>();

    values.forEach(val => {
      const binIndex = Math.floor((val - min) / binSize);
      frequencyMap.set(binIndex, (frequencyMap.get(binIndex) || 0) + 1);
    });

    return Array.from(frequencyMap.entries())
      .map(([binIndex, frequency]) => {
        const binStart = min + (binIndex * binSize);
        const binEnd = binStart + binSize;
        return {
          range: `${binStart.toFixed(1)}-${binEnd.toFixed(1)}%`,
          frequency,
          binStart,
          binEnd
        };
      })
      .sort((a, b) => a.binStart - b.binStart);
  };

  const histogramData = createDividendYieldHistogram(result);

  // 배당수익률 기간별 분석 계산 최적화
  const calculateDividendYieldPeriodAnalysis = (data: Array<{ date: string; value: number }>) => {
    if (!data?.length) return null;

    const validData = data.filter(item => item.value !== null && item.value !== undefined);
    if (!validData.length) return null;

    const values = validData.map(item => item.value);
    const latest = values[values.length - 1];
    const sortedValues = [...values].sort((a, b) => a - b);

    // 기간별 평균 계산을 위한 헬퍼 함수
    const calculatePeriodAverage = (months: number, dataWithDates: Array<{ dateObj: Date; value: number }>) => {
      const cutoffDate = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000);
      const filteredData = dataWithDates.filter(item => item.dateObj >= cutoffDate);
      return filteredData.length > 0
        ? filteredData.reduce((sum, item) => sum + item.value, 0) / filteredData.length
        : null;
    };

    // 날짜 객체와 함께 데이터 준비 (한 번만 수행)
    const dataWithDates = validData.map(item => ({
      dateObj: new Date(item.date),
      value: item.value
    }));

    // 기간별 평균 계산
    const periodConfigs = [
      { months: 12, label: '12개월 평균' },
      { months: 36, label: '3년 평균' },
      { months: 60, label: '5년 평균' }
    ];

    const periods = periodConfigs
      .map(({ months, label }) => {
        const avg = calculatePeriodAverage(months, dataWithDates);
        return avg !== null ? { label, value: avg } : null;
      })
      .filter(Boolean);

    return {
      latest,
      minMax: {
        min: sortedValues[0],
        max: sortedValues[sortedValues.length - 1]
      },
      periods
    };
  };

  const dividendYieldAnalysis = calculateDividendYieldPeriodAnalysis(result);

  const annualCsvData = result.map((item) => ({
    date: item.date,
    div: item.value,
  }));

  const latestHistoryDate = annualCsvData.at(-1)?.date;
  const sanitizedSecCode = secCode.replace(/\./g, "-");
  const annualDownloadFilename = `${sanitizedSecCode}-div${latestHistoryDate ? `-${latestHistoryDate}` : ""}.csv`;


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
        } as const;
      })
      .filter((point) => point !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime()); // 시간순 정렬 필수

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
    ...(hasCompanyMarketcapData && securities.length > 0
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

  const hasSidebarContent = dividendYieldAnalysis || (hasCompanyMarketcapData && securities.length > 0);

  return (
    <main className="relative py-4 sm:py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px]">
      {/* 최근 본 종목 추적 */}
      <RecentSecurityTracker
        secCode={secCode}
        name={security.name || ""}
        korName={security.korName}
        ticker={currentTicker}
        exchange={market}
        metricType="div"
        metricValue={security.div}
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
          {security.companyId ? (
            <Link
              href={`/company/marketcaps?search=${encodeURIComponent(security.company?.korName || displayName)}`}
              className="transition-colors hover:text-foreground"
            >
              {security.company?.korName || displayName}
            </Link>
          ) : (
            <span className="truncate text-foreground">
              {displayName}
            </span>
          )}
          <ChevronRightIcon className="h-4 w-4" />
          <span className="text-foreground">{security.type}</span>
          <ChevronRightIcon className="h-4 w-4" />
          <span className="font-medium text-foreground">배당수익률</span>
        </nav>

        <StickyCompanyHeader
          displayName={displayName}
          companyName={security.company?.korName || security.company?.name}
          logoUrl={security.company?.logo}
          titleSuffix="DIV"
          titleBadge={security.type ?? null}
          detail={{
            label: "배당수익률",
            value: security.div ? `${security.div.toFixed(2)}%` : "—",
            badge: security.type,
          }}
          actions={
            <ShareButton
              title={`${displayName} ${security.type} 배당수익률 분석 | ${siteConfig.name}`}
              text={`${displayName}의 배당수익률 변동 차트와 상세 분석 정보를 ${siteConfig.name}에서 확인하세요.`}
              url={`${siteConfig.url}/security/${secCode}/div`}
            />
          }
        />

        <div className="mt-5 space-y-4 sm:mt-8 sm:space-y-6">
          <div className="space-y-3">
            <p className="text-base text-muted-foreground md:text-lg">
              <strong>{displayName}의 배당수익률(Dividend Yield)</strong>은 투자한 자본 대비 받을 수 있는 배당금의 비율을 나타내는 중요한 투자 지표입니다. 배당수익률이 높을수록 투자자에게 돌아오는 현금 흐름이 크다는 의미입니다.
            </p>
            <div className="sm:hidden">
              <ShareButton
                title={`${displayName} ${security.type} 배당수익률 분석 | ${siteConfig.name}`}
                text={`${displayName}의 배당수익률 변동 차트와 상세 분석 정보를 ${siteConfig.name}에서 확인하세요.`}
                url={`${siteConfig.url}/security/${secCode}/div`}
              />
            </div>
          </div>

          <div data-slot="alert" role="alert" className="relative -mx-4 w-auto border border-border/60 bg-card/80 px-4 py-4 text-sm text-card-foreground shadow-sm sm:mx-0 sm:rounded-2xl sm:px-5">
            <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-info mt-0.5 h-5 w-5" aria-hidden="true">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <div data-slot="alert-description" className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p className="font-medium">계산식: 배당수익률 = (연간 배당금 ÷ 현재 주가) × 100</p>
                <div className="space-y-1">
                  <p className="font-medium">해석 방법</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>배당수익률이 높을수록:</strong> 투자자에게 돌아오는 현금 배당이 많다는 의미이나, 기업의 실적 악화로 주가가 하락한 결과일 수 있습니다.</li>
                    <li><strong>배당수익률이 낮을수록:</strong> 주가가 상승하여 배당 대비 주가가 고평가되었음을 의미하며, 기업의 성장 잠재력이 반영된 경우가 많습니다.</li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  자세한 내용은 <a href="https://www.investopedia.com/terms/d/dividendyield.asp" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline">Investopedia 배당수익률 설명</a>을 참고하세요.
                </p>
              </div>
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
                <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">배당수익률 순위와 기본 정보를 확인합니다</p>
              </div>
            </header>

            <div className="space-y-6">
              <RankHeader
                rank={divRank}
                marketcap={security.div || undefined}
                price={security.prices?.[0]?.close}
                exchange={security.exchange || 'KOSPI'}
                isCompanyLevel={false}
                rankLabel="배당수익률 랭킹"
                marketcapLabel="현재 배당수익률"
                marketcapUnit="%"
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
                    <dd className="font-medium text-right">{security.type}</dd>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">거래소</dt>
                    <dd className="font-medium text-right">{security.exchange || 'KOSPI'}</dd>
                  </div>
                </dl>
                <dl className="space-y-2 border-t border-border/60 p-4 sm:border-t-0 sm:border-l">
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">티커</dt>
                    <dd className="font-medium text-right">{secCode.includes('.') ? secCode.split('.')[1] : secCode}</dd>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">현재 배당수익률</dt>
                    <dd className="font-medium text-right">{security.div ? `${security.div.toFixed(2)}%` : "—"}</dd>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">기준일</dt>
                    <dd className="font-medium text-right">
                      {security.divDate ? new Date(security.divDate).toLocaleDateString('ko-KR') : "—"}
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
                    <dt className="text-muted-foreground">배당수익률 순위</dt>
                    <dd className="text-right font-medium">
                      {divRank ? `${divRank}위` : "—"}
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
                <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">차트 분석</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">{displayName}의 배당수익률 변동 패턴을 차트로 분석합니다</p>
              </div>
            </header>

            <div className={`grid gap-4 sm:gap-6 lg:auto-rows-max lg:items-stretch lg:gap-6 xl:gap-8`}>
              {/* 배당수익률 히스토그램 및 분포 차트 */}
              <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE}`}>
                <div className="px-3 pt-3 sm:px-5 sm:pt-5">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    배당수익률 히스토그램 및 분포 차트
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    일정 기간 동안의 배당수익률이 어떤 구간에 가장 많이 분포했는지를 보여주는 차트입니다.
                  </p>
                </div>
                <div className="flex flex-1 flex-col px-2 pb-3 pt-2 sm:px-5 sm:pb-5 sm:pt-3">
                  <div className="min-h-[200px] sm:min-h-[260px] flex-1">
                    {histogramData && histogramData.length > 0 ? (
                      <>
                        {/* 히스토그램 인사이트 */}
                        <div className="mb-2 sm:mb-4">
                          <p className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">💡 분석 포인트</p>
                          <ul className="text-xs sm:text-sm text-muted-foreground space-y-0.5 sm:space-y-1 ml-3 sm:ml-4 list-disc list-inside">
                            <li>평균적인 배당수익률 수준 파악</li>
                            <li>변동성 확인 및 안정성 분석</li>
                            <li>역사적 수준 비교 및 투자 판단</li>
                          </ul>
                        </div>

                        {/* 히스토그램 차트 */}
                        <div className="space-y-2">
                          {histogramData.map((bin, index) => (
                            <div key={index} className="flex items-center gap-3">
                              <div className="w-20 text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
                                {bin.range}
                              </div>
                              <div className="flex-1">
                                <div className="relative">
                                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-sm overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-sm transition-all duration-500 ease-out"
                                      style={{
                                        width: `${histogramData.length > 0 ? (bin.frequency / Math.max(...histogramData.map(d => d.frequency))) * 100 : 0}%`
                                      }}
                                    ></div>
                                  </div>
                                  <div className="absolute inset-0 flex items-center justify-end pr-2">
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                      {bin.frequency}일
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* 축 레이블 */}
                        <div className="mt-4 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                          <span>x축: 배당수익률 구간</span>
                          <span>y축: 빈도 (일수)</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 sm:p-8 space-y-2 sm:space-y-4 text-center">
                        <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
                          <BarChart className="w-4 h-4 sm:w-6 sm:h-6 text-gray-400 dark:text-gray-500" />
                        </div>
                        <div className="space-y-1 sm:space-y-2">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100">히스토그램 데이터 없음</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">히스토그램 데이터를 생성할 수 없습니다</p>
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
                        {displayName} ({secCode.includes('.') ? secCode.split('.')[1] : secCode})의 일별 시가 · 고가 · 저가 · 종가와 거래량 흐름을 확인합니다.
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
          {hasCompanyMarketcapData && securities.length > 0 && (
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
                  <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">해당 기업 내 다른 종목과 배당수익률을 비교합니다</p>
                </div>
              </header>

              <InteractiveSecuritiesSection
                companyMarketcapData={companyMarketcapData}
                companySecs={comparableSecuritiesWithDIV}
                market={security.exchange || 'KOSPI'}
                currentTicker={secCode.includes('.') ? secCode.split('.')[1] : secCode}
                baseUrl="security"
                currentMetric="div"
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
          {dividendYieldAnalysis && (
            <section
              id="indicators"
              className={`${EDGE_TO_EDGE_SECTION_BASE} border-yellow-200/70 dark:border-yellow-900/40 dark:bg-yellow-950/20`}
              style={SECTION_GRADIENTS.indicators}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-yellow-700/80 dark:text-yellow-200/80">
                <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] uppercase tracking-widest text-yellow-700 shadow-sm dark:bg-yellow-900/40 dark:text-yellow-200">
                  탭 연동
                </span>
                <span className="text-sm font-semibold text-yellow-800/90 dark:text-yellow-100/90">
                  배당수익률 기준 핵심 지표
                </span>
              </div>
              <header className="flex flex-wrap items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-100 dark:bg-yellow-900/40">
                  <TrendingUp className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">핵심 지표</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-300 md:text-base">
                    배당수익률 분석과 주요 투자 지표
                  </p>
                </div>
              </header>

              <Marquee
                pauseOnHover
                className="[--duration:36s]"
              >
                {/* 배당수익률 랭킹 */}
                <div className="group rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer flex-shrink-0 snap-center w-fit min-w-[112px] sm:min-w-[140px] lg:min-w-[168px] max-w-[260px] min-h-[96px] gap-1 pb-2" style={{ minWidth: "fit-content" }}>
                  <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                    <span className="text-xl sm:text-2xl md:text-3xl">{divRank || "—"}</span>
                    {divRank && <span className="text-sm sm:text-base ml-1">위</span>}
                  </div>
                  <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                    배당수익률 랭킹
                  </div>
                </div>

                {/* 현재 배당수익률 */}
                <div className="group rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer flex-shrink-0 snap-center w-fit min-w-[112px] sm:min-w-[140px] lg:min-w-[168px] max-w-[260px] min-h-[96px]">
                  <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                    <span className="text-xl sm:text-2xl md:text-3xl">{dividendYieldAnalysis.latest ? dividendYieldAnalysis.latest.toFixed(1) : "—"}</span>
                    {dividendYieldAnalysis.latest && <span className="text-sm sm:text-base ml-1">%</span>}
                  </div>
                  <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                    현재 배당수익률
                  </div>
                </div>

                {/* 12개월 평균 배당수익률 */}
                <div className="group rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer flex-shrink-0 snap-center w-fit min-w-[112px] sm:min-w-[140px] lg:min-w-[168px] max-w-[260px] min-h-[96px]">
                  <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                    <span className="text-xl sm:text-2xl md:text-3xl">{(() => {
                      const period = dividendYieldAnalysis?.periods?.find(p => p?.label === '12개월 평균');
                      return period?.value ? period.value.toFixed(1) : "—";
                    })()}</span>
                    {(() => {
                      const period = dividendYieldAnalysis?.periods?.find(p => p?.label === '12개월 평균');
                      return period?.value ? <span className="text-sm sm:text-base ml-1">%</span> : null;
                    })()}
                  </div>
                  <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                    12개월 평균
                  </div>
                </div>

                {/* 3년 평균 배당수익률 */}
                <div className="group rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer flex-shrink-0 snap-center w-fit min-w-[112px] sm:min-w-[140px] lg:min-w-[168px] max-w-[260px] min-h-[96px]">
                  <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                    <span className="text-xl sm:text-2xl md:text-3xl">{(() => {
                      const period = dividendYieldAnalysis?.periods?.find(p => p?.label === '3년 평균');
                      return period?.value ? period.value.toFixed(1) : "—";
                    })()}</span>
                    {(() => {
                      const period = dividendYieldAnalysis?.periods?.find(p => p?.label === '3년 평균');
                      return period?.value ? <span className="text-sm sm:text-base ml-1">%</span> : null;
                    })()}
                  </div>
                  <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                    3년 평균
                  </div>
                </div>

                {/* 5년 평균 배당수익률 */}
                <div className="group rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer flex-shrink-0 snap-center w-fit min-w-[112px] sm:min-w-[140px] lg:min-w-[168px] max-w-[260px] min-h-[96px]">
                  <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                    <span className="text-xl sm:text-2xl md:text-3xl">{(() => {
                      const period = dividendYieldAnalysis?.periods?.find(p => p?.label === '5년 평균');
                      return period?.value ? period.value.toFixed(1) : "—";
                    })()}</span>
                    {(() => {
                      const period = dividendYieldAnalysis?.periods?.find(p => p?.label === '5년 평균');
                      return period?.value ? <span className="text-sm sm:text-base ml-1">%</span> : null;
                    })()}
                  </div>
                  <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                    5년 평균
                  </div>
                </div>

                {/* 최저 배당수익률 */}
                <div className="group rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer flex-shrink-0 snap-center w-fit min-w-[112px] sm:min-w-[140px] lg:min-w-[168px] max-w-[260px] min-h-[96px]">
                  <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                    <span className="text-xl sm:text-2xl md:text-3xl">{dividendYieldAnalysis.minMax.min ? dividendYieldAnalysis.minMax.min.toFixed(1) : "—"}</span>
                    {dividendYieldAnalysis.minMax.min && <span className="text-sm sm:text-base ml-1">%</span>}
                  </div>
                  <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                    최저 배당수익률
                  </div>
                </div>

                {/* 최고 배당수익률 */}
                <div className="group rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800/50 p-2 flex flex-col items-center justify-center text-center hover:shadow-md dark:hover:shadow-lg transition-all duration-200 cursor-pointer flex-shrink-0 snap-center w-fit min-w-[112px] sm:min-w-[140px] lg:min-w-[168px] max-w-[260px] min-h-[96px]">
                  <div className="flex items-baseline justify-center font-bold text-primary dark:text-gray-100 mb-1 leading-none">
                    <span className="text-xl sm:text-2xl md:text-3xl">{dividendYieldAnalysis.minMax.max ? dividendYieldAnalysis.minMax.max.toFixed(1) : "—"}</span>
                    {dividendYieldAnalysis.minMax.max && <span className="text-sm sm:text-base ml-1">%</span>}
                  </div>
                  <div className="text-xs text-muted-foreground dark:text-gray-400 leading-tight px-1">
                    최고 배당수익률
                  </div>
                </div>
              </Marquee>
            </section>
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
                  <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">배당수익률 차트와 연말 기준 상세 데이터를 확인합니다</p>
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
                <DIVChartWithPeriodSwitcher initialData={result} />
              ) : (
                <div className={`${EDGE_TO_EDGE_CARD_BASE} p-2 sm:p-4`}>
                  <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center bg-gray-50 dark:bg-gray-900/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">배당수익률 차트 데이터 없음</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">연간 배당수익률 데이터를 불러올 수 없습니다</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4 sm:space-y-6">
                <p className="sr-only">연말 기준 배당수익률 추이를 통해 배당 정책 변화를 분석합니다</p>

                <ListDIVMarketcap data={result.map(item => ({ date: item.date, value: item.value }))} />
              </div>
            </div>
          </section>

          <div className="pt-1 sm:pt-2">
            <SecDivPager rank={divRank || 1} />
          </div>
        </div>

      </div>

      {/* 사이드바 네비게이션 (데스크톱) */}
      <div className="hidden xl:block">
        <SidebarManager
          navigationSections={navigationSections}
          periodAnalysis={dividendYieldAnalysis ? {
            latestDIV: dividendYieldAnalysis.latest,
            periods: dividendYieldAnalysis.periods
              .filter((period): period is NonNullable<typeof period> => period !== null)
              .map(period => ({
                ...period,
                desc: period.label // desc 속성 추가
              })),
            minMax: dividendYieldAnalysis.minMax,
            currentSecurity: security.korName || security.name,
            market: market
          } : null}
          perRank={divRank}
          security={security}
          secCode={secCode}
          hasCompanyMarketcapData={hasCompanyMarketcapData}
          companySecs={securities}
          comparableSecuritiesWithPER={comparableSecuritiesWithDIV}
          currentTicker={secCode.includes('.') ? secCode.split('.')[1] : secCode}
          market={security.exchange || 'KOSPI'}
          companyMarketcapData={companyMarketcapData}
          metricType="div"
        />
      </div>
    </main>
  );
}
