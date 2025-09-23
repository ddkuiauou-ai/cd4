
import { notFound } from "next/navigation";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import Link from "next/link";
import { Balancer } from "react-wrap-balancer";
import {
  Building2,
  BarChart3,
  ArrowLeftRight,
  TrendingUp,
  FileText,
} from "lucide-react";

import {
  getSecurityByCode,
  getCompanySecurities,
  getMarketCapHistoryBySecurityId,
} from "@/lib/data/security";
import { getCompanyAggregatedMarketcap } from "@/lib/data/company";
import { getSecurityRank } from "@/lib/data/ranking";
import { getAllSecurityCodes } from "@/lib/select";
import { getSecuritySearchNames } from "@/lib/getSearch";
import { formatNumber, formatDate } from "@/lib/utils";

import CompanyLogo from "@/components/CompanyLogo";
import ChartMarketcap from "@/components/chart-marketcap";
import CardMarketcapDetail from "@/components/card-marketcap-detail";
import ListMarketcap from "@/components/list-marketcap";
import { InteractiveSecuritiesSection } from "@/components/simple-interactive-securities";
import { CompanyFinancialTabs } from "@/components/company-financial-tabs";
import { SecMarketcapPager } from "@/components/pager-marketcap-security";
import CardMarketcap from "@/components/card-marketcap";
import { CandlestickChart } from "@/components/chart-candlestick";
import { MidNavWrapper } from "@/components/mid-nav-wrapper";
import { LayoutWrapper } from "@/components/layout-wrapper";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface SecurityMarketcapPageProps {
  params: Promise<{ secCode: string }>;
}

export async function generateStaticParams() {
  const securityCodes = await getAllSecurityCodes();

  return securityCodes.map((secCode) => ({
    secCode,
  }));
}

export async function generateMetadata({ params }: SecurityMarketcapPageProps) {
  const { secCode } = await params;
  const security = await getSecurityByCode(secCode);

  if (!security) {
    return {
      title: "종목을 찾을 수 없습니다 - CD3",
      description: "요청하신 종목을 찾을 수 없습니다.",
    };
  }

  const displayName = security.korName || security.name;

  return {
    title: `${displayName} 종목 시가총액 - CD3`,
    description: `${displayName} 종목의 시가총액 추이와 구성 비중을 확인해 보세요.`,
  };
}

const formatHistoryEntry = (
  entry: { date: Date | string; marketcap: number | string | null },
): { date: Date; value: number } | null => {
  const date = entry.date instanceof Date ? entry.date : new Date(entry.date);
  const value =
    typeof entry.marketcap === "number"
      ? entry.marketcap
      : Number(entry.marketcap ?? 0);

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
  const companyMarketcapData = security.companyId
    ? await getCompanyAggregatedMarketcap(security.companyId)
    : null;

  const representativeSecurity = companySecs.find((sec) =>
    sec.type?.includes("보통주"),
  );

  const companySecCode =
    representativeSecurity?.exchange && representativeSecurity?.ticker
      ? `${representativeSecurity.exchange}.${representativeSecurity.ticker}`
      : null;

  const marketcapRank = await getSecurityRank(
    security.securityId,
    "marketcap",
  );

  const marketcapHistoryRaw = await getMarketCapHistoryBySecurityId(
    security.securityId,
  );

  if (!marketcapHistoryRaw || marketcapHistoryRaw.length === 0) {
    notFound();
  }

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

  const threeMonthStart = new Date(latestHistoryPoint.date.getTime());
  threeMonthStart.setMonth(threeMonthStart.getMonth() - 3);

  const recentHistory = marketcapHistory.filter(
    (item) => item.date >= threeMonthStart,
  );

  const marketcapChartData = (recentHistory.length
    ? recentHistory
    : marketcapHistory.slice(-90)
  ).map((item) => ({
    date: item.date.toISOString().split("T")[0],
    value: item.value,
  }));

  const fullChartData = marketcapHistory.map((item) => ({
    date: item.date.toISOString().split("T")[0],
    value: item.value,
  }));

  const listData = fullChartData;

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
      .filter((item): item is { label: string; value: number } => item !== null);

    const values = marketcapHistory.map((item) => item.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const twelveMonthAverage =
      periods.find((p) => p.label === "12개월 평균")?.value ?? null;
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

  const rawPrices = Array.isArray(security.prices) ? security.prices : [];
  const parsedPricePoints = rawPrices
    .map((price: any) => {
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

  const compositionSecurities = companySecs.length
    ? companySecs
    : ([
        {
          ...security,
          marketcap: latestMarketcapValue,
          marketcapDate: latestMarketcapDate,
        },
      ] as any);

  const latestPrice = security.prices?.[0];

  const metricsCards = [
    {
      title: "현재 시총",
      value: formatNumber(periodAnalysis?.latestValue ?? latestMarketcapValue, "원"),
      caption: latestMarketcapDate
        ? `${formatDate(latestMarketcapDate)} 기준`
        : undefined,
    },
    {
      title: "12개월 평균",
      value: formatNumber(
        periodAnalysis?.periods.find((p) => p.label === "12개월 평균")?.value || 0,
        "원",
      ),
      caption: "직전 1년",
    },
    {
      title: "3년 평균",
      value: formatNumber(
        periodAnalysis?.periods.find((p) => p.label === "3년 평균")?.value || 0,
        "원",
      ),
      caption: "최근 3년",
    },
    {
      title: "5년 평균",
      value: formatNumber(
        periodAnalysis?.periods.find((p) => p.label === "5년 평균")?.value || 0,
        "원",
      ),
      caption: "최근 5년",
    },
    {
      title: "최저 시총",
      value: formatNumber(periodAnalysis?.minMax.min || 0, "원"),
      caption: "역대 최저",
    },
    {
      title: "최고 시총",
      value: formatNumber(periodAnalysis?.minMax.max || 0, "원"),
      caption: "역대 최고",
    },
    {
      title: "1년 변화율",
      value:
        periodAnalysis?.yearChange !== null && periodAnalysis?.yearChange !== undefined
          ? `${periodAnalysis.yearChange > 0 ? "+" : ""}${periodAnalysis.yearChange.toFixed(1)}%`
          : "—",
      caption: "현재 시총 vs 12개월 평균",
    },
    {
      title: "시가총액 순위",
      value: marketcapRank ? `${marketcapRank}위` : "—",
      caption: latestMarketcapDate
        ? `${formatDate(latestMarketcapDate)} 기준`
        : undefined,
    },
  ];

  const searchData = await getSecuritySearchNames();

  return (
    <LayoutWrapper searchData={searchData}>
      <main className="relative py-6 lg:gap-10 lg:py-8 xl:grid xl:grid-cols-[1fr_320px]">
        <div className="mx-auto w-full min-w-0 space-y-12">
          <div className="space-y-0">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
            >
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
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <CompanyLogo
                    companyName={security.company?.korName || displayName}
                    logoUrl={security.company?.logo}
                    size={64}
                    className="flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
                        <Balancer>
                          {displayName} {securityType} 시가총액
                        </Balancer>
                      </h1>
                      {securityType && (
                        <Badge variant="secondary" className="text-sm">
                          {securityType}
                        </Badge>
                      )}
                    </div>
                    {englishName && (
                      <p className="text-sm text-muted-foreground">{englishName}</p>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-lg text-muted-foreground md:text-xl">
                <Balancer>
                  {displayName} {securityType}의 종목 가치를 살펴보고 동일 기업 내 다른 종목과 시가총액 구성을 비교합니다.
                </Balancer>
              </p>
            </div>

            <div
              data-slot="alert"
              role="alert"
              className="relative w-full rounded-lg border bg-card px-4 py-3 text-sm text-card-foreground has-[>svg]:grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 has-[>svg]:items-start [&>svg]:h-4 [&>svg]:w-4 [&>svg]:translate-y-0.5"
            >
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
                className="lucide lucide-info"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <div data-slot="alert-description" className="col-start-2 grid gap-1 text-sm text-muted-foreground">
                종목 시가총액은 개별 종목의 주가에 발행 주식 수를 곱한 값입니다. 동일 기업 내 다른 종목과의 구성 비중과 추세를 함께 확인해 종목의 가치를 파악하세요.
              </div>
            </div>
          </div>

          <section
            id="security-overview"
            className="relative -mx-4 rounded-xl border border-blue-100 bg-blue-50/30 px-4 py-8 dark:border-blue-800/50 dark:bg-blue-900/20"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-800/50">
                <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">
                  종목 개요
                </h2>
                <p className="text-base text-gray-600 dark:text-gray-400">
                  종목 시가총액 순위와 기본 정보를 확인하세요
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="flex flex-col gap-2 pt-4">
                  <span className="text-sm text-muted-foreground">시가총액 순위</span>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {marketcapRank ? `${marketcapRank}위` : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {latestMarketcapDate ? `${formatDate(latestMarketcapDate)} 기준` : "랭킹 정보 준비 중"}
                  </span>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col gap-2 pt-4">
                  <span className="text-sm text-muted-foreground">현재 시가총액</span>
                  <span className="text-2xl font-bold text-foreground">
                    {formatNumber(latestMarketcapValue, "원")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {latestMarketcapDate ? `${formatDate(latestMarketcapDate)} 기준` : "기준일 정보 없음"}
                  </span>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col gap-2 pt-4">
                  <span className="text-sm text-muted-foreground">현재 주가</span>
                  <span className="text-2xl font-bold text-foreground">
                    {latestPrice?.close
                      ? `${latestPrice.close.toLocaleString()}원`
                      : "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {latestPrice?.date
                      ? `${formatDate(latestPrice.date)} 종가`
                      : "주가 정보 없음"}
                  </span>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex flex-col gap-2 pt-4">
                  <span className="text-sm text-muted-foreground">거래 정보</span>
                  <span className="text-2xl font-bold text-foreground">
                    {security.exchange || market}
                  </span>
                  <span className="text-xs text-muted-foreground">티커 {currentTicker}</span>
                </CardContent>
              </Card>
            </div>
          </section>

          <section
            id="chart-analysis"
            className="space-y-8 rounded-xl border border-green-100 bg-green-50/20 px-4 py-8 -mx-4 dark:border-green-800/50 dark:bg-green-900/20"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-800/50">
                <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">
                  차트 분석
                </h2>
                <p className="text-base text-gray-600 dark:text-gray-400">
                  시가총액 일간 추이와 종목별 구성 비중을 확인하세요
                </p>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-xl border bg-background p-4 shadow-sm">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {displayName} {securityType} 시가총액 일간 추이
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      최근 3개월 동안의 시가총액 흐름을 일별로 확인합니다.
                    </p>
                  </div>
                  <div className="mt-4">
                    <ChartMarketcap
                      data={marketcapChartData}
                      format="formatNumber"
                      formatTooltip="formatNumberTooltip"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border bg-background p-4 shadow-sm h-full">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      종목별 시가총액 구성
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      동일 기업 내 각 종목의 시가총액 비중을 비교합니다.
                    </p>
                  </div>
                  <div className="mt-4">
                    <CardMarketcapDetail securities={compositionSecurities as any} />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border bg-background p-4 shadow-sm lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      최근 3개월 가격 차트
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      일별 시가 · 고가 · 저가 · 종가와 거래량을 함께 살펴봅니다.
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
                    최근 3개월
                  </span>
                </div>
                <CandlestickChart data={candlestickData} />
              </div>
            </div>
          </section>

          {companyMarketcapData && companySecs.length > 0 && (
            <section
              id="securities-summary"
              className="space-y-6 rounded-xl border border-purple-100 bg-purple-50/20 px-4 py-8 -mx-4 dark:border-purple-800/40 dark:bg-purple-900/20"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-800/50">
                  <ArrowLeftRight className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">
                    종목 비교
                  </h2>
                  <p className="text-base text-gray-600 dark:text-gray-400">
                    동일 기업 내 다른 종목과 시가총액을 비교해 보세요
                  </p>
                </div>
              </div>

              <InteractiveSecuritiesSection
                companyMarketcapData={companyMarketcapData}
                companySecs={companySecs}
                market={market}
                currentTicker={currentTicker}
                baseUrl="security"
                currentMetric="marketcap"
              />
            </section>
          )}

          <CompanyFinancialTabs secCode={secCode} />

          <MidNavWrapper sectype={security.type || "보통주"} />

          {periodAnalysis && (
            <section
              id="indicators"
              className="space-y-6 rounded-xl border border-yellow-100 bg-yellow-50/20 px-4 py-8 -mx-4 dark:border-yellow-800/40 dark:bg-yellow-900/20"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-800/50">
                  <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">
                    핵심 지표
                  </h2>
                  <p className="text-base text-gray-600 dark:text-gray-400">
                    기간별 시가총액 통계와 변화율을 확인합니다
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {metricsCards.map((metric) => (
                  <Card key={metric.title}>
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
          )}

          <section
            id="annual-data"
            className="space-y-6 rounded-xl border border-red-100 bg-red-50/20 px-4 py-8 -mx-4 dark:border-red-800/40 dark:bg-red-900/20"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-800/50">
                <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100 md:text-3xl">
                  연도별 데이터
                </h2>
                <p className="text-base text-gray-600 dark:text-gray-400">
                  시가총액의 장기 추세와 연말 기준 값을 살펴봅니다
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-xl border bg-background p-4 shadow-sm">
                <ChartMarketcap
                  data={fullChartData}
                  format="formatNumber"
                  formatTooltip="formatNumberTooltip"
                />
              </div>

              <div>
                <ListMarketcap data={listData} />
              </div>
            </div>
          </section>

          <SecMarketcapPager rank={marketcapRank || 1} />
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-16 flex flex-col gap-4">
            <CardMarketcap
              security={security as any}
              currentMetric="marketcap"
              isCompanyPage={false}
            />

            <Card>
              <CardHeader>
                <CardTitle>종목 개요</CardTitle>
                <CardDescription>
                  {latestMarketcapDate
                    ? `${formatDate(latestMarketcapDate)} 기준`
                    : "기본 정보"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">종목명</dt>
                    <dd className="font-medium text-right">{displayName}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">구분</dt>
                    <dd className="font-medium text-right">{securityType}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">거래소</dt>
                    <dd className="font-medium text-right">
                      {security.exchange || market}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">티커</dt>
                    <dd className="font-medium text-right">{currentTicker}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">시가총액</dt>
                    <dd className="font-medium text-right">
                      {formatNumber(latestMarketcapValue, "원")}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>핵심 지표</CardTitle>
                <CardDescription>최근 데이터 기준 요약</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">현재 시총</dt>
                    <dd className="font-medium text-right">
                      {formatNumber(periodAnalysis?.latestValue ?? latestMarketcapValue, "원")}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">12개월 평균</dt>
                    <dd className="font-medium text-right">
                      {formatNumber(
                        periodAnalysis?.periods.find((p) => p.label === "12개월 평균")?.value || 0,
                        "원",
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">최고 시총</dt>
                    <dd className="font-medium text-right">
                      {formatNumber(periodAnalysis?.minMax.max || 0, "원")}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">1년 변화율</dt>
                    <dd className="font-medium text-right">
                      {periodAnalysis?.yearChange !== null && periodAnalysis?.yearChange !== undefined
                        ? `${periodAnalysis.yearChange > 0 ? "+" : ""}${periodAnalysis.yearChange.toFixed(1)}%`
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {companyMarketcapData && companySecs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>종목 빠른 이동</CardTitle>
                  <CardDescription>다른 종목도 확인해 보세요</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InteractiveSecuritiesSection
                    companyMarketcapData={companyMarketcapData}
                    companySecs={companySecs}
                    market={market}
                    currentTicker={currentTicker}
                    baseUrl="security"
                    currentMetric="marketcap"
                    layout="sidebar"
                    showSummaryCard={false}
                    compactMode
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </aside>
      </main>
    </LayoutWrapper>
  );
}
