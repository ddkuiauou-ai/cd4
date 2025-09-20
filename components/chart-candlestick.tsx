"use client";

import { useEffect, useMemo, useRef } from "react";
import type {
  BusinessDay,
  CandlestickData,
  HistogramData,
  IChartApi,
  Time,
} from "lightweight-charts";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
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
      const candidate = new Date(businessDay.year, businessDay.month - 1, businessDay.day);
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

export function CandlestickChart({ data }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const { candlesticks, volumes, area, hasVolumeData } = useMemo(() => {
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

    const upVolumeColor = "rgba(214, 0, 0, 0.55)";
    const downVolumeColor = "rgba(0, 81, 199, 0.55)";

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

    const areaPoints = candlestickPoints.map((point) => ({
      time: point.time as Time,
      value: point.close,
    }));

    return {
      candlesticks: candlestickPoints,
      volumes: volumePoints,
      area: areaPoints,
      hasVolumeData: hasVolume,
    };
  }, [data]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (!candlesticks.length) {
      chartRef.current?.remove();
      chartRef.current = null;
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;

    const setupChart = () => {
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
          panes: {
            separatorColor: "rgba(214, 0, 0, 0.35)",
            separatorHoverColor: "rgba(214, 0, 0, 0.55)",
            enableResize: false,
          },
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

      const panes = typeof chart.panes === "function" ? chart.panes() : [];
      const pricePane = panes[0];
      const canAddPane = typeof chart.addPane === "function";
      const volumePane = canAddPane ? chart.addPane() : null;

      if (volumePane) {
        volumePane.setHeight(136);
        volumePane.setStretchFactor(0.32);
        volumePane.moveTo(1);
      }

      const candlestickOptions = {
        upColor: "#D60000",
        downColor: "#0051C7",
        borderUpColor: "#B80000",
        borderDownColor: "#003C9D",
        wickUpColor: "#D60000",
        wickDownColor: "#0051C7",
        priceFormat: { type: "price", precision: 0, minMove: 1 },
      } as const;

      const areaOptions = {
        lineColor: "#D60000",
        topColor: "rgba(214, 0, 0, 0.25)",
        bottomColor: "rgba(214, 0, 0, 0.04)",
        lineWidth: 2,
        priceFormat: { type: "price", precision: 0, minMove: 1 },
      } as const;

      let areaSeriesInstance: ReturnType<IChartApi["addAreaSeries"]> | null = null;
      let candlestickSeries: ReturnType<IChartApi["addCandlestickSeries"]> | null = null;
      let volumeSeries: ReturnType<IChartApi["addHistogramSeries"]> | null = null;

      if (pricePane && typeof pricePane.addSeries === "function") {
        try {
          areaSeriesInstance = pricePane.addSeries(
            AreaSeries,
            areaOptions
          ) as ReturnType<IChartApi["addAreaSeries"]>;
        } catch (error) {
          console.error("Failed to add area series to price pane:", error);
        }
      }

      if (!areaSeriesInstance && typeof chart.addAreaSeries === "function") {
        areaSeriesInstance = chart.addAreaSeries(areaOptions);
      }

      if (pricePane && typeof pricePane.addSeries === "function") {
        try {
          candlestickSeries = pricePane.addSeries(
            CandlestickSeries,
            candlestickOptions
          ) as ReturnType<IChartApi["addCandlestickSeries"]>;
        } catch (error) {
          console.error(
            "Failed to add candlestick series to price pane:",
            error
          );
        }
      }

      if (!candlestickSeries) {
        if (typeof chart.addCandlestickSeries === "function") {
          candlestickSeries = chart.addCandlestickSeries(candlestickOptions);
        } else {
          const chartWithSeries = chart as unknown as {
            addSeries?: (
              ctor: unknown,
              options: typeof candlestickOptions
            ) => ReturnType<IChartApi["addCandlestickSeries"]>;
          };

          if (typeof chartWithSeries.addSeries === "function") {
            try {
              candlestickSeries = chartWithSeries.addSeries(
                CandlestickSeries,
                candlestickOptions
              ) as ReturnType<IChartApi["addCandlestickSeries"]>;
            } catch (error) {
              console.error(
                "Failed to dynamically add candlestick series:",
                error
              );
            }
          }
        }
      }

      if (!candlestickSeries) {
        console.error(
          "Unable to create candlestick series with the current lightweight-charts build."
        );
        chart.remove();
        return;
      }

      const hasVolumeSeries = hasVolumeData && volumes.length > 0;

      candlestickSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.15, bottom: hasVolumeSeries ? 0.08 : 0.15 },
      });

      if (areaSeriesInstance) {
        areaSeriesInstance.priceScale().applyOptions({
          scaleMargins: { top: 0.2, bottom: hasVolumeSeries ? 0.12 : 0.2 },
        });
      }

      if (hasVolumeSeries) {
        const histogramOptions: Parameters<IChartApi["addHistogramSeries"]>[0] = {
          priceFormat: { type: "volume", precision: 0, minMove: 1 },
          priceLineVisible: false,
          lastValueVisible: false,
          baseLineVisible: false,
        };

        if (volumePane && typeof volumePane.addSeries === "function") {
          try {
            volumeSeries = volumePane.addSeries(
              HistogramSeries,
              histogramOptions
            ) as ReturnType<IChartApi["addHistogramSeries"]>;
          } catch (error) {
            console.error(
              "Failed to add histogram series to volume pane:",
              error
            );
          }
        }

        if (!volumeSeries) {
          if (typeof chart.addHistogramSeries === "function") {
            volumeSeries = chart.addHistogramSeries({
              ...histogramOptions,
              priceScaleId: "volume",
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
                volumeSeries = chartWithSeries.addSeries(
                  HistogramSeries,
                  {
                    ...histogramOptions,
                    priceScaleId: "volume",
                  }
                ) as ReturnType<IChartApi["addHistogramSeries"]>;
              } catch (error) {
                console.error(
                  "Failed to dynamically add histogram series:",
                  error
                );
              }
            }
          }
        }

        if (volumeSeries) {
          volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.15, bottom: 0 },
            autoScale: true,
          });

          volumeSeries.setData(volumes);
        } else {
          console.error(
            "Unable to create volume histogram series with the current lightweight-charts build."
          );
        }
      }

      if (areaSeriesInstance) {
        areaSeriesInstance.setData(area);
      }

      candlestickSeries.setData(candlesticks);
      chart.timeScale().fitContent();

      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || disposed) {
          return;
        }

        chart.applyOptions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      });

      if (!containerRef.current || disposed) {
        resizeObserver.disconnect();
        chart.remove();
        return;
      }

      resizeObserver.observe(containerRef.current);
      chartRef.current = chart;

      removeTradingViewAttribution();
    };

    setupChart();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [area, candlesticks, hasVolumeData, volumes]);

  if (!candlesticks.length) {
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
