"use client";

import { useEffect, useRef, useMemo } from "react";
import { createChart, ColorType, AreaSeries } from "lightweight-charts";
import { PERData, PeriodType, aggregatePERDataByPeriod } from "@/lib/per-utils";

// 차트 설정 상수들
const CHART_CONFIG = {
    width: 0,
    height: 400,
    colors: {
        primary: '#2962FF',
        background: 'white',
        text: 'black',
        border: '#2962FF',
        subText: '#666',
    },
    tooltip: {
        width: 96,
        height: 80,
        margin: 15,
    },
    series: {
        topColor: '#2962FF',
        bottomColor: 'rgba(41, 98, 255, 0.28)',
        lineColor: '#2962FF',
        lineWidth: 2,
        scaleMargins: { top: 0.3, bottom: 0.25 },
    },
} as const;

interface ChartPEREnhancedProps {
    data: PERData[];
    period?: PeriodType;
    className?: string;
}

export default function ChartPEREnhanced({ data, period = '1M', className }: ChartPEREnhancedProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<any>(null);
    const tooltipRef = useRef<HTMLDivElement | null>(null);

    // 데이터 메모이제이션으로 불필요한 재계산 방지
    const chartData = useMemo(() => {
        if (!data?.length) return [];

        const aggregatedData = aggregatePERDataByPeriod(data, period);
        return aggregatedData.map(item => ({
            time: item.time as any,
            value: item.value,
        }));
    }, [data, period]);

    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container || !chartData.length) return;

        // 기존 차트 정리
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
        }

        // 최적화된 차트 옵션
        const chart = createChart(container, {
            layout: {
                textColor: CHART_CONFIG.colors.text,
                background: { type: ColorType.Solid, color: CHART_CONFIG.colors.background },
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
            topColor: CHART_CONFIG.series.topColor,
            bottomColor: CHART_CONFIG.series.bottomColor,
            lineColor: CHART_CONFIG.series.lineColor,
            lineWidth: CHART_CONFIG.series.lineWidth,
            crosshairMarkerVisible: false,
        });

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
            border: `1px solid ${CHART_CONFIG.colors.border}`,
            borderRadius: '2px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            background: CHART_CONFIG.colors.background,
            color: CHART_CONFIG.colors.text,
        });

        container.appendChild(tooltip);
        tooltipRef.current = tooltip;

        // 최적화된 이벤트 핸들러
        const handleCrosshairMove = (param: any) => {
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

            const price = (seriesData as any).value;
            if (price == null) {
                tooltip.style.display = 'none';
                return;
            }

            // 툴팁 표시 및 내용 설정
            tooltip.style.display = 'block';
            tooltip.innerHTML = `
                <div style="color: ${CHART_CONFIG.colors.primary}; font-weight: 600; margin-bottom: 4px;">PER</div>
                <div style="font-size: 20px; margin: 4px 0px; color: ${CHART_CONFIG.colors.text}; font-weight: 600;">
                    ${Math.round(price * 100) / 100}
                </div>
                <div style="color: ${CHART_CONFIG.colors.subText}; font-size: 11px;">
                    ${String(param.time || '')}
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
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
            chart.remove();
        };
    }, [chartData]);

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
            <div ref={chartContainerRef} className="w-full" />
        </div>
    );
}
