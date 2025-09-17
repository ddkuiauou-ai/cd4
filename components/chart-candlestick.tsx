"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CandlestickData, IChartApi } from "lightweight-charts";
import { ColorType, CrosshairMode, createChart } from "lightweight-charts";

interface CandlestickPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
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

export function CandlestickChart({ data }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const formattedData = useMemo<CandlestickData[]>(() => {
    return data
      .filter((point) =>
        point.open !== null &&
        point.high !== null &&
        point.low !== null &&
        point.close !== null &&
        Number.isFinite(point.open) &&
        Number.isFinite(point.high) &&
        Number.isFinite(point.low) &&
        Number.isFinite(point.close)
      )
      .map((point) => ({
        time: point.time,
        open: Number(point.open),
        high: Number(point.high),
        low: Number(point.low),
        close: Number(point.close),
      }));
  }, [data]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    if (!formattedData.length) {
      chartRef.current?.remove();
      chartRef.current = null;
      return;
    }

    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;

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
        timeScale: { borderColor, timeVisible: true, secondsVisible: false },
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

      series.setData(formattedData);
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
    };

    void setupChart();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chartRef.current?.remove();

      chartRef.current = null;
    };
  }, [formattedData]);

  if (!formattedData.length) {
    return (
      <div className="flex h-[260px] w-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-background/60 text-sm text-muted-foreground">
        최근 한 달간의 캔들 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[260px] w-full sm:h-[280px] md:h-[320px] lg:h-[340px]"
    />
  );
}
