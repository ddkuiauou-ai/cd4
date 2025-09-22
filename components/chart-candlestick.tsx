"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type {
  AreaData,
  BusinessDay,
  CandlestickData,
  IChartApi,
  LineData,
  MouseEventParams,
  IPaneApi,
  ISeriesApi,
  Time,
} from "lightweight-charts";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  LineSeries,
  PriceScaleMode,
  createChart,
} from "lightweight-charts";

interface CandlestickPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | string | bigint | null;
}

const MOVING_AVERAGE_CONFIGS = [
  { period: 5, color: "#f97316", label: "5일 이평" },
  { period: 10, color: "#0ea5e9", label: "10일 이평" },
] as const;

type MovingAverageConfig = (typeof MOVING_AVERAGE_CONFIGS)[number];
type MovingAveragePeriod = MovingAverageConfig["period"];
type MovingAverageSeriesData = Record<MovingAveragePeriod, LineData[]>;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function labToRgbaString(lab: string): string | null {
  const match = lab
    .toLowerCase()
    .match(/lab\(\s*([\d.+-]+)%?\s+([\d.+-]+)\s+([\d.+-]+)(?:\s*\/\s*([\d.+-]+%?))?\s*\)/);

  if (!match) {
    return null;
  }

  const [, lRaw, aRaw, bRaw, alphaRaw] = match;

  const L = parseFloat(lRaw);
  const a = parseFloat(aRaw);
  const b = parseFloat(bRaw);

  if (!Number.isFinite(L) || !Number.isFinite(a) || !Number.isFinite(b)) {
    return null;
  }

  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;

  const fx3 = fx ** 3;
  const fz3 = fz ** 3;

  const xr = fx3 > epsilon ? fx3 : (116 * fx - 16) / kappa;
  const yr = L > kappa * epsilon ? ((L + 16) / 116) ** 3 : L / kappa;
  const zr = fz3 > epsilon ? fz3 : (116 * fz - 16) / kappa;

  const refX = 0.950489;
  const refY = 1.0;
  const refZ = 1.08884;

  const X = xr * refX;
  const Y = yr * refY;
  const Z = zr * refZ;

  const rLinear = 3.2406 * X + -1.5372 * Y + -0.4986 * Z;
  const gLinear = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  const bLinear = 0.0557 * X + -0.204 * Y + 1.057 * Z;

  const toSrgb = (channel: number) => {
    const value = channel <= 0 ? 0 : channel;
    const converted =
      value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
    return Math.round(clamp(converted, 0, 1) * 255);
  };

  const r = toSrgb(rLinear);
  const g = toSrgb(gLinear);
  const blue = toSrgb(bLinear);

  if (alphaRaw) {
    const alphaValue = alphaRaw.includes("%")
      ? clamp(parseFloat(alphaRaw) / 100, 0, 1)
      : clamp(parseFloat(alphaRaw), 0, 1);
    if (!Number.isFinite(alphaValue)) {
      return `rgb(${r}, ${g}, ${blue})`;
    }
    return `rgba(${r}, ${g}, ${blue}, ${alphaValue})`;
  }

  return `rgb(${r}, ${g}, ${blue})`;
}

function normalizeColor(color: string | null | undefined, fallback: string) {
  if (!color) {
    return fallback;
  }

  const trimmed = color.trim();

  if (!trimmed) {
    return fallback;
  }

  if (trimmed.startsWith("lab(")) {
    const converted = labToRgbaString(trimmed);
    return converted ?? fallback;
  }

  return trimmed;
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.name === "NotFoundError";
}

function removeTradingViewAttribution() {
  if (typeof document === "undefined") {
    return;
  }

  const nodes = document.querySelectorAll("#tv-attr-logo");
  nodes.forEach((node) => node.remove());
}

function normalizeVolumeValue(volume: CandlestickPoint["volume"]): number | null {
  if (volume === null || volume === undefined) {
    return null;
  }

  if (typeof volume === "number" && Number.isFinite(volume)) {
    return Math.max(volume, 0);
  }

  if (typeof volume === "bigint") {
    const numeric = Number(volume);
    return Number.isFinite(numeric) ? Math.max(numeric, 0) : null;
  }

  if (typeof volume === "string") {
    const numeric = Number.parseFloat(volume.replace(/,/g, ""));
    return Number.isFinite(numeric) ? Math.max(numeric, 0) : null;
  }

  return null;
}

const VOLUME_ACCENT_RGB = "38, 166, 154";

const koreanPriceFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

const volumeAccent = (alpha: number) => `rgba(${VOLUME_ACCENT_RGB}, ${alpha})`;

const koreanVolumeFormatter = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function coerceTimeToDate(time: Time): Date | null {
  if (typeof time === "number") {
    const dateFromUnix = new Date(time * 1000);
    return Number.isNaN(dateFromUnix.getTime()) ? null : dateFromUnix;
  }

  if (typeof time === "string") {
    const hyphenParts = time.split("-").map((part) => Number.parseInt(part, 10));
    if (hyphenParts.length === 3 && hyphenParts.every((value) => Number.isInteger(value))) {
      const [year, month, day] = hyphenParts;
      const candidate = new Date(year, month - 1, day);
      return Number.isNaN(candidate.getTime()) ? null : candidate;
    }

    const dateFromString = new Date(time);
    return Number.isNaN(dateFromString.getTime()) ? null : dateFromString;
  }

  if (typeof time === "object" && time !== null) {
    const businessDay = time as BusinessDay;
    if (
      Number.isInteger(businessDay.year) &&
      Number.isInteger(businessDay.month) &&
      Number.isInteger(businessDay.day)
    ) {
      const candidate = new Date(businessDay.year, businessDay.month - 1, businessDay.day);
      return Number.isNaN(candidate.getTime()) ? null : candidate;
    }
  }

  return null;
}

function formatTimeKey(time: Time): string {
  if (typeof time === "string" || typeof time === "number") {
    return String(time);
  }

  if (typeof time === "object" && time !== null) {
    const businessDay = time as BusinessDay;
    const pad = (value: number) => value.toString().padStart(2, "0");

    if (
      Number.isInteger(businessDay.year) &&
      Number.isInteger(businessDay.month) &&
      Number.isInteger(businessDay.day)
    ) {
      return `${businessDay.year}-${pad(businessDay.month)}-${pad(businessDay.day)}`;
    }
  }

  return "";
}

function formatTooltipDate(time: Time): string {
  const date = coerceTimeToDate(time);

  if (!date) {
    if (typeof time === "string") {
      return time;
    }
    if (typeof time === "number") {
      return String(time);
    }
    return "";
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}년 ${month}월 ${day}일`;
}

function formatAxisDate(time: Time): string {
  const date = coerceTimeToDate(time);

  if (!date) {
    if (typeof time === "string") {
      return time;
    }
    if (typeof time === "number") {
      return String(time);
    }
    return "";
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const shouldShowYear = month === 1 && day <= 5;

  return shouldShowYear ? `${year}년 ${month}월 ${day}일` : `${month}월 ${day}일`;
}

interface CandlestickChartProps {
  data: CandlestickPoint[];
}

export function CandlestickChart({ data }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const movingAverageSeriesRef = useRef<
    Map<MovingAveragePeriod, ISeriesApi<"Line">>
  >(new Map());
  const volumePaneRef = useRef<IPaneApi<Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const {
    candlesticks,
    volumes,
    priceMin,
    priceMax,
    priceSpan,
    volumeByTime,
    movingAverages,
  } = useMemo(() => {
    const sanitized = data.filter((point) =>
      point.open !== null &&
      point.high !== null &&
      point.low !== null &&
      point.close !== null &&
      Number.isFinite(point.open) &&
      Number.isFinite(point.high) &&
      Number.isFinite(point.low) &&
      Number.isFinite(point.close)
    );

    const candlestickPoints: CandlestickData[] = [];
    const movingAveragePoints = {} as MovingAverageSeriesData;
    const rollingWindows = new Map<
      MovingAveragePeriod,
      { values: number[]; sum: number }
    >();
    let computedMin: number | null = null;
    let computedMax: number | null = null;
    const volumePoints: AreaData[] = [];
    const rawVolumeByTime = new Map<string, number>();

    MOVING_AVERAGE_CONFIGS.forEach((config) => {
      movingAveragePoints[config.period] = [];
      rollingWindows.set(config.period, { values: [], sum: 0 });
    });

    for (const point of sanitized) {
      const open = Number(point.open);
      const high = Number(point.high);
      const low = Number(point.low);
      const close = Number(point.close);
      const timeValue = point.time as Time;
      const timeKey = formatTimeKey(timeValue);

      candlestickPoints.push({
        time: timeValue,
        open,
        high,
        low,
        close,
      });

      MOVING_AVERAGE_CONFIGS.forEach(({ period }) => {
        const windowState = rollingWindows.get(period);

        if (!windowState) {
          return;
        }

        windowState.values.push(close);
        windowState.sum += close;

        if (windowState.values.length > period) {
          const removed = windowState.values.shift();

          if (typeof removed === "number") {
            windowState.sum -= removed;
          }
        }

        const divisor = windowState.values.length || 1;
        const series = movingAveragePoints[period];

        if (series) {
          series.push({
            time: timeValue,
            value: windowState.sum / divisor,
          });
        }
      });

      computedMin = computedMin === null ? low : Math.min(computedMin, low);
      computedMax = computedMax === null ? high : Math.max(computedMax, high);

      const normalizedVolume = normalizeVolumeValue(point.volume);

      if (normalizedVolume !== null) {
        volumePoints.push({
          time: timeValue,
          value: normalizedVolume,
        });

        if (timeKey) {
          rawVolumeByTime.set(timeKey, normalizedVolume);
        }
      }
    }

    const priceSpanValue =
      computedMin !== null && computedMax !== null
        ? Math.max(computedMax - computedMin, 0)
        : null;

    return {
      candlesticks: candlestickPoints,
      volumes: volumePoints,
      priceMin: computedMin,
      priceMax: computedMax,
      priceSpan: priceSpanValue,
      volumeByTime: rawVolumeByTime,
      movingAverages: movingAveragePoints,
    };
  }, [data]);
  const hasCandlestickData = candlesticks.length > 0;
  const hasVolumeData = volumes.length > 0;
  const priceScaleBottomMargin = useMemo(() => {
    if (!hasVolumeData) {
      return 0.1;
    }

    if (priceMin === null || priceMax === null || priceSpan === null || priceSpan <= 0) {
      return 0.16;
    }

    const minMargin = 0.08;
    const maxMargin = 0.24;
    const baseline = Math.max(Math.abs(priceMax), Math.abs(priceMin), 1);
    const normalizedSpan = clamp(priceSpan / baseline, 0, 1);
    const interpolatedMargin = minMargin + (maxMargin - minMargin) * normalizedSpan;

    return clamp(interpolatedMargin, minMargin, maxMargin);
  }, [hasVolumeData, priceMax, priceMin, priceSpan]);
  const volumeByTimeRef = useRef(volumeByTime);

  useEffect(() => {
    volumeByTimeRef.current = volumeByTime;
  }, [volumeByTime]);

  const disposeChart = useCallback(() => {
    const existingChart = chartRef.current;

    if (volumeSeriesRef.current && existingChart) {
      try {
        existingChart.removeSeries(volumeSeriesRef.current);
      } catch (error) {
        if (!isNotFoundError(error)) {
          console.error("Failed to remove volume series:", error);
        }
      }
    }

    volumeSeriesRef.current = null;

    if (volumePaneRef.current && existingChart) {
      try {
        const paneIndex = volumePaneRef.current.paneIndex();
        existingChart.removePane(paneIndex);
      } catch (error) {
        if (!isNotFoundError(error)) {
          console.error("Failed to remove volume pane:", error);
        }
      }
    }

    volumePaneRef.current = null;
    if (existingChart) {
      movingAverageSeriesRef.current.forEach((series) => {
        try {
          existingChart.removeSeries(series);
        } catch (error) {
          if (!isNotFoundError(error)) {
            console.error("Failed to dispose moving average series:", error);
          }
        }
      });
    }

    if (existingChart) {
      try {
        existingChart.remove();
      } catch (error) {
        if (!isNotFoundError(error)) {
          console.error("Failed to dispose lightweight chart:", error);
        }
      }
    }

    chartRef.current = null;
    priceSeriesRef.current = null;
    movingAverageSeriesRef.current.clear();
  }, []);

  useEffect(() => {
    if (!hasCandlestickData) {
      disposeChart();
      return;
    }

    const container = containerRef.current;

    if (!container || chartRef.current) {
      return;
    }

    container.replaceChildren();
    container.replaceChildren();
    const computedStyle = getComputedStyle(document.documentElement);
    const foreground = normalizeColor(
      computedStyle.getPropertyValue("--foreground"),
      "#111827"
    );
    const borderColor = normalizeColor(
      computedStyle.getPropertyValue("--border"),
      "rgba(148, 163, 184, 0.4)"
    );

    const chart = createChart(container, {
      layout: {
        textColor: foreground,
        background: { type: ColorType.Solid, color: "transparent" },
        panes: {
          separatorColor: volumeAccent(0.35),
          separatorHoverColor: volumeAccent(0.55),
          enableResize: false,
        },
      },
      grid: {
        horzLines: { color: "rgba(148, 163, 184, 0.16)" },
        vertLines: { color: "rgba(148, 163, 184, 0.16)" },
      },
      leftPriceScale: {
        visible: false,
        borderColor,
      },
      rightPriceScale: { borderColor },
      timeScale: {
        borderColor,
        timeVisible: false,
        secondsVisible: false,
        rightOffset: 0,
        fixLeftEdge: true,
        fixRightEdge: true,
        tickMarkFormatter: (time) => formatAxisDate(time) || "",
      },
      localization: {
        locale: "ko-KR",
        priceFormatter: (price) => koreanPriceFormatter.format(price),
        timeFormatter: (time) => formatTooltipDate(time) || "",
      },
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#D60000",
      downColor: "#0051C7",
      borderUpColor: "#B80000",
      borderDownColor: "#003C9D",
      wickUpColor: "#D60000",
      wickDownColor: "#0051C7",
      priceFormat: { type: "price", precision: 0, minMove: 1 },
      priceScaleId: "right",
    });

    const movingAverageSeriesMap = new Map<
      MovingAveragePeriod,
      ISeriesApi<"Line">
    >();

    MOVING_AVERAGE_CONFIGS.forEach(({ period, color }) => {
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceScaleId: "right",
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      movingAverageSeriesMap.set(period, series);
    });

    candlestickSeries
      .priceScale()
      .applyOptions({
        borderColor,
        mode: PriceScaleMode.Normal,
        autoScale: true,
        scaleMargins: {
          top: 0.1,
          bottom: priceScaleBottomMargin,
        },
        position: "right",
      });

    chartRef.current = chart;
    priceSeriesRef.current = candlestickSeries;
    movingAverageSeriesRef.current = movingAverageSeriesMap;

    const tooltip = document.createElement("div");
    tooltip.className =
      "pointer-events-none absolute z-20 whitespace-nowrap rounded-lg border border-border/80 bg-background/95 px-3 py-2 text-left text-[11px] shadow-lg ring-1 ring-black/5 backdrop-blur-sm";
    tooltip.style.position = "absolute";
    tooltip.style.left = "0px";
    tooltip.style.top = "0px";
    tooltip.style.visibility = "hidden";
    tooltip.style.transform = "translateX(-50%)";
    tooltipRef.current = tooltip;
    container.appendChild(tooltip);

    const handleCrosshairMove = (param: MouseEventParams) => {
      const tooltipEl = tooltipRef.current;
      const series = priceSeriesRef.current;

      if (!tooltipEl || !series) {
        return;
      }

      const containerElement = containerRef.current;

      if (!containerElement || !param.point || param.time === undefined) {
        tooltipEl.style.visibility = "hidden";
        return;
      }

      const { point, seriesData, time } = param;
      const width = containerElement.clientWidth;
      const height = containerElement.clientHeight;
      const isOutside =
        point.x < 0 ||
        point.y < 0 ||
        point.x > width ||
        point.y > height;

      if (isOutside) {
        tooltipEl.style.visibility = "hidden";
        return;
      }

      const priceData = seriesData.get(series) as CandlestickData | undefined;
      const movingAverageSeriesMap = movingAverageSeriesRef.current;
      const movingAverageData = MOVING_AVERAGE_CONFIGS.map((config) => {
        const series = movingAverageSeriesMap.get(config.period);
        const valueData = series
          ? (seriesData.get(series) as LineData | undefined)
          : undefined;

        const value =
          typeof valueData?.value === "number" ? valueData.value : null;

        return {
          ...config,
          value,
          text: value !== null ? koreanPriceFormatter.format(value) : null,
        };
      });

      if (!priceData) {
        tooltipEl.style.visibility = "hidden";
        return;
      }

      const open = priceData.open ?? priceData.close ?? 0;
      const high = priceData.high ?? priceData.close ?? open;
      const low = priceData.low ?? priceData.close ?? open;
      const close = priceData.close ?? priceData.open ?? open;
      const timeLabel = formatTooltipDate(time as Time);
      const openText = koreanPriceFormatter.format(open);
      const highText = koreanPriceFormatter.format(high);
      const lowText = koreanPriceFormatter.format(low);
      const closeText = koreanPriceFormatter.format(close);

      const volumeMap = volumeByTimeRef.current;
      const volumeKey = formatTimeKey(time as Time);
      const volumeValue = volumeMap?.get(volumeKey);
      const volumeText =
        volumeValue !== undefined
          ? `${koreanVolumeFormatter.format(volumeValue)}주`
          : null;

      tooltipEl.innerHTML = `
        <div class="flex flex-col gap-1.5">
          <div class="text-[11px] font-medium text-muted-foreground">${timeLabel}</div>
          <div class="grid gap-1 text-[11px] leading-relaxed">
            <div class="flex items-center justify-between gap-6">
              <span class="text-muted-foreground">시초가</span>
              <span class="font-semibold text-foreground">${openText}</span>
            </div>
            <div class="flex items-center justify-between gap-6">
              <span class="text-muted-foreground">고가</span>
              <span class="font-semibold text-foreground">${highText}</span>
            </div>
            <div class="flex items-center justify-between gap-6">
              <span class="text-muted-foreground">저가</span>
              <span class="font-semibold text-foreground">${lowText}</span>
            </div>
            <div class="flex items-center justify-between gap-6">
              <span class="text-muted-foreground">종가</span>
              <span class="font-semibold text-foreground">${closeText}</span>
            </div>
            ${movingAverageData
              .filter((item) => item.text)
              .map(
                (item) =>
                  `<div class="flex items-center justify-between gap-6"><span class="text-muted-foreground">${item.label}</span><span class="font-semibold" style="color:${item.color}">${item.text}</span></div>`
              )
              .join("")
            }
            ${
              volumeText
                ? `<div class="flex items-center justify-between gap-6"><span class="text-muted-foreground">거래량</span><span class="font-semibold text-foreground">${volumeText}</span></div>`
                : ""
            }
          </div>
        </div>
      `;

      tooltipEl.style.visibility = "visible";

      const horizontalPadding = 12;
      const tooltipWidth = tooltipEl.offsetWidth;
      const tooltipHeight = tooltipEl.offsetHeight;
      const clampedX = Math.min(
        Math.max(point.x, horizontalPadding + tooltipWidth / 2),
        width - horizontalPadding - tooltipWidth / 2
      );
      const clampedY = Math.max(point.y - tooltipHeight - 12, 0);

      tooltipEl.style.left = `${clampedX}px`;
      tooltipEl.style.top = `${clampedY}px`;
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    const removeAttributionFrame = requestAnimationFrame(() => {
      removeTradingViewAttribution();
    });

    return () => {
      cancelAnimationFrame(removeAttributionFrame);
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      if (tooltipRef.current) {
        tooltipRef.current.remove();
        tooltipRef.current = null;
      }
      disposeChart();
    };
  }, [disposeChart, hasCandlestickData, priceScaleBottomMargin]);

  useEffect(() => {
    if (!hasCandlestickData) {
      disposeChart();
      return;
    }

    const chart = chartRef.current;
    const candlestickSeries = priceSeriesRef.current;
    if (!chart || !candlestickSeries) {
      return;
    }

    candlestickSeries.setData(candlesticks);

    MOVING_AVERAGE_CONFIGS.forEach(({ period }) => {
      const series = movingAverageSeriesRef.current.get(period);

      if (!series) {
        return;
      }

      const seriesData = movingAverages[period] ?? [];

      if (seriesData.length) {
        series.setData(seriesData);
      } else {
        series.setData([]);
      }
    });

    const borderColor = normalizeColor(
      getComputedStyle(document.documentElement).getPropertyValue("--border"),
      "rgba(148, 163, 184, 0.4)"
    );

    candlestickSeries.priceScale().applyOptions({
      borderColor,
      mode: PriceScaleMode.Normal,
      autoScale: true,
      position: "right",
      scaleMargins: {
        top: 0.1,
        bottom: priceScaleBottomMargin,
      },
    });

    chart.applyOptions({
      leftPriceScale: {
        visible: false,
        borderColor,
      },
      rightPriceScale: { borderColor },
    });

    if (hasVolumeData) {
      let volumePane = volumePaneRef.current;
      let volumeSeries = volumeSeriesRef.current;

      if (!volumePane) {
        volumePane = chart.addPane();
        volumePane.setHeight(136);
        volumePane.setStretchFactor(0.32);
        volumePane.moveTo(1);
        volumePaneRef.current = volumePane;
      }

      if (!volumeSeries) {
        volumeSeries = volumePane.addSeries(AreaSeries, {
          priceFormat: {
            type: "custom",
            minMove: 1,
            formatter: (value: number) =>
              koreanVolumeFormatter.format(Math.max(value, 0)),
          },
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          lineWidth: 2,
          lineColor: volumeAccent(0.85),
          topColor: volumeAccent(0.28),
          bottomColor: volumeAccent(0.05),
          baseLineColor: volumeAccent(0.16),
          priceScaleId: "volume",
          pointMarkersVisible: false,
        });
        volumeSeriesRef.current = volumeSeries;
      }

      volumeSeries.setData(volumes);

      const paneIndex = volumePane.paneIndex();

      chart.priceScale("volume", paneIndex).applyOptions({
        borderColor,
        mode: PriceScaleMode.Normal,
        autoScale: true,
        position: "right",
        scaleMargins: {
          top: 0.1,
          bottom: 0,
        },
      });
    } else {
      if (volumeSeriesRef.current) {
        try {
          chart.removeSeries(volumeSeriesRef.current);
        } catch (error) {
          if (!isNotFoundError(error)) {
            console.error("Failed to remove volume series:", error);
          }
        }
        volumeSeriesRef.current = null;
      }

      if (volumePaneRef.current) {
        try {
          const paneIndex = volumePaneRef.current.paneIndex();
          chart.removePane(paneIndex);
        } catch (error) {
          if (!isNotFoundError(error)) {
            console.error("Failed to remove volume pane:", error);
          }
        }
        volumePaneRef.current = null;
      }
    }

    let animationFrame: number | undefined;

    const firstVisibleTime = candlesticks[0]?.time;
    const lastVisibleTime = candlesticks[candlesticks.length - 1]?.time;

    if (firstVisibleTime && lastVisibleTime) {
      animationFrame = requestAnimationFrame(() => {
        const activeChart = chartRef.current;

        if (!activeChart) {
          return;
        }

        activeChart.timeScale().setVisibleRange({
          from: firstVisibleTime as Time,
          to: lastVisibleTime as Time,
        });
      });
    } else {
      chart.timeScale().fitContent();
    }

    const attributionFrame = requestAnimationFrame(() => {
      removeTradingViewAttribution();
    });

    return () => {
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame);
      }
      cancelAnimationFrame(attributionFrame);
    };
  }, [
    candlesticks,
    disposeChart,
    hasCandlestickData,
    hasVolumeData,
    movingAverages,
    priceScaleBottomMargin,
    volumes,
  ]);



  if (!hasCandlestickData) {
    return (
      <div className="flex h-[320px] w-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/60 text-sm text-muted-foreground sm:h-[340px] md:h-[380px] lg:h-[420px]">
        최근 한 달간의 캔들 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="relative h-[320px] w-full overflow-hidden rounded-xl border border-border/60 bg-background/80 sm:h-[340px] md:h-[380px] lg:h-[420px]">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
