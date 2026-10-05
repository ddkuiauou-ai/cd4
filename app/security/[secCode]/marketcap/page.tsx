import { notFound } from "next/navigation";
import type { Metadata, ResolvingMetadata } from "next";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, BarChart3, ArrowLeftRight, TrendingUp, FileText } from "lucide-react";

import {
  getSecurityByCode,
  getCompanySecurities,
  getMarketCapHistoryBySecurityId,
} from "@/lib/data/security";
import {
  getCompanyAggregatedMarketcap,
  type CompanyMarketcapAggregated,
} from "@/lib/data/company";
import { getSecurityRank } from "@/lib/data/ranking";
import {
  getSecurityMarketCapRanking,
  getTopSecurityCodesByMetric,
} from "@/lib/select";
import { formatNumber, formatDate } from "@/lib/utils";

import CardCompanyMarketcap from "@/components/card-company-marketcap";
import ListMarketcap from "@/components/list-marketcap";
import RankHeader from "@/components/header-rank";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";
import { InteractiveSecuritiesSection } from "@/components/simple-interactive-securities";
import { SidebarManager } from "@/components/sidebar-manager";
import { InteractiveChartSection } from "@/components/interactive-chart-section";
import { CandlestickChart } from "@/components/chart-candlestick";
import { KeyMetricsSection } from "@/components/key-metrics-section";
import { KeyMetricsSidebar } from "@/components/key-metrics-sidebar";
import { RecentSecuritiesSidebar } from "@/components/recent-securities-sidebar";
import { RecentSecurityTracker } from "@/components/recent-security-tracker";
import { PageNavigation } from "@/components/page-navigation";
import { NavigationCollapsible } from "@/components/navigation-collapsible";
import { StickyCompanyHeader } from "@/components/sticky-company-header";
import { CsvDownloadButton } from "@/components/CsvDownloadButton";
import ShareButton from "@/components/share-button";
import { siteConfig } from "@/config/site";
import { SecMarketcapPager } from "@/components/pager-marketcap-security";
import ChartMarketcap from "@/components/chart-marketcap";
import { Card, CardContent } from "@/components/ui/card";
import { MarketcapSidebarScrollSync } from "@/components/marketcap-sidebar-scroll-sync";
import type { Price } from "@/typings";
import {
  ACTIVE_METRIC,
  EDGE_TO_EDGE_CARD_BASE,
  EDGE_TO_EDGE_SECTION_BASE,
  SECTION_GRADIENTS,
} from "@/components/marketcap/layout";

interface SecurityMarketcapPageProps {
  params: Promise<{ secCode: string }>;
}

export async function generateStaticParams() {
  const securityCodes = await getTopSecurityCodesByMetric('marketcap');

  return securityCodes.map((secCode) => ({
    secCode,
  }));
}

export async function generateMetadata({ params }: SecurityMarketcapPageProps, parent: ResolvingMetadata): Promise<Metadata> {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: "종목을 찾을 수 없습니다 - CD3",
      description: "요청하신 종목을 찾을 수 없습니다.",
    };
  }

  const displayName = security.korName || security.name;
  const securityType = security.type || "종목";

  const canonical = `${siteConfig.url}/security/${secCode}/marketcap/`;

  return {
    alternates: { canonical },
    openGraph: { ...(await parent).openGraph, url: canonical },
    title: `${displayName} ${securityType} 시가총액 - CD3`,
    description: `${displayName} ${securityType}의 시가총액 추이와 구성 비중을 확인해 보세요.`,
  };
}

const formatHistoryEntry = (
  entry: { date: Date | string; marketcap: number | string | null },
): { date: Date; value: number } | null => {
  if (entry.marketcap === null || entry.marketcap === undefined) {
    return null;
  }

  const date = entry.date instanceof Date ? entry.date : new Date(entry.date);
  const value =
    typeof entry.marketcap === "number"
      ? entry.marketcap
      : Number(entry.marketcap);

  if (!Number.isFinite(value) || Number.isNaN(date.getTime())) {
    return null;
  }

  return { date, value };
};

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

const resolveSelectedType = (securityType?: string | null) => {
  if (!securityType) {
    return "시가총액 구성";
  }

  if (securityType.includes("보통주")) {
    return "보통주";
  }

  if (securityType.includes("우선주")) {
    return "우선주";
  }

  return "시가총액 구성";
};

export default async function SecurityMarketcapPage({
  params,
}: SecurityMarketcapPageProps) {
  const { secCode } = await params;

  const security = await getSecurityByCode(secCode);

  if (!security) {
    notFound();
  }

  const displayName = security.korName || security.name;
  const englishName =
    security.name && security.korName && security.name !== security.korName
      ? security.name
      : null;
  const securityType = security.type || "종목";

  const market = secCode.includes(".")
    ? secCode.split(".")[0]
    : security.exchange || "KOSPI";
  const currentTicker = security.ticker
    ? security.ticker
    : secCode.includes(".")
      ? secCode.split(".")[1]
      : secCode;

  const companySecs = security.companyId
    ? await getCompanySecurities(security.companyId)
    : [];
  const companyMarketcapData: CompanyMarketcapAggregated | null = security.companyId
    ? await getCompanyAggregatedMarketcap(security.companyId)
    : null;

  const representativeSecurity = companySecs.find((sec) =>
    sec.type?.includes("보통주"),
  );

  const companySecCode =
    representativeSecurity?.exchange && representativeSecurity?.ticker
      ? `${representativeSecurity.exchange}.${representativeSecurity.ticker}`
      : null;

  const marketCapRanking = await getSecurityMarketCapRanking(
    security.securityId,
  );
  const fallbackRank =
    marketCapRanking?.currentRank ??
    (await getSecurityRank(security.securityId, "marketcap")) ??
    null;

  const marketcapHistoryRaw = await getMarketCapHistoryBySecurityId(
    security.securityId,
  );

  if (!marketcapHistoryRaw || marketcapHistoryRaw.length === 0) {
    notFound();
  }

  // 시가총액 데이터 처리 및 최적화
  const marketcapHistory = marketcapHistoryRaw
    .map((entry) =>
      formatHistoryEntry({
        date: entry.date,
        marketcap: entry.marketcap,
      }),
    )
    .filter((item): item is { date: Date; value: number } => item !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (!marketcapHistory.length) {
    notFound();
  }

  const latestHistoryPoint = marketcapHistory.at(-1)!;
  const latestMarketcapValue = latestHistoryPoint.value;
  const latestMarketcapDate = latestHistoryPoint.date;

  // 차트 데이터 생성을 위한 헬퍼 함수 (중복 제거)
  const createChartData = (data: typeof marketcapHistory) =>
    data.map((item) => ({
      date: item.date.toISOString().split("T")[0],
      totalValue: item.value,
    }));

  const threeMonthStart = new Date(latestHistoryPoint.date.getTime());
  threeMonthStart.setMonth(threeMonthStart.getMonth() - 3);

  const recentHistory = marketcapHistory.filter(
    (item) => item.date >= threeMonthStart,
  );

  const marketcapChartData = createChartData(
    recentHistory.length ? recentHistory : marketcapHistory.slice(-90)
  );

  const fullChartData = createChartData(marketcapHistory);

  const listData = marketcapHistory.map((item) => ({
    date: item.date.toISOString().split("T")[0],
    value: item.value,
  }));

  const periodAnalysis = (() => {
    if (!marketcapHistory.length) {
      return null;
    }

    const getDataForPeriod = (months: number) => {
      const cutoff = new Date(latestHistoryPoint.date.getTime());
      cutoff.setMonth(cutoff.getMonth() - months);
      return marketcapHistory.filter((item) => item.date >= cutoff);
    };

    const definitions = [
      { label: "현재 시총", months: 0 },
      { label: "12개월 평균", months: 12 },
      { label: "3년 평균", months: 36 },
      { label: "5년 평균", months: 60 },
      { label: "10년 평균", months: 120 },
    ] as const;

    const periods = definitions
      .map(({ label, months }) => {
        if (months === 0) {
          return { label, value: latestMarketcapValue };
        }

        const data = getDataForPeriod(months);
        if (!data.length) {
          return null;
        }

        const average =
          data.reduce((sum, item) => sum + item.value, 0) / data.length;

        return { label, value: average };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const values = marketcapHistory.map((item) => item.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const twelveMonthAverage =
      periods.find((p) => p && p.label === "12개월 평균")?.value ?? null;
    const yearChange =
      twelveMonthAverage && twelveMonthAverage !== 0
        ? ((latestMarketcapValue - twelveMonthAverage) /
          twelveMonthAverage) *
        100
        : null;

    return {
      periods,
      minMax: { min: minValue, max: maxValue },
      latestValue: latestMarketcapValue,
      latestDate: latestMarketcapDate,
      yearChange,
    };
  })();

  const rawPrices: Price[] = Array.isArray(security.prices)
    ? (security.prices as Price[])
    : [];
  const parsedPricePoints = rawPrices
    .map((price) => {
      const sourceDate = price?.date;
      const date =
        sourceDate instanceof Date ? sourceDate : new Date(sourceDate ?? "");
      if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return null;
      }

      const closeValue =
        typeof price?.close === "number" ? price.close : undefined;
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
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const latestPricePoint = sortedPricePoints.at(-1);
  const referenceDate = latestPricePoint
    ? new Date(latestPricePoint.date.getTime())
    : new Date();
  const priceStartDate = new Date(referenceDate.getTime());
  priceStartDate.setDate(priceStartDate.getDate() - 90);

  let candlestickSeriesData = sortedPricePoints.filter(
    (point) => point.date >= priceStartDate && point.date <= referenceDate,
  );

  if (!candlestickSeriesData.length) {
    candlestickSeriesData = sortedPricePoints.slice(-90);
  }

  const candlestickData = candlestickSeriesData.map(
    ({ time, open, high, low, close, volume }) => ({
      time,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(volume ?? undefined)
        ? Number(volume)
        : undefined,
    }),
  );

  const hasCompanyMarketcapData = Boolean(
    companyMarketcapData?.aggregatedHistory?.length &&
    companyMarketcapData?.securities?.length,
  );

  const selectedType = resolveSelectedType(security.type);

  const annualCsvData = fullChartData.map((item) => ({
    date: item.date,
    marketcap: item.totalValue,
  }));

  const latestHistoryDate = annualCsvData.at(-1)?.date;
  const sanitizedSecCode = secCode.replace(/\./g, "-");
  const annualDownloadFilename = `${sanitizedSecCode}-marketcap${latestHistoryDate ? `-${latestHistoryDate}` : ""}.csv`;

  const renderFallbackMetrics = () => {
    if (!periodAnalysis) {
      return null;
    }

    const metrics = [
      {
        title: "현재 시총",
        value: formatNumber(periodAnalysis.latestValue ?? latestMarketcapValue, "원"),
        caption: latestMarketcapDate
          ? `${formatDate(latestMarketcapDate)} 기준`
          : undefined,
      },
      {
        title: "12개월 평균",
        value: formatNumber(
          periodAnalysis.periods.find((p) => p && p.label === "12개월 평균")?.value || 0,
          "원",
        ),
        caption: "직전 1년",
      },
      {
        title: "최저 시총",
        value: formatNumber(periodAnalysis.minMax.min || 0, "원"),
        caption: "역대 최저",
      },
      {
        title: "최고 시총",
        value: formatNumber(periodAnalysis.minMax.max || 0, "원"),
        caption: "역대 최고",
      },
    ];

    return (
      <section
        id="indicators"
        className={`${EDGE_TO_EDGE_SECTION_BASE} border-yellow-200/70 dark:border-yellow-900/40 dark:bg-yellow-950/20`}
        style={SECTION_GRADIENTS.indicators}
      >
        <header className="flex flex-wrap items-center gap-4">
          <div className="hidden bg-yellow-100 dark:bg-yellow-800/50">
            <TrendingUp className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">핵심 지표</h2>
            <p className="text-sm text-muted-foreground text-muted-foreground md:text-base">최근 시가총액 흐름 요약</p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <Card key={metric.title} className="bg-background/80">
              <CardContent className="flex h-full flex-col gap-2 pt-4">
                <span className="text-sm text-muted-foreground">{metric.title}</span>
                <span className="text-2xl font-bold text-foreground">{metric.value}</span>
                {metric.caption && (
                  <span className="text-xs text-muted-foreground">{metric.caption}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  };


  const renderPrimarySections = () => {
    const chartGridColumns = hasCompanyMarketcapData ? "lg:grid-cols-2" : "lg:grid-cols-1";
    const candlestickSpan = hasCompanyMarketcapData ? "lg:col-span-2" : "";

    return (
      <div className="mt-6 space-y-6 sm:mt-8 sm:space-y-10">
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
              <p className="text-sm text-muted-foreground text-muted-foreground md:text-base">시가총액 순위와 기본 정보를 확인합니다</p>
            </div>
          </header>

          <div className="space-y-6">
            

            <div className={`${EDGE_TO_EDGE_CARD_BASE} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
              <dl className="space-y-2 p-4">
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted-foreground">종목명</dt>
                  <dd className="font-medium text-right">{displayName}</dd>
                </div>
                {englishName && (
                  <div className="flex items-center justify-between text-sm">
                    <dt className="text-muted-foreground">영문명</dt>
                    <dd className="font-medium text-right">{englishName}</dd>
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
                  <dt className="text-muted-foreground">최근 시총</dt>
                  <dd className="font-medium text-right">{formatNumber(latestMarketcapValue, "원")}</dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted-foreground">기준일</dt>
                  <dd className="font-medium text-right">
                    {latestMarketcapDate ? formatDate(latestMarketcapDate) : "-"}
                  </dd>
                </div>
              </dl>
              <dl className="space-y-2 border-t border-border/60 p-4 sm:col-span-2 sm:border-t-0 lg:col-span-1 lg:border-l">
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted-foreground">소속 기업</dt>
                  <dd className="text-right font-medium">
                    {security.company?.korName || security.company?.name || "-"}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted-foreground">시가총액 순위</dt>
                  <dd className="text-right font-medium">
                    {fallbackRank ? `${fallbackRank}위` : "-"}
                  </dd>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-muted-foreground">대표 종목</dt>
                  <dd className="text-right font-medium">
                    {representativeSecurity?.type?.includes("보통주")
                      ? "보통주"
                      : representativeSecurity
                        ? representativeSecurity.type
                        : "-"}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

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
              <p className="text-sm text-muted-foreground text-muted-foreground md:text-base">시가총액 추이와 종목별 구성 변화를 살펴봅니다</p>
            </div>
          </header>

          <div className={`grid gap-6 lg:auto-rows-max ${chartGridColumns} lg:items-stretch lg:gap-8`}>
            <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE}`}>
              <div className="px-4 pt-4 sm:px-5 sm:pt-5">
                <h3 className="text-base font-semibold text-foreground text-foreground">
                  {displayName} {securityType} 시가총액 일간 추이
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  최근 3개월 간의 일별 시가총액 흐름을 확인하고 동일 기업 내 다른 종목 대비 위치를 살펴보세요.
                </p>
              </div>
              <div className="flex flex-1 flex-col px-3 pb-4 pt-3 sm:px-5 sm:pb-5">
                <div className="min-h-[260px] flex-1">
                  {hasCompanyMarketcapData && companyMarketcapData ? (
                    <Suspense fallback={<div className="min-h-[260px] flex items-center justify-center">차트 로딩 중...</div>}>
                      <InteractiveChartSection
                        companyMarketcapData={companyMarketcapData}
                        companySecs={companySecs}
                        type="summary"
                        selectedType={selectedType}
                      />
                    </Suspense>
                  ) : (
                    <ChartMarketcap
                      data={marketcapChartData}
                      format="formatNumber"
                      formatTooltip="formatNumberTooltip"
                      selectedType="시가총액 구성"
                    />
                  )}
                </div>
              </div>
            </div>

            {hasCompanyMarketcapData && companyMarketcapData && (
              <div className="flex h-full">
                <CardCompanyMarketcap
                  data={companyMarketcapData}
                  market={market}
                  selectedType={selectedType}
                />
              </div>
            )}

            <div className={`flex flex-col ${EDGE_TO_EDGE_CARD_BASE} ${candlestickSpan}`}>
              <div className="flex items-start justify-between gap-2 px-4 pt-4 sm:px-5 sm:pt-5">
                <div>
                  <h3 className="text-base font-semibold text-foreground text-foreground">최근 3개월 가격 차트</h3>
                  <p className="text-xs text-muted-foreground">
                    {displayName} ({currentTicker})의 일별 시가 · 고가 · 저가 · 종가와 거래량 흐름을 확인합니다.
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
                <p className="text-sm text-muted-foreground text-muted-foreground md:text-base">해당 기업 내 다른 종목과 시가총액 구성을 비교합니다</p>
              </div>
            </header>

            <InteractiveSecuritiesSection
              companyMarketcapData={companyMarketcapData}
              companySecs={companySecs}
              market={market}
              currentTicker={currentTicker}
              baseUrl="security"
              currentMetric="marketcap"
              highlightActiveTicker
            />
          </section>
        )}

        <div className="space-y-4 sm:space-y-8">

          <div
            className="relative  overflow-hidden border border-border bg-background px-4 py-4 text-sm  sm:mx-0 rounded-sm sm:px-6 sm:py-5 border-border bg-background"
            style={SECTION_GRADIENTS.indicators}
          >
            <div className="flex flex-col gap-3 text-foreground text-foreground">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold tracking-tight text-foreground text-foreground">
                  선택한 지표가 아래 분석 카드에 바로 반영됩니다
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground  bg-background text-foreground">
                  Tab Sync
                </span>
              </div>
              <p className="text-xs leading-relaxed text-foreground text-foreground md:text-sm">
                <strong className="font-semibold text-foreground text-foreground">{ACTIVE_METRIC.label}</strong>을 포함한 탭을 선택하면 <strong className="font-semibold text-foreground text-foreground">핵심 지표</strong>와 <strong className="font-semibold text-foreground text-foreground">연도별 데이터</strong> 모듈이 함께 갱신되어, 한 화면에서 흐름을 비교할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {hasCompanyMarketcapData ? (
          <KeyMetricsSection
            companyMarketcapData={companyMarketcapData}
            companySecs={companySecs}
            security={security}
            periodAnalysis={periodAnalysis}
            marketCapRanking={marketCapRanking}
            activeMetric={ACTIVE_METRIC}
            backgroundStyle={SECTION_GRADIENTS.indicators}
            currentTickerOverride={currentTicker}
            selectedSecurityTypeOverride={selectedType}
          />
        ) : (
          renderFallbackMetrics()
        )}

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
              {ACTIVE_METRIC.label} 연도별 데이터 흐름
            </span>
            {ACTIVE_METRIC.description && (
              <span className="text-[11px] font-medium text-foreground text-foreground">
                {ACTIVE_METRIC.description}
              </span>
            )}
          </div>
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="hidden bg-background bg-background">
                <FileText className="h-6 w-6 text-foreground text-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">연도별 데이터</h2>
                <p className="text-sm text-muted-foreground text-muted-foreground md:text-base">시가총액 차트와 연말 기준 상세 데이터를 확인합니다</p>
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
            <div className={`${EDGE_TO_EDGE_CARD_BASE} p-2 sm:p-4`}>
              {hasCompanyMarketcapData && companyMarketcapData ? (
                <Suspense fallback={<div className="min-h-[300px] flex items-center justify-center">차트 로딩 중...</div>}>
                  <InteractiveChartSection
                    companyMarketcapData={companyMarketcapData}
                    companySecs={companySecs}
                    type="detailed"
                    selectedType={selectedType}
                  />
                </Suspense>
              ) : (
                <ChartMarketcap
                  data={fullChartData}
                  format="formatNumber"
                  formatTooltip="formatNumberTooltip"
                  selectedType="시가총액 구성"
                />
              )}
            </div>

            <div className="space-y-4 sm:space-y-6">
              <p className="sr-only">연말 기준 시가총액 추이를 통해 종목의 장기 패턴을 분석합니다</p>

              <ListMarketcap data={listData} />
            </div>
          </div>
        </section>

        <div className="pt-1 sm:pt-2">
          <SecMarketcapPager rank={fallbackRank || 1} />
        </div>
      </div>
    );
  };

  const headerDetail = {
    label: "시가총액",
    value: formatNumber(latestMarketcapValue, "원"),
    badge: securityType,
  } as const;

  const titleSuffix = "시가총액";

  const shareTitle = `${displayName} ${securityType} 시가총액 분석 | ${siteConfig.name}`;
  const shareText = `${displayName} ${securityType}의 시가총액 추이와 구성 데이터를 ${siteConfig.name}에서 확인하세요.`;
  const shareUrl = `${siteConfig.url}/security/${secCode}/marketcap`;

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
              href={`/company/${companySecCode}/marketcap`}
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
          <span className="font-medium text-foreground">시가총액</span>
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
        <RankHeader rank={marketCapRanking?.currentRank ?? security.marketcapRank} marketcap={security.marketcap ?? undefined} price={security.prices?.[0]?.close}
          exchange={security.exchange || market} isCompanyLevel={false}
          rankLabel="종목 시가총액 순위" marketcapLabel="현재 시가총액" marketcapUnit="원" />
        <p className="mt-2 text-xs text-muted-foreground">{security.type || "종목"} · {currentTicker} · 기준일 {security.marketcapDate ? new Date(security.marketcapDate!).toISOString().slice(0, 10) : '확인 중'} · 종목별 지표</p>
        <CompanyFinancialTabs secCode={secCode} className="mt-4" />

        <div className="mt-5 space-y-4 sm:mt-8 sm:space-y-6">
          <div className="space-y-3">
            <p className="text-base text-muted-foreground md:text-lg">
              종목 가치를 중심으로 동일 기업 내 다른 종목과의 시가총액 구성을 분석합니다.
            </p>
            <div className="sm:hidden">
              <ShareButton
                title={shareTitle}
                text={shareText}
                url={shareUrl}
              />
            </div>
          </div>

          <details className="border-y border-border py-3 text-sm"><summary className="cursor-pointer font-medium">지표 설명 · 계산식</summary><div
            data-slot="alert"
            
            className="relative  w-auto border border-border/60 bg-card/80 px-4 py-4 text-sm text-card-foreground  sm:mx-0 rounded-sm sm:px-5"
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
                <p>{displayName} {securityType}의 시가총액은 발행주식 수와 주가를 곱한 값으로, 기업의 다른 종목과 함께 전체 가치를 구성합니다.</p>
                <p>구성비율과 변동 추이를 확인하며 해당 종목의 위치를 비교해 보세요.</p>
              </div>
            </div>
          </div></details>
        </div>

        {renderPrimarySections()}
      </div>

      <aside className="context-rail order-first xl:order-last">
        <MarketcapSidebarScrollSync
          navigationSections={navigationSections}
          hasCompanyMarketcapData={hasCompanyMarketcapData}
          companyMarketcapData={companyMarketcapData}
          companySecs={companySecs}
          security={security}
          marketCapRanking={marketCapRanking}
          currentTicker={currentTicker}
          selectedType={selectedType}
          secCode={secCode}
          market={market}
        />
      </aside>
    </div>
  );
}
