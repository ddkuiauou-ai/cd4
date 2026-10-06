import { DetailMobileNavigation } from '@/components/detail-mobile-navigation';
import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from "next";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Building2, BarChart3, ArrowLeftRight, TrendingUp, FileText } from "lucide-react";
import { getSecurityByCode, getCompanySecurities } from "@/lib/data/security";
import { getCompanyAggregatedMarketcap } from "@/lib/data/company";
import { getSecurityMarketCapRanking, getTopCompanyCodesByMetric } from "@/lib/select";
import { formatNumber, formatDate } from "@/lib/utils";

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
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { RecentSecurityTracker } from "@/components/recent-security-tracker";
import { PageNavigation } from "@/components/page-navigation";
import { SidebarManager } from "@/components/sidebar-manager";
import { StickyCompanyHeader } from "@/components/sticky-company-header";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import ShareButton from "@/components/share-button";
import { siteConfig } from "@/config/site";
import {
  ACTIVE_METRIC,
  EDGE_TO_EDGE_CARD_BASE,
  EDGE_TO_EDGE_SECTION_BASE,
  SECTION_GRADIENTS,
} from "@/components/marketcap/layout";

// Constants
const CANDLESTICK_PERIOD_DAYS = 90;
const SECTION_HEADING_CLASSES = "text-xl font-semibold tracking-tight text-foreground";

// Utility functions
const coerceVolumeValue = (primary: unknown, secondary?: unknown): number | null => {
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

// Period analysis configuration
const PERIOD_ANALYSIS_CONFIG = [
  { label: '최근 시총', months: 0, desc: '현재 기준' },
  { label: '12개월 평균', months: 12, desc: '직전 1년' },
  { label: '3년 평균', months: 36, desc: '최근 3년' },
  { label: '5년 평균', months: 60, desc: '최근 5년' },
  { label: '10년 평균', months: 120, desc: '최근 10년' },
  { label: '30년 평균', months: 360, desc: '최근 30년' }
] as const;

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
    const companyCodes = await getTopCompanyCodesByMetric('marketcap');

    return companyCodes.map((secCode) => ({
      secCode: secCode,
    }));
  } catch (error) {
    console.error('[GENERATE_STATIC_PARAMS] Error generating company marketcap params:', error);
    throw error;
  }
}

/**
 * Props for Company Marketcap Page
 */
interface CompanyMarketcapPageProps {
  params: Promise<{ secCode: string }>;
}

export async function generateMetadata({ params }: CompanyMarketcapPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);
  const displayName = security?.company?.korName || security?.company?.name || security?.korName || security?.name || secCode;
  const canonical = `${siteConfig.url}/company/${secCode}/marketcap/`;

  return {
    title: `${displayName} 기업 전체 시가총액`,
    description: `${displayName}의 보통주·우선주 합산 시가총액과 종목별 구성, 가격 차트, 연도별 데이터를 확인하세요.`,
    alternates: { canonical },
    openGraph: { ...(await parent).openGraph, url: canonical },
  };
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
  let secCode = initialSecCode;

  if (!security.type?.includes("보통주")) {
    const representativeSecurity = companySecs.find(
      (companySecurity) => companySecurity.type?.includes("보통주")
    );

    if (representativeSecurity?.exchange && representativeSecurity?.ticker) {
      const candidateSecCode = `${representativeSecurity.exchange}.${representativeSecurity.ticker}`;
      const canonicalSecurity = await getSecurityByCode(candidateSecCode);

      if (canonicalSecurity) {
        security = canonicalSecurity;
        secCode = candidateSecCode;
      }
    }
  }
  const displayName = security.korName || security.name;

  // Extract market and ticker from secCode (e.g., "KOSPI.005930")
  const secCodeParts = secCode.split('.');
  const market = secCodeParts.length > 1 ? secCodeParts[0] : 'KOSPI';
  const tickerFromSecCode = secCodeParts.length > 1 ? secCodeParts[1] : secCode;

  // Extract ticker from resolved security information
  const currentTicker = security.ticker || tickerFromSecCode;

  // Get aggregated company marketcap data
  const companyMarketcapData = security.companyId
    ? await getCompanyAggregatedMarketcap(security.companyId)
    : null;
  const hasCompanySnapshot = security.company?.marketcapDate != null && companyMarketcapData?.securities.every(companySecurity =>
    companySecs.some(currentSecurity => currentSecurity.securityId === companySecurity.securityId && currentSecurity.marketcap != null));
  const companyMarketcapDateLabel = hasCompanySnapshot ? '시총 스냅샷 기준' : '이력 마지막 시총 기준';

  // Get market cap ranking for the security
  const marketCapRanking = await getSecurityMarketCapRanking(security.securityId);

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
    .filter((point: any): point is {
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

  const sortedPricePoints = [...parsedPricePoints].sort(
    (a: any, b: any) => a.date.getTime() - b.date.getTime()
  );

  const latestPricePoint = sortedPricePoints.at(-1);
  const periodReferenceDate = latestPricePoint
    ? new Date(latestPricePoint.date.getTime())
    : new Date();
  const periodStartDate = new Date(periodReferenceDate.getTime());
  periodStartDate.setDate(periodStartDate.getDate() - CANDLESTICK_PERIOD_DAYS);

  let candlestickSeriesData = sortedPricePoints.filter(
    (point: any) => point.date >= periodStartDate && point.date <= periodReferenceDate
  );

  if (!candlestickSeriesData.length) {
    candlestickSeriesData = sortedPricePoints.slice(-CANDLESTICK_PERIOD_DAYS);
  }

  const candlestickData = candlestickSeriesData.map((point: any) => {
    const { time, open, high, low, close, volume } = point;
    const volumeValue = Number.isFinite(volume) ? volume : undefined;
    return {
      time,
      open,
      high,
      low,
      close,
      volume: volumeValue,
    };
  });

  // 🔥 기간별 시가총액 분석 계산 함수
  function calculatePeriodAnalysis() {
    if (!companyMarketcapData || !companyMarketcapData.aggregatedHistory || companyMarketcapData.aggregatedHistory.length === 0) {
      return null;
    }

    const history = companyMarketcapData.aggregatedHistory;
    const securities = companyMarketcapData.securities;
    const latestData = history[history.length - 1];

    // 기간별 데이터 필터링 함수
    const getDataForPeriod = (months: number) => {
      const cutoffDate = new Date(latestData.date);
      cutoffDate.setMonth(cutoffDate.getMonth() - months);
      return history.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= cutoffDate;
      });
    };

    // 기간별 평균 계산

    const analysis = PERIOD_ANALYSIS_CONFIG.map(period => {
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
    const allValues = history
      .map(item => item.totalMarketcap)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
    const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;

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

  const getDefaultSelectedType = (security: any): string => {
    const isCommonStock = security?.type?.includes("보통주");
    const isPreferredStock = security?.type?.includes("우선주");

    if (isPreferredStock) return "우선주";
    if (isCommonStock) return "시가총액 구성";
    return "시가총액 구성";
  };

  const selectedType = getDefaultSelectedType(security);

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
      <div className="detail-primary-sections space-y-6 sm:space-y-8">
        {/* 기업 개요 섹션 */}


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
              <h2 className={SECTION_HEADING_CLASSES}>차트 분석</h2>
              <p className="text-sm text-muted-foreground md:text-base">시가총액 추이와 종목별 구성 현황</p>
            </div>
          </header>

          <div className="grid gap-6 lg:auto-rows-max lg:grid-cols-2 lg:items-stretch lg:gap-8">
            <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE} lg:col-span-2`}>
              <div className="px-4 pt-4 sm:px-5 sm:pt-5">
                <h3 className="text-base font-semibold text-foreground">
                  {displayName} 등록된 시가총액 이력
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  마지막 이력일부터 3개월 범위의 실제 기록을 표시합니다. 요약의 시총 스냅샷과 기준일이 다를 수 있습니다.
                </p>
              </div>
              <div className="flex flex-1 flex-col px-3 pb-4 pt-3 sm:px-5 sm:pb-5">
                <div className="flex-1">
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

            <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE}`}>
              <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-5 sm:pt-5">
                <div>
                  <h3 className="text-base font-semibold text-foreground">대표 종목 가격 이력</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {displayName} ({currentTicker}) · {security.type || '대표 종목'} · 시가·고가·저가·종가·거래량
                  </p>
                </div>
              </div>
              <div className="px-3 pb-4 pt-3 sm:px-5 sm:pb-5">
                <p className="mb-3 text-xs text-muted-foreground tabular-nums">{candlestickSeriesData.length > 0
                  ? `거래 범위 ${candlestickSeriesData[0].time} ~ ${candlestickSeriesData.at(-1)!.time} · 기록 ${candlestickSeriesData.length}개 · 마지막 거래일 기준 90일 범위`
                  : '등록된 가격 이력이 없습니다.'}</p>
                <CandlestickChart data={candlestickData} />
              </div>
            </div>
          </div>
        </section>

        {/* 종목 비교 섹션 */}
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
              <h2 className={SECTION_HEADING_CLASSES}>종목 비교</h2>
              <p className="text-sm text-muted-foreground md:text-base">동일 기업 내 각 종목 간 비교 분석</p>
            </div>
          </header>

          <div className="space-y-4 sm:space-y-6">
            <InteractiveSecuritiesSection
              companyMarketcapData={companyMarketcapData}
              companySecs={companySecs}
              market={market}
              currentTicker={currentTicker}
              baseUrl="security"
              currentMetric="marketcap"
              highlightActiveTicker={false}
              defaultFilter="시가총액 구성"
            />
          </div>
        </section>



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
          className={`${EDGE_TO_EDGE_SECTION_BASE} border-border border-border bg-background`}
          style={SECTION_GRADIENTS.annual}
        >

          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="hidden bg-background">
                <FileText className="h-6 w-6 text-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className={SECTION_HEADING_CLASSES}>연도별 데이터</h2>
                <p className="text-sm text-muted-foreground md:text-base">시가총액 차트와 연말 기준 상세 데이터</p>
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
                  date: item.date.split("T")[0],
                  value: item.totalMarketcap,
                }))}
              />
            </div>
          </div>
        </section>

        <div className="pt-1 sm:pt-2">
          {security.company?.marketcapRank != null && <CompanyMarketcapPager rank={security.company.marketcapRank} currentMarket={market} />}
        </div>
      </div>
    );
  };

  const renderEmptyState = () => (
    <div className="space-y-6 sm:space-y-12">
      {/* 🚨 데이터 없음 상태 UI 개선 */}
      <section className="flex flex-col items-center justify-center gap-4 border border-border/60 bg-muted/40 px-4 py-8 text-center sm:mx-0 rounded-sm sm:px-8 sm:py-12">
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
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:px-6 sm:py-3"
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
              href="/marketcaps"
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

  const headerDetail = companyMarketcapData
    ? {
      label: "기업 합산 시가총액",
      value: formatNumber(companyMarketcapData.totalMarketcap ?? 0, "원"),
      badge: companyMarketcapData.totalMarketcapDate
        ? `${companyMarketcapDateLabel} ${formatDate(companyMarketcapData.totalMarketcapDate, "ko-KR", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`
        : undefined,
    }
    : undefined;

  const shareTitle = `${displayName} 시가총액 분석`;
  const shareText = `${displayName} 기업의 시가총액 추이와 종목별 구성 데이터를 ${siteConfig.name}에서 확인하세요.`;
  const shareUrl = `${siteConfig.url}/company/${secCode}/marketcap`;

  return (
    <div className="app-container detail-grid">
      {/* 최근 본 종목 추적 */}
      <RecentSecurityTracker
        secCode={secCode}
        name={security.name || ""}
        korName={security.korName}
        ticker={currentTicker}
        exchange={market}
        metricType="marketcap"
        metricValue={security.marketcap}
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
          detail={headerDetail}
          actions={
            <ShareButton
              title={shareTitle}
              text={shareText}
              url={shareUrl}
            />
          }
        />
        <section id="company-overview">
        <RankHeader rank={security.company?.marketcapRank} marketcap={companyMarketcapData?.totalMarketcap ?? security.company?.marketcap ?? undefined} price={security.prices?.[0]?.close}
          exchange={security.exchange || market} isCompanyLevel={true}
          rankLabel="기업 시가총액 순위" marketcapLabel="기업 전체 시가총액" marketcapUnit="원"
          marketcapDate={companyMarketcapData?.totalMarketcapDate ?? null} marketcapDateLabel={companyMarketcapDateLabel}
          priceDate={security.prices?.[0]?.date ?? null} priceLabel={security.type?.includes('보통주') ? '대표 보통주 주가' : '대표 종목 주가'} />
        <p className="mt-2 text-xs text-muted-foreground">보통주·우선주 합산</p>
        </section>
        <CompanyFinancialTabs secCode={secCode} className="mt-4" />
        <DetailMobileNavigation sections={[{ id: 'company-overview', label: '기업 개요' }, { id: 'chart-analysis', label: '차트 분석' }, { id: 'securities-summary', label: '종목 비교' }, { id: 'indicators', label: '핵심 지표' }, { id: 'annual-data', label: '연도별 데이터' }]} />



        {hasMarketcapDetails ? renderLoadedSections() : renderEmptyState()}
        <div className="mt-6"><details className="border-y border-border py-3 text-sm"><summary className="cursor-pointer font-medium">지표 설명 · 계산식</summary><div
            data-slot="alert"

            className="relative w-auto border border-border/60 bg-card/80 px-4 py-4 text-sm text-card-foreground sm:mx-0 rounded-sm sm:px-5"
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
          </div></details></div>
      </div>
      {/* 사이드바 네비게이션 (데스크톱) */}
      <aside className="context-rail hidden xl:block">
        <SidebarManager
          navigationSections={[
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
          periodAnalysis={null}
          perRank={marketCapRanking?.currentRank ?? null}
          security={security}
          secCode={secCode}
          hasCompanyMarketcapData={true}
          companySecs={companySecs}
          comparableSecuritiesWithPER={companySecs}
          currentTicker={currentTicker}
          market={market}
          companyMarketcapData={companyMarketcapData ?? undefined}
          metricType="marketcap"
        />
      </aside>
    </div>
  );
}
