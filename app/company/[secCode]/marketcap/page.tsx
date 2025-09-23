import { notFound } from "next/navigation";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Building2, BarChart3, ArrowLeftRight, TrendingUp, FileText } from "lucide-react";
import { getSecurityByCode, getCompanySecurities } from "@/lib/data/security";
import { getCompanyAggregatedMarketcap } from "@/lib/data/company";
import { getSecurityMarketCapRanking, getAllCompanyCodes } from "@/lib/select";
import type { CSSProperties } from "react";

import CardCompanyMarketcap from "@/components/card-company-marketcap";
import CardMarketcap from "@/components/card-marketcap";
import ListMarketcap from "@/components/list-marketcap";
import RankHeader from "@/components/header-rank";
import { CompanyMarketcapPager } from "@/components/pager-company-marketcap";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";
import { InteractiveSecuritiesSection } from "@/components/simple-interactive-securities";
import { InteractiveChartSection } from "@/components/interactive-chart-section";
import { CandlestickChart } from "@/components/chart-candlestick";
import { KeyMetricsSection } from "@/components/key-metrics-section";
import { KeyMetricsSidebar } from "@/components/key-metrics-sidebar";
import { PageNavigation } from "@/components/page-navigation";
import { StickyCompanyHeader } from "@/components/sticky-company-header";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";

type RgbTuple = [number, number, number];

const GRADIENT_STOPS = [
  { offset: 0, alpha: 0.09 },
  { offset: 120, alpha: 0.05 },
  { offset: 280, alpha: 0.025 },
  { offset: 520, alpha: 0 },
] as const;

const createSectionGradient = ([r, g, b]: RgbTuple): CSSProperties => ({
  backgroundColor: `rgba(${r}, ${g}, ${b}, 0.02)`,
  backgroundImage: `linear-gradient(180deg, ${GRADIENT_STOPS.map(
    stop => `rgba(${r}, ${g}, ${b}, ${stop.alpha}) ${stop.offset}px`
  ).join(", ")})`,
});

const SECTION_GRADIENTS: Record<string, CSSProperties> = {
  overview: createSectionGradient([59, 130, 246]),
  charts: createSectionGradient([34, 197, 94]),
  securities: createSectionGradient([168, 85, 247]),
  indicators: createSectionGradient([249, 115, 22]),
  annual: createSectionGradient([239, 68, 68]),
};

const EDGE_TO_EDGE_SECTION_BASE =
  "relative -mx-4 space-y-4 border-y px-4 py-4 shadow-sm sm:mx-0 sm:space-y-8 sm:overflow-hidden sm:rounded-3xl sm:border sm:px-6 sm:py-8";

const EDGE_TO_EDGE_CARD_BASE =
  "border border-border/60 bg-background/80 shadow-sm sm:rounded-2xl";

const ACTIVE_METRIC = {
  id: "marketcap",
  label: "시가총액",
  description: "Market Cap",
};

type CompanySecuritySummary = {
  securityId: string;
  korName?: string | null;
  name?: string | null;
  type?: string | null;
};

type AggregatedHistoryEntry = {
  date: Date | string;
  totalMarketcap?: number | null;
  securitiesBreakdown?: Record<string, number | null | undefined>;
};

/**
 * Generate static params for all company marketcap pages (SSG)
 */
export async function generateStaticParams() {
  try {
    const companyCodes = await getAllCompanyCodes();

    return companyCodes.map((secCode) => ({
      secCode: secCode,
    }));
  } catch (error) {
    console.error('[GENERATE_STATIC_PARAMS] Error generating company marketcap params:', error);
    return [];
  }
}

/**
 * Props for Company Marketcap Page
 */
interface CompanyMarketcapPageProps {
  params: Promise<{ secCode: string }>;
}

export default async function CompanyMarketcapPage({ params }: CompanyMarketcapPageProps) {
  const { secCode: initialSecCode } = await params;

  let security = await getSecurityByCode(initialSecCode);

  if (!security) {
    notFound();
  }
  // Get company-related securities if this security has a company
  const companySecs = security.companyId
    ? await getCompanySecurities(security.companyId)
    : [];

  // Determine representative (보통주) security for the company when available
  let resolvedSecCode = initialSecCode;

  if (!security.type?.includes("보통주")) {
    const representativeSecurity = companySecs.find(
      (companySecurity) => companySecurity.type?.includes("보통주")
    );

    if (representativeSecurity?.exchange && representativeSecurity?.ticker) {
      const candidateSecCode = `${representativeSecurity.exchange}.${representativeSecurity.ticker}`;
      const canonicalSecurity = await getSecurityByCode(candidateSecCode);

      if (canonicalSecurity) {
        security = canonicalSecurity;
        resolvedSecCode = candidateSecCode;
      }
    }
  }

  const secCode = resolvedSecCode;
  const displayName = security.korName || security.name;

  // Extract market from secCode (e.g., "KOSPI.005930" -> "KOSPI")
  const market = secCode.includes('.') ? secCode.split('.')[0] : 'KOSPI';

  // Extract ticker from resolved security information
  const currentTicker = security.ticker
    ? security.ticker
    : secCode.includes('.')
      ? secCode.split('.')[1]
      : secCode;

  // Get aggregated company marketcap data
  const companyMarketcapData = security.companyId
    ? await getCompanyAggregatedMarketcap(security.companyId)
    : null;

  // Get market cap ranking for the security
  const marketCapRanking = await getSecurityMarketCapRanking(security.securityId);

  const coerceVolumeValue = (primary: unknown, secondary?: unknown) => {
    const candidates = [primary, secondary];

    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined) {
        continue;
      }

      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return candidate;
      }

      if (typeof candidate === "bigint") {
        const numeric = Number(candidate);
        if (Number.isFinite(numeric)) {
          return numeric;
        }
      }

      if (typeof candidate === "string") {
        const numeric = Number.parseFloat(candidate.replace(/,/g, ""));
        if (Number.isFinite(numeric)) {
          return numeric;
        }
      }
    }

    return null;
  };

  const rawPrices = Array.isArray(security.prices) ? security.prices : [];
  const parsedPricePoints = rawPrices
    .map((price: any) => {
      const sourceDate = price?.date;
      const date = sourceDate instanceof Date ? sourceDate : new Date(sourceDate ?? "");
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return null;
      }

      const closeValue = typeof price?.close === "number" ? price.close : undefined;
      const openValue = typeof price?.open === "number" ? price.open : undefined;
      const highValue = typeof price?.high === "number" ? price.high : undefined;
      const lowValue = typeof price?.low === "number" ? price.low : undefined;

      const resolvedClose = closeValue ?? openValue ?? null;
      const resolvedOpen = openValue ?? closeValue ?? null;

      if (resolvedClose === null || resolvedOpen === null) {
        return null;
      }

      const resolvedHigh = highValue ?? Math.max(resolvedOpen, resolvedClose);
      const resolvedLow = lowValue ?? Math.min(resolvedOpen, resolvedClose);
      const volumeValue = coerceVolumeValue(price?.volume, price?.fvolume);
      return {
        date,
        time: date.toISOString().split("T")[0],
        open: Number(resolvedOpen),
        high: Number(resolvedHigh),
        low: Number(resolvedLow),
        close: Number(resolvedClose),
        volume: Number.isFinite(volumeValue) ? Number(volumeValue) : null,
      };
    })
    .filter((point): point is {
      date: Date;
      time: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number | null;
    } =>
      !!point &&
      Number.isFinite(point.open) &&
      Number.isFinite(point.high) &&
      Number.isFinite(point.low) &&
      Number.isFinite(point.close));

  const sortedPricePoints = parsedPricePoints.sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const latestPricePoint = sortedPricePoints.at(-1);
  const periodReferenceDate = latestPricePoint
    ? new Date(latestPricePoint.date.getTime())
    : new Date();
  const periodStartDate = new Date(periodReferenceDate.getTime());
  periodStartDate.setDate(periodStartDate.getDate() - 90);

  let candlestickSeriesData = sortedPricePoints.filter(
    (point) => point.date >= periodStartDate && point.date <= periodReferenceDate
  );

  if (!candlestickSeriesData.length) {
    candlestickSeriesData = sortedPricePoints.slice(-90);
  }

  const candlestickData = candlestickSeriesData.map(({ time, open, high, low, close, volume }) => ({
    time,
    open,
    high,
    low,
    close,
    volume: Number.isFinite(volume ?? undefined) ? Number(volume) : undefined,
  }));

  // 🔥 기간별 시가총액 분석 계산 함수
  function calculatePeriodAnalysis() {
    if (!companyMarketcapData || !companyMarketcapData.aggregatedHistory || companyMarketcapData.aggregatedHistory.length === 0) {
      return null;
    }

    const history = companyMarketcapData.aggregatedHistory;
    const securities = companyMarketcapData.securities;

    // 기간별 데이터 필터링 함수
    const getDataForPeriod = (months: number) => {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);
      return history.filter(item => {
        const itemDate = item.date instanceof Date ? item.date : new Date(item.date);
        return itemDate >= cutoffDate;
      });
    };

    // 최신 데이터
    const latestData = history[history.length - 1];

    // 기간별 평균 계산
    const periods = [
      { label: '최근 시총', months: 0, desc: '현재 기준' },
      { label: '12개월 평균', months: 12, desc: '직전 1년' },
      { label: '3년 평균', months: 36, desc: '최근 3년' },
      { label: '5년 평균', months: 60, desc: '최근 5년' },
      { label: '10년 평균', months: 120, desc: '최근 10년' },
      { label: '30년 평균', months: 360, desc: '최근 30년' }
    ];

    const analysis = periods.map(period => {
      if (period.months === 0) {
        return {
          label: period.label,
          value: latestData?.totalMarketcap || 0,
          desc: period.desc
        };
      }

      const periodData = getDataForPeriod(period.months);
      if (periodData.length === 0) return null;

      const average = periodData.reduce((sum, item) => sum + item.totalMarketcap, 0) / periodData.length;
      return {
        label: period.label,
        value: average,
        desc: period.desc
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    // 최저/최고 계산
    const allValues = history.map(item => item.totalMarketcap);
    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);

    // 종목별 구성 분석 (최신 데이터 기준)
    const latestBreakdown = latestData?.securitiesBreakdown || {};
    const totalMarketcap = latestData?.totalMarketcap || 1;

    const securityAnalysis = securities.map(sec => {
      const secValue = latestBreakdown[sec.securityId] || 0;
      const percentage = (secValue / totalMarketcap) * 100;
      return {
        name: sec.korName || sec.name || '알 수 없음',
        type: sec.type || '',
        value: secValue,
        percentage
      };
    }).sort((a, b) => b.percentage - a.percentage);

    return {
      periods: analysis,
      minMax: { min: minValue, max: maxValue },
      securityBreakdown: securityAnalysis,
      currentSecurity: displayName,
      market
    };
  }

  const periodAnalysis = calculatePeriodAnalysis();

  // URL 파라미터와 종목 정보 기반 어노테이션 타입 결정
  const getSelectedTypeFromFocusAndSecurity = (
    focus: string | string[] | undefined,
    security: any
  ): string => {
    const hasFocusParam = focus === "stock";
    const isCommonStock = security?.type?.includes("보통주");
    const isPreferredStock = security?.type?.includes("우선주");

    if (hasFocusParam) {
      // focus=stock: 해당 개별 종목만 어노테이션
      if (isCommonStock) return "보통주";
      if (isPreferredStock) return "우선주";
      return "시가총액 구성";
    } else {
      // 기본 상태: 보통주는 전체 표시, 우선주는 항상 강조
      if (isCommonStock) return "시가총액 구성";
      if (isPreferredStock) return "우선주";
      return "시가총액 구성";
    }
  };

  const selectedType = getSelectedTypeFromFocusAndSecurity(undefined, security);

  const hasMarketcapDetails = Boolean(
    companyMarketcapData?.aggregatedHistory?.length && companyMarketcapData?.securities?.length
  );

  const renderLoadedSections = () => {
    if (!companyMarketcapData || !companyMarketcapData.aggregatedHistory || !companyMarketcapData.securities) {
      return null;
    }

    const aggregatedHistory = companyMarketcapData.aggregatedHistory as AggregatedHistoryEntry[];
    const securities = companyMarketcapData.securities as CompanySecuritySummary[];

    const formatSecurityDisplayName = (security: CompanySecuritySummary) => {
      const securityName = security?.korName || security?.name || "알 수 없음";
      const securityType = security?.type || "";

      if (securityType.includes("보통주")) {
        return `${securityName} 보통주`;
      }

      if (securityType.includes("우선주")) {
        return `${securityName} 우선주`;
      }

      return securityType ? `${securityName} (${securityType})` : securityName;
    };

    const annualCsvData = aggregatedHistory.map((item) => {
      const formattedDate = item.date instanceof Date ? item.date.toISOString().split("T")[0] : String(item.date);
      const row: Record<string, string | number> = {
        date: formattedDate,
        totalMarketcap: typeof item.totalMarketcap === "number" && Number.isFinite(item.totalMarketcap)
          ? item.totalMarketcap
          : Number(item.totalMarketcap ?? 0),
      };

      securities.forEach((security) => {
        const displayName = formatSecurityDisplayName(security);
        const rawBreakdown = security.securityId ? item.securitiesBreakdown?.[security.securityId] : undefined;
        const numericBreakdown = typeof rawBreakdown === "number" && Number.isFinite(rawBreakdown)
          ? rawBreakdown
          : Number(rawBreakdown ?? 0);
        row[displayName] = numericBreakdown;
      });

      return row;
    });

    const latestHistoryItem = aggregatedHistory[aggregatedHistory.length - 1];
    const latestHistoryDate = latestHistoryItem
      ? (latestHistoryItem.date instanceof Date
          ? latestHistoryItem.date.toISOString().split("T")[0]
          : String(latestHistoryItem.date))
      : undefined;
    const sanitizedSecCode = secCode.replace(/\./g, "-");
    const annualDownloadFilename = `${sanitizedSecCode}-annual-marketcap${latestHistoryDate ? `-${latestHistoryDate}` : ""}.csv`;

    return (
      <div className="mt-6 space-y-6 sm:mt-14 sm:space-y-16">
        {/* 기업 개요 섹션 */}
        <section
          id="company-overview"
          className={`${EDGE_TO_EDGE_SECTION_BASE} border-blue-200/70 dark:border-blue-900/40 dark:bg-blue-950/20`}
          style={SECTION_GRADIENTS.overview}
        >
          <header className="flex flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-800/50">
              <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">기업 개요</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">기업 시가총액 순위와 기본 정보</p>
            </div>
          </header>

          <RankHeader
            rank={1}
            marketcap={companyMarketcapData.totalMarketcap}
            price={security.prices?.[0]?.close || 0}
            exchange={security.exchange || ""}
            isCompanyLevel
          />
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
              <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">시가총액 추이와 종목별 구성 현황</p>
            </div>
          </header>

          <div className="grid gap-6 lg:auto-rows-max lg:grid-cols-2 lg:items-stretch lg:gap-8">
            <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE}`}>
              <div className="px-4 pt-4 sm:px-5 sm:pt-5">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {displayName} 시가총액 일간 추이
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  최근 3개월 간의 일별 시가총액 흐름과 종목별 비중 변화를 살펴보세요.
                </p>
              </div>
              <div className="flex flex-1 flex-col px-3 pb-4 pt-3 sm:px-5 sm:pb-5">
                <div className="min-h-[260px] flex-1">
                  <InteractiveChartSection
                    companyMarketcapData={companyMarketcapData}
                    companySecs={companySecs}
                    type="summary"
                    selectedType={selectedType}
                  />
                </div>
              </div>
            </div>

            <div className="flex h-full">
              <CardCompanyMarketcap
                data={companyMarketcapData}
                market={market}
                selectedType={selectedType}
              />
            </div>

            <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE} lg:col-span-2`}>
              <div className="flex items-start justify-between gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">최근 3개월 가격 차트</h3>
                  <p className="text-xs text-muted-foreground">
                    {displayName} ({currentTicker})의 일별 시가 · 고가 · 저가 · 종가와 거래량 흐름
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
                  최근 3개월
                </span>
              </div>
              <div className="px-3 pb-4 pt-3 sm:px-5 sm:pb-5">
                <CandlestickChart data={candlestickData} />
              </div>
            </div>
          </div>
        </section>

        {/* 종목 비교 섹션 */}
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
              <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">동일 기업 내 각 종목 간 비교 분석</p>
            </div>
          </header>

          <div className="space-y-4 sm:space-y-6">
            <InteractiveSecuritiesSection
              companyMarketcapData={companyMarketcapData}
              companySecs={companySecs}
              market={market}
              currentTicker={currentTicker}
              baseUrl="security"
              highlightActiveTicker={false}
            />
          </div>
        </section>

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

        <KeyMetricsSection
          companyMarketcapData={companyMarketcapData}
          companySecs={companySecs}
          security={security}
          periodAnalysis={periodAnalysis}
          marketCapRanking={marketCapRanking}
          activeMetric={ACTIVE_METRIC}
          backgroundStyle={SECTION_GRADIENTS.indicators}
          currentTickerOverride={currentTicker}
        />

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
                <p className="text-sm text-gray-600 dark:text-gray-400 md:text-base">시가총액 차트와 연말 기준 상세 데이터</p>
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
            <div>
              <div className={`${EDGE_TO_EDGE_CARD_BASE} p-2 sm:p-4`}>
                <InteractiveChartSection
                  companyMarketcapData={companyMarketcapData}
                  companySecs={companySecs}
                  type="detailed"
                  selectedType={selectedType}
                />
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              <p className="sr-only">연말 기준 시가총액 추이를 통해 기업의 성장 패턴을 분석합니다</p>

              <ListMarketcap
                data={companyMarketcapData.aggregatedHistory.map(item => ({
                  date: item.date instanceof Date ? item.date.toISOString().split("T")[0] : String(item.date),
                  value: item.totalMarketcap,
                }))}
              />
            </div>
          </div>
        </section>

        <div className="pt-1 sm:pt-2">
          <CompanyMarketcapPager rank={security.company?.marketcapRank || 1} currentMarket={market} />
        </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="space-y-6 sm:space-y-12">
      {/* 🚨 데이터 없음 상태 UI 개선 */}
        <section className="flex flex-col items-center justify-center gap-4 border border-border/60 bg-muted/40 px-4 py-8 text-center shadow-sm -mx-4 sm:mx-0 sm:rounded-3xl sm:px-8 sm:py-12">
          {/* 아이콘 */}
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/60">
            <svg className="h-10 w-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>

          {/* 메시지 */}
          <div className="max-w-md space-y-3">
            <h3 className="text-xl font-semibold text-foreground">기업 시가총액 데이터 없음</h3>
            <p className="leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">{displayName}</strong>의 통합 시가총액 데이터를 불러올 수 없습니다.
              <br />개별 종목의 시가총액 정보를 대신 확인하실 수 있습니다.
            </p>
          </div>

          {/* 대안 액션 */}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3">
            <Link
              href={`/company/${secCode}`}
              className="inline-flex items-center justify-center rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/80"
            >
              기업 홈으로 돌아가기
            </Link>
            <Link
              href={`/security/${secCode}/marketcap`}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              개별 종목 시가총액 보기
            </Link>
          </div>
        </section>

        {companySecs.length > 0 ? (
          <section className="space-y-4 sm:space-y-6">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              관련 종목 ({companySecs.length}개)
            </h2>
            <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
              {companySecs.map((sec) => (
                <CardMarketcap
                  key={sec.securityId}
                  security={sec as any}
                  market={market}
                  isCompanyPage={true}
                  currentMetric="marketcap"
                />
              ))}
            </div>

            <div className="pt-4 text-center sm:pt-6">
              <Link
                href={`/security/${secCode}/marketcap`}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 sm:px-6 sm:py-3"
              >
                {displayName} 종목 시가총액 상세보기
              </Link>
            </div>
          </section>
        ) : (
          <section className="space-y-4 text-center">
            <h3 className="text-xl font-semibold text-foreground">종목 정보를 찾을 수 없습니다</h3>
            <p className="text-muted-foreground">해당 종목의 시가총액 데이터가 없거나 접근할 수 없습니다.</p>
            <div className="flex justify-center gap-3">
              <Link
                href="/company/marketcaps"
                className="inline-flex items-center justify-center rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/90"
              >
                기업 시가총액 랭킹
              </Link>
              <Link
                href="/marketcap"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                종목 시가총액 랭킹
              </Link>
            </div>
          </section>
        )}
      </div>
      );

  return (
    <main className="relative py-4 sm:py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_300px]">
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
          <Link href={`/company/${secCode}`} className="transition-colors hover:text-foreground">
            {security.company?.korName || security.company?.name || displayName}
          </Link>
          <ChevronRightIcon className="h-4 w-4" />
          <span className="font-medium text-foreground">시가총액</span>
        </nav>

        <StickyCompanyHeader
          displayName={displayName}
          companyName={security.company?.korName || security.company?.name}
          logoUrl={security.company?.logo}
        />

        <div className="mt-5 space-y-4 sm:mt-8 sm:space-y-6">
          <p className="text-base text-muted-foreground md:text-lg">
            기업 전체 가치와 종목별 시가총액 구성을 분석합니다
          </p>

          {/* 시가총액 설명 알림 */}
          <div
            data-slot="alert"
            role="alert"
            className="relative -mx-4 w-auto border border-border/60 bg-card/80 px-4 py-4 text-sm text-card-foreground shadow-sm sm:mx-0 sm:rounded-2xl sm:px-5"
          >
            <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-info mt-0.5 h-5 w-5"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <div data-slot="alert-description" className="space-y-1 text-sm leading-relaxed text-muted-foreground">
                <p>기업 시가총액은 회사가 발행한 모든 종목(보통주, 우선주 등)의 시가총액을 합산한 값입니다.</p>
                <p>각 종목의 구성비율과 변동 추이를 확인할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </div>

        {hasMarketcapDetails ? renderLoadedSections() : renderEmptyState()}
      </div>
      {/* 사이드바 네비게이션 (데스크톱) */}
      <div className="hidden xl:block">
        <div className="sticky top-20 space-y-6">
          {/* 페이지 네비게이션 */}
          <div className="rounded-xl border bg-background p-4">
            <h3 className="text-sm font-semibold mb-3">페이지 내비게이션</h3>
            <PageNavigation
              sections={[
                {
                  id: "company-overview",
                  label: "기업 개요",
                  icon: <Building2 className="h-3 w-3" />,
                },
                {
                  id: "chart-analysis",
                  label: "차트 분석",
                  icon: <BarChart3 className="h-3 w-3" />,
                },
                {
                  id: "securities-summary",
                  label: "종목 비교",
                  icon: <ArrowLeftRight className="h-3 w-3" />,
                },
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
              ]}
            />
          </div>

          {/* 핵심 지표 카드 */}
          {companyMarketcapData && (
            <KeyMetricsSidebar
              companyMarketcapData={companyMarketcapData}
              companySecs={companySecs}
              security={security}
              marketCapRanking={marketCapRanking}
              currentTickerOverride={currentTicker}
            />
          )}

          {/* 종목별 시가총액 */}
          {companySecs && companySecs.length > 0 && (
            <InteractiveSecuritiesSection
              companyMarketcapData={companyMarketcapData}
              companySecs={companySecs}
              currentTicker={currentTicker}
              market={market}
              layout="sidebar"
              maxItems={4}
              showSummaryCard={true}
              compactMode={false}
              baseUrl="security"
              currentMetric="marketcap"
              highlightActiveTicker={false}
            />
          )}
        </div>
      </div>
    </main>
  );
}
