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

interface ChartContext {
  chart: IChartApi;
  candlestickSeries: ReturnType<IChartApi["addCandlestickSeries"]>;
  volumeSeries: ReturnType<IChartApi["addHistogramSeries"]> | null;
  resizeObserver: ResizeObserver | null;
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

interface CandlestickChartProps {
  data: CandlestickPoint[];
}

export function CandlestickChart({ data }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartContextRef = useRef<ChartContext | null>(null);

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

    const upVolumeColor = "rgba(38, 166, 154, 0.8)";
    const downVolumeColor = "rgba(239, 83, 80, 0.8)";

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
      const normalizedVolume = normalizeVolumeValue(point.volume);

      if (!hasVolume && normalizedVolume !== null) {
        hasVolume = true;
      }

      return {
        time: point.time as Time,
        value: normalizedVolume ?? 0,
        color: close >= open ? upVolumeColor : downVolumeColor,
      };
    });

    return {
      candlesticks: candlestickPoints,
      volumes: volumePoints,
      hasVolumeData: hasVolume,
    };
  }, [data]);

  const disposeChart = () => {
    const context = chartContextRef.current;

    if (!context) {
      return;
    }

    context.resizeObserver?.disconnect();

    try {
      context.chart.remove();
    } catch (error) {
      if (error instanceof Error && error.name === "NotFoundError") {
        chartContextRef.current = null;
        return;
      }

      console.error("Failed to dispose lightweight chart:", error);
    }

    chartContextRef.current = null;
  };

  useEffect(() => {
    return () => {
      disposeChart();
    };
  }, []);

  useEffect(() => {
    if (!candlesticks.length) {
      disposeChart();
    }

    const container = containerRef.current;

    if (!container || !candlesticks.length) {
      return;
    }

    const requiresVolumePane = hasVolumeData;

    let context = chartContextRef.current;

    if (context) {
      const hasVolumeSeries = Boolean(context.volumeSeries);

      if (hasVolumeSeries !== requiresVolumePane) {
        disposeChart();
        context = chartContextRef.current;
      }
    }

    if (!context) {
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

      const panes = typeof chart.panes === "function" ? chart.panes() : [];
      const pricePane = panes[0];

      const candlestickOptions = {
        upColor: "#D60000",
        downColor: "#0051C7",
        borderUpColor: "#B80000",
        borderDownColor: "#003C9D",
        wickUpColor: "#D60000",
        wickDownColor: "#0051C7",
        priceFormat: { type: "price", precision: 0, minMove: 1 },
      } as const;

      let candlestickSeries: ReturnType<IChartApi["addCandlestickSeries"]> | null =
        null;

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

      let volumeSeries: ReturnType<IChartApi["addHistogramSeries"]> | null = null;

      if (requiresVolumePane) {
        const histogramOptions: Parameters<IChartApi["addHistogramSeries"]>[0] = {
          priceFormat: { type: "volume", precision: 0, minMove: 1 },
          priceLineVisible: false,
          lastValueVisible: false,
          baseLineVisible: false,
        };

        const canAddPane = typeof chart.addPane === "function";
        if (canAddPane) {
          try {
            const pane = chart.addPane();
            pane.setHeight(136);
            pane.setStretchFactor(0.32);
            pane.moveTo(1);

            if (typeof pane.addSeries === "function") {
              volumeSeries = pane.addSeries(
                HistogramSeries,
                histogramOptions
              ) as ReturnType<IChartApi["addHistogramSeries"]>;
            }
          } catch (error) {
            console.error(
              "Failed to add histogram series to dedicated volume pane:",
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
            scaleMargins: { top: 0.2, bottom: 0 },
            autoScale: true,
          });
        }
      }

      candlestickSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.15, bottom: volumeSeries ? 0.08 : 0.15 },
      });

      const resizeObserver =
        typeof ResizeObserver !== "undefined"
          ? new ResizeObserver((entries) => {
              const entry = entries[0];

              if (!entry) {
                return;
              }

              chart.applyOptions({
                width: entry.contentRect.width,
                height: entry.contentRect.height,
              });
            })
          : null;

      resizeObserver?.observe(container);

      context = {
        chart,
        candlestickSeries,
        volumeSeries,
        resizeObserver,
      } satisfies ChartContext;

      chartContextRef.current = context;
    }

    if (!context) {
      return;
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

    context.chart.applyOptions({
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
    });

    context.candlestickSeries.setData(candlesticks);

    if (context.volumeSeries) {
      if (hasVolumeData && volumes.length > 0) {
        context.volumeSeries.setData(volumes);
      } else {
        context.volumeSeries.setData([]);
      }
    }

    const firstVisibleTime = candlesticks[0]?.time;
    const lastVisibleTime = candlesticks[candlesticks.length - 1]?.time;

    if (firstVisibleTime && lastVisibleTime) {
      requestAnimationFrame(() => {
        const activeContext = chartContextRef.current;

        if (!activeContext || activeContext.chart !== context.chart) {
          return;
        }

        activeContext.chart.timeScale().setVisibleRange({
          from: firstVisibleTime as Time,
          to: lastVisibleTime as Time,
        });
      });
    } else {
      context.chart.timeScale().fitContent();
    }

    removeTradingViewAttribution();
  }, [candlesticks, hasVolumeData, volumes]);

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
