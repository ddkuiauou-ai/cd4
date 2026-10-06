"use client";

import { useEffect, useRef, useMemo } from "react";
import { useTheme } from "next-themes";
import { chartColorWithAlpha, readChartColors } from "./chart-theme";
import { createChart, ColorType, AreaSeries, type Time, type IChartApi, type ISeriesApi, type MouseEventParams } from "lightweight-charts";
import { PERData, PeriodType, aggregatePERDataByPeriod } from "@/lib/per-utils";

// 차트 설정 상수들
const CHART_CONFIG = {
    width: 0,
    height: 400,
    tooltip: {
        width: 96,
        height: 80,
        margin: -720,
    },
    series: {
        lineWidth: 2,
        scaleMargins: { top: 0.1, bottom: 0.1 },
    },
} as const;

interface ChartPEREnhancedProps {
    data: PERData[];
    period?: PeriodType;
    className?: string;
}

export default function ChartPEREnhanced({ data, period = '1M', className }: ChartPEREnhancedProps) {
    const { resolvedTheme } = useTheme();
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);

    // 데이터 메모이제이션으로 불필요한 재계산 방지
    const chartData = useMemo(() => {
        if (!data?.length) return [];

        const aggregatedData = aggregatePERDataByPeriod(data, period);
        return aggregatedData.map(item => ({
            time: (new Date(item.time).getTime() / 1000) as Time, // Convert to Unix timestamp in seconds and cast to Time
            value: item.value,
        }));
    }, [data, period]);

    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container || !chartData.length) return;

        // 기존 차트 정리
        if (chartRef.current) {
            try {
                chartRef.current.remove();
            } catch (error) {
                console.warn('Error removing chart:', error);
            }
            chartRef.current = null;
        }

        const colors = readChartColors();

        // 최적화된 차트 옵션
        const chart = createChart(container, {
            layout: {
                textColor: colors.foreground,
                background: { type: ColorType.Solid, color: colors.background },
            },
            width: container.clientWidth || CHART_CONFIG.width,
            height: CHART_CONFIG.height,
            grid: { vertLines: { visible: false }, horzLines: { visible: false } },
            rightPriceScale: { borderVisible: false },
            timeScale: { borderVisible: false },
            crosshair: {
                horzLine: { visible: false, labelVisible: false },
                vertLine: { labelVisible: false },
            },
        });

        // 시리즈 생성 및 설정
        const series = chart.addSeries(AreaSeries, {
            topColor: chartColorWithAlpha(colors.line, 0.2),
            bottomColor: chartColorWithAlpha(colors.line, 0.02),
            lineColor: colors.line,
            lineWidth: CHART_CONFIG.series.lineWidth,
            crosshairMarkerVisible: true,
        });

        seriesRef.current = series;

        series.priceScale().applyOptions({
            scaleMargins: CHART_CONFIG.series.scaleMargins,
        });

        // 데이터 설정
        series.setData(chartData);
        chart.timeScale().fitContent();

        // 툴팁 생성 (최적화된 스타일)
        const tooltip = document.createElement('div');
        Object.assign(tooltip.style, {
            width: `${CHART_CONFIG.tooltip.width}px`,
            height: `${CHART_CONFIG.tooltip.height}px`,
            position: 'absolute',
            display: 'none',
            padding: '8px',
            boxSizing: 'border-box',
            fontSize: '12px',
            textAlign: 'left',
            zIndex: '1000',
            pointerEvents: 'none',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgb(0 0 0 / 0.14)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            background: 'var(--popover)',
            color: 'var(--popover-foreground)',
        });

        container.appendChild(tooltip);
        tooltipRef.current = tooltip;

        // 최적화된 이벤트 핸들러
        const handleCrosshairMove = (param: MouseEventParams) => {
            const point = param.point;
            if (!point || point.x < 0 || point.x > container.clientWidth || point.y < 0 || point.y > container.clientHeight) {
                tooltip.style.display = 'none';
                return;
            }

            const seriesData = param.seriesData.get(series);
            if (!seriesData) {
                tooltip.style.display = 'none';
                return;
            }

            const price = "value" in seriesData ? seriesData.value : undefined;
            if (price == null) {
                tooltip.style.display = 'none';
                return;
            }

            // 툴팁 표시 및 내용 설정
            tooltip.style.display = 'block';
            const timeString = typeof param.time === 'number' ? new Date(param.time * 1000).toISOString().split('T')[0] : '';
            tooltip.innerHTML = `
                <div style="color: var(--chart-2); font-weight: 600; margin-bottom: 4px;">PER</div>
                <div style="font-size: 20px; margin: 4px 0px; color: var(--foreground); font-weight: 600;">
                    ${Math.round(price * 100) / 100}
                </div>
                <div style="color: var(--muted-foreground); font-size: 11px;">
                    ${timeString}
                </div>
            `;

            // 최적화된 위치 계산
            const coordinate = series.priceToCoordinate(price);
            if (coordinate === null) {
                tooltip.style.display = 'none';
                return;
            }

            const tooltipX = Math.max(0, Math.min(container.clientWidth - CHART_CONFIG.tooltip.width, point.x - 48));
            const tooltipY = Math.max(0, Math.min(container.clientHeight - CHART_CONFIG.tooltip.height, coordinate - CHART_CONFIG.tooltip.height - CHART_CONFIG.tooltip.margin));

            tooltip.style.left = `${tooltipX}px`;
            tooltip.style.top = `${tooltipY}px`;
        };

        chart.subscribeCrosshairMove(handleCrosshairMove);

        // 최적화된 리사이즈 핸들러 (throttle 적용)
        let resizeTimeout: NodeJS.Timeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (container) {
                    chart.applyOptions({ width: container.clientWidth });
                }
            }, 100);
        };

        window.addEventListener('resize', handleResize, { passive: true });

        // 정리 함수 최적화
        chartRef.current = chart;
        return () => {
            clearTimeout(resizeTimeout);
            window.removeEventListener('resize', handleResize);
            try {
                if (tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
                chart.unsubscribeCrosshairMove(handleCrosshairMove);
                chart.remove();
                chartRef.current = null;
                seriesRef.current = null;
                tooltipRef.current = null;
            } catch (error) {
                console.warn('Error cleaning up chart:', error);
            }
        };
    }, [chartData]);

    useEffect(() => {
        // Read after next-themes applies its root class in the parent effect.
        const frame = requestAnimationFrame(() => {
            const chart = chartRef.current;
            if (!chart) return;
            const colors = readChartColors();
            chart.applyOptions({
                layout: {
                    textColor: colors.foreground,
                    background: { type: ColorType.Solid, color: colors.background },
                },
                rightPriceScale: { borderColor: colors.border },
                timeScale: { borderColor: colors.border },
                crosshair: { vertLine: { color: colors.muted } },
            });
            seriesRef.current?.applyOptions({
                lineColor: colors.line,
                topColor: chartColorWithAlpha(colors.line, 0.2),
                bottomColor: chartColorWithAlpha(colors.line, 0.02),
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [resolvedTheme, chartData]);

    if (!chartData.length) {
        return (
            <div className="h-[400px] flex items-center justify-center border border-dashed border-muted-foreground/25 rounded-lg">
                <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">PER 차트 데이터 없음</p>
                    <p className="text-xs text-muted-foreground">표시할 데이터가 없습니다</p>
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            <div ref={chartContainerRef} className="relative w-full" />
        </div>
    );
}
