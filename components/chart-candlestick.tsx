"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  BusinessDay,
  CandlestickData,
  HistogramData,
  IChartApi,
  Time,
} from "lightweight-charts";
import { ColorType, CrosshairMode, createChart } from "lightweight-charts";

const VOLUME_SCALE_ID = "volume";
const PRICE_SCALE_BOTTOM_MARGIN_WITH_VOLUME = 0.25;
const VOLUME_SECTION_TOP = 1 - PRICE_SCALE_BOTTOM_MARGIN_WITH_VOLUME;

interface CandlestickPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | string | bigint | null;
}

interface CandlestickChartProps {
  data: CandlestickPoint[];
}

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
        
const koreanPriceFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
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
      const candidate = new Date(
        businessDay.year,
        businessDay.month - 1,
        businessDay.day
      );
      return Number.isNaN(candidate.getTime()) ? null : candidate;
    }
  }

  return null;
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

  const year = String(date.getFullYear()).slice(-2);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${year}.${month}.${day}`;
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

  const year = String(date.getFullYear()).slice(-2);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const shouldShowYear = month === 1 && day <= 5;

  return shouldShowYear ? `${year}/${month}/${day}` : `${month}/${day}`;
}

export function CandlestickChart({ data }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [volumeOverlayBounds, setVolumeOverlayBounds] = useState<
    { top: number; height: number } | null
  >(null);

  const { candlesticks, volumes, hasVolumeData } = useMemo(() => {
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

    const upVolumeColor = "rgba(214, 0, 0, 0.45)";
    const downVolumeColor = "rgba(0, 81, 199, 0.45)";

    const candlestickPoints: CandlestickData[] = sanitized.map((point) => ({
      time: point.time,
      open: Number(point.open),
      high: Number(point.high),
      low: Number(point.low),
      close: Number(point.close),
    }));

    let hasVolume = false;

    const volumePoints: HistogramData[] = sanitized.map((point) => {
      const open = Number(point.open);
      const close = Number(point.close);
      const normalizedVolume = normalizeVolumeValue(point.volume) ?? 0;

      if (!hasVolume && normalizedVolume > 0) {
        hasVolume = true;
      }

      return {
        time: point.time as Time,
        value: normalizedVolume,
        color: close >= open ? upVolumeColor : downVolumeColor,
      };
    });

    return {
      candlesticks: candlestickPoints,
      volumes: volumePoints,
      hasVolumeData: hasVolume,
    };
  }, [data]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      setVolumeOverlayBounds(null);
      return;
    }

    if (!candlesticks.length) {
      chartRef.current?.remove();
      chartRef.current = null;
      setVolumeOverlayBounds(null);
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let animationFrameId: number | null = null;
    let disposed = false;

    const updateVolumeOverlayBounds = () => {
      if (disposed) {
        return;
      }

      const containerElement = containerRef.current;

      if (!containerElement || !hasVolumeData || volumes.length === 0) {
        setVolumeOverlayBounds(null);
        return;
      }

      const paneElements = containerElement.querySelectorAll<HTMLElement>(
        ".tv-lightweight-charts__pane"
      );

      if (paneElements.length < 2) {
        setVolumeOverlayBounds(null);
        return;
      }

      const volumePane = paneElements[paneElements.length - 1];
      const containerRect = containerElement.getBoundingClientRect();
      const paneRect = volumePane.getBoundingClientRect();

      const measuredTop = Math.max(0, paneRect.top - containerRect.top);
      const measuredHeight = Math.max(0, paneRect.height);
      const nextTop = Math.round(measuredTop);
      const nextHeight = Math.round(measuredHeight);

      setVolumeOverlayBounds((prev) => {
        if (
          prev &&
          Math.abs(prev.top - nextTop) < 1 &&
          Math.abs(prev.height - nextHeight) < 1
        ) {
          return prev;
        }

        return { top: nextTop, height: nextHeight };
      });
    };

    const setupChart = async () => {
      if (!containerRef.current) {
        return;
      }

      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }

      const computedStyle = getComputedStyle(document.documentElement);
      const foreground = normalizeColor(
        computedStyle.getPropertyValue("--foreground"),
        "#111827"
      );
      const borderColor = normalizeColor(
        computedStyle.getPropertyValue("--border"),
        "rgba(148, 163, 184, 0.4)"
      );

      const chart = createChart(containerRef.current, {
        layout: {
          textColor: foreground,
          background: { type: ColorType.Solid, color: "transparent" },
        },
        grid: {
          horzLines: { color: "rgba(148, 163, 184, 0.16)" },
          vertLines: { color: "rgba(148, 163, 184, 0.16)" },
        },
        rightPriceScale: { borderColor },
        timeScale: {
          borderColor,
          timeVisible: false,
          secondsVisible: false,
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

      const seriesOptions = {
        upColor: "#D60000",
        downColor: "#0051C7",
        borderUpColor: "#B80000",
        borderDownColor: "#003C9D",
        wickUpColor: "#D60000",
        wickDownColor: "#0051C7",
      } as const;

      let series: ReturnType<IChartApi["addCandlestickSeries"]> | null = null;
      let volumeSeries: ReturnType<IChartApi["addHistogramSeries"]> | null = null;

      if (typeof chart.addCandlestickSeries === "function") {
        series = chart.addCandlestickSeries(seriesOptions);
      } else {
        const chartWithSeries = chart as unknown as {
          addSeries?: (
            ctor: unknown,
            options: typeof seriesOptions
          ) => ReturnType<IChartApi["addCandlestickSeries"]>;
        };

        if (typeof chartWithSeries.addSeries === "function") {
          try {
            const mod = await import("lightweight-charts");
            const CandlestickCtor = (mod as { CandlestickSeries?: unknown })
              .CandlestickSeries;

            if (CandlestickCtor) {
              series = chartWithSeries.addSeries(
                CandlestickCtor,
                seriesOptions
              ) as ReturnType<IChartApi["addCandlestickSeries"]>;
            }
          } catch (error) {
            console.error(
              "Failed to dynamically load candlestick series constructor:",
              error
            );
          }
        }
      }

      if (disposed) {
        chart.remove();
        return;
      }

      if (!series) {
        console.error(
          "Unable to create candlestick series with the current lightweight-charts build."
        );
        chart.remove();
        return;
      }

      const hasVolumeSeries = hasVolumeData && volumes.length > 0;

      const priceScaleMargins = hasVolumeSeries
        ? {
            top: 0.1,
            bottom: PRICE_SCALE_BOTTOM_MARGIN_WITH_VOLUME,
          }
        : {
            top: 0.1,
            bottom: 0.1,
          };

      series.priceScale().applyOptions({
        scaleMargins: priceScaleMargins,
      });

      if (hasVolumeSeries) {
        if (typeof chart.addHistogramSeries === "function") {
          volumeSeries = chart.addHistogramSeries({
            color: "rgba(148, 163, 184, 0.4)",
            priceFormat: { type: "volume" },
            priceScaleId: VOLUME_SCALE_ID,
            priceLineVisible: false,
            lastValueVisible: false,
            baseLineVisible: false,
          });
        } else {
          const chartWithSeries = chart as unknown as {
            addSeries?: (
              ctor: unknown,
              options: Parameters<IChartApi["addHistogramSeries"]>[0]
            ) => ReturnType<IChartApi["addHistogramSeries"]>;
          };

          if (typeof chartWithSeries.addSeries === "function") {
            try {
              const mod = await import("lightweight-charts");
              const HistogramCtor = (mod as { HistogramSeries?: unknown })
                .HistogramSeries;

              if (HistogramCtor) {
                volumeSeries = chartWithSeries.addSeries(HistogramCtor, {
                  color: "rgba(148, 163, 184, 0.4)",
                  priceFormat: { type: "volume" },
                  priceScaleId: VOLUME_SCALE_ID,
                  priceLineVisible: false,
                  lastValueVisible: false,
                  baseLineVisible: false,
                }) as ReturnType<IChartApi["addHistogramSeries"]>;
              }
            } catch (error) {
              console.error(
                "Failed to dynamically load histogram series constructor:",
                error
              );
            }
          }
        }
      }

      if (hasVolumeSeries && !volumeSeries) {
        console.error(
          "Unable to create volume histogram series with the current lightweight-charts build."
        );
      }

      if (volumeSeries) {
        const volumeScaleMargins = {
          top: VOLUME_SECTION_TOP,
          bottom: 0,
        } as const;

        volumeSeries.priceScale().applyOptions({
          scaleMargins: volumeScaleMargins,
        });

        const volumeScale = chart.priceScale(VOLUME_SCALE_ID);
        volumeScale.applyOptions({
          scaleMargins: volumeScaleMargins,
          autoScale: true,
          visible: false,
        });

        chart.priceScale("right").applyOptions({
          scaleMargins: {
            top: 0.05,
            bottom: PRICE_SCALE_BOTTOM_MARGIN_WITH_VOLUME,
          },
        });

        volumeSeries.setData(volumes);
      }

      series.setData(candlesticks);
      chart.timeScale().fitContent();

      if (typeof window !== "undefined") {
        animationFrameId = window.requestAnimationFrame(
          updateVolumeOverlayBounds
        );
      }

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || disposed) {
          return;
        }

        chart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });

        updateVolumeOverlayBounds();
      });

      if (!containerRef.current || disposed) {
        resizeObserver.disconnect();
        chart.remove();
        return;
      }

      resizeObserver.observe(containerRef.current);
      chartRef.current = chart;

      removeTradingViewAttribution();

      if (typeof MutationObserver !== "undefined") {
        mutationObserver = new MutationObserver(() => {
          removeTradingViewAttribution();
          updateVolumeOverlayBounds();
        });

        if (containerRef.current) {
          mutationObserver.observe(containerRef.current, {
            childList: true,
            subtree: true,
          });
        }

        if (typeof document !== "undefined" && document.body) {
          mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
          });
        }
      }
    };

    void setupChart();

    return () => {
      disposed = true;
      if (animationFrameId !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(animationFrameId);
      }
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [candlesticks, hasVolumeData, volumes]);

  if (!candlesticks.length) {
    return (
      <div className="flex h-[320px] w-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/60 text-sm text-muted-foreground sm:h-[340px] md:h-[380px] lg:h-[420px]">
        최근 한 달간의 캔들 데이터가 없습니다.
      </div>
    );
  }

  const showVolumeOverlay = hasVolumeData && volumes.length > 0;
  const volumeOverlayPosition = `${VOLUME_SECTION_TOP * 100}%`;
  const overlayAreaStyle = volumeOverlayBounds
    ? {
        top: `${volumeOverlayBounds.top}px`,
        height: `${volumeOverlayBounds.height}px`,
      }
    : { top: volumeOverlayPosition, bottom: 0 };
  const overlayDividerStyle = volumeOverlayBounds
    ? { top: `${volumeOverlayBounds.top}px` }
    : { top: volumeOverlayPosition };

  return (
    <div className="relative h-[320px] w-full overflow-hidden sm:h-[340px] md:h-[380px] lg:h-[420px]">
      <div ref={containerRef} className="absolute inset-0 z-[1]" />
      {showVolumeOverlay && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 z-0"
            style={overlayAreaStyle}
          >
            <div className="absolute inset-0 bg-slate-200/40 dark:bg-slate-900/25" />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-2 z-[2]"
            style={overlayDividerStyle}
          >
            <div className="h-px w-full bg-slate-300/80 dark:bg-slate-600/70" />
          </div>
        </>
      )}
    </div>
  );
}
