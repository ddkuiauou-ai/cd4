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
    if (!containerRef.current) {
      return;
    }

    if (!formattedData.length) {
      chartRef.current?.remove();
      chartRef.current = null;
      return;
    }

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const computedStyle = getComputedStyle(document.documentElement);
    const foreground = computedStyle.getPropertyValue("--foreground").trim() || "#111827";
    const borderColor = computedStyle.getPropertyValue("--border").trim() || "rgba(148, 163, 184, 0.4)";

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

    const series = chart.addCandlestickSeries({
      upColor: "#D60000",
      downColor: "#0051C7",
      borderUpColor: "#B80000",
      borderDownColor: "#003C9D",
      wickUpColor: "#D60000",
      wickDownColor: "#0051C7",
    });

    series.setData(formattedData);
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });

    resizeObserver.observe(containerRef.current);

    chartRef.current = chart;

    return () => {
      resizeObserver.disconnect();
      chart.remove();
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
