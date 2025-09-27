"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, AreaSeries } from "lightweight-charts";
import { PERData, PeriodType, aggregatePERDataByPeriod } from "@/lib/per-utils";

interface ChartPEREnhancedProps {
    data: PERData[];
    period?: PeriodType;
    className?: string;
}

export default function ChartPEREnhanced({ data, period = '1M', className }: ChartPEREnhancedProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!chartContainerRef.current || !data || data.length === 0) return;

        // 차트 옵션 (참조 코드와 동일하게)
        const chartOptions = {
            layout: {
                textColor: 'black',
                background: { type: ColorType.Solid, color: 'white' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 400,
        };

        const chart = createChart(chartContainerRef.current, chartOptions);

        chart.applyOptions({
            crosshair: {
                horzLine: {
                    visible: false,
                    labelVisible: false,
                },
                vertLine: {
                    labelVisible: false,
                },
            },
            grid: {
                vertLines: {
                    visible: false,
                },
                horzLines: {
                    visible: false,
                },
            },
        });

        const series = chart.addSeries(AreaSeries, {
            topColor: '#2962FF',
            bottomColor: 'rgba(41, 98, 255, 0.28)',
            lineColor: '#2962FF',
            lineWidth: 2,
            crosshairMarkerVisible: false,
        });

        series.priceScale().applyOptions({
            scaleMargins: {
                top: 0.3,
                bottom: 0.25,
            },
        });

        // 데이터 설정 (참조 코드와 유사하게)
        const aggregatedData = aggregatePERDataByPeriod(data, period);
        const chartData = aggregatedData.map(item => ({
            time: new Date(item.time).getTime() / 1000 as any,
            value: Math.min(item.value),
        }));

        series.setData(chartData);

        // 툴팁 설정 (참조 코드와 동일하게)
        const container = chartContainerRef.current;
        const toolTipWidth = 80;
        const toolTipHeight = 80;
        const toolTipMargin = 15;

        const toolTip = document.createElement('div');
        toolTip.style.cssText = `width: 96px; height: 80px; position: absolute; display: none; padding: 8px; box-sizing: border-box; font-size: 12px; text-align: left; z-index: 1000; top: 12px; left: 12px; pointer-events: none; border: 1px solid; border-radius: 2px;font-family: -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;`;
        toolTip.style.background = 'white';
        toolTip.style.color = 'black';
        toolTip.style.borderColor = '#2962FF';
        container.appendChild(toolTip);

        // 툴팁 업데이트 (참조 코드와 동일하게)
        chart.subscribeCrosshairMove(param => {
            if (
                param.point === undefined ||
                !param.time ||
                param.point.x < 0 ||
                param.point.x > container.clientWidth ||
                param.point.y < 0 ||
                param.point.y > container.clientHeight
            ) {
                toolTip.style.display = 'none';
            } else {
                const dateStr = param.time;
                toolTip.style.display = 'block';
                const data = param.seriesData.get(series);
                const price = data ? (data as any).value : undefined;
                toolTip.innerHTML = `<div style="color: ${'#2962FF'}">PER</div><div style="font-size: 24px; margin: 4px 0px; color: ${'black'}">
                    ${Math.round(100 * price) / 100}
                </div><div style="color: ${'black'}">
                    ${dateStr}
                </div>`;

                const coordinate = series.priceToCoordinate(price);
                let shiftedCoordinate = param.point.x - 50;
                if (coordinate === null) {
                    return;
                }
                shiftedCoordinate = Math.max(
                    0,
                    Math.min(container.clientWidth - toolTipWidth, shiftedCoordinate)
                );
                const coordinateY =
                    coordinate - toolTipHeight - toolTipMargin > 0
                        ? coordinate - toolTipHeight - toolTipMargin
                        : Math.max(
                            0,
                            Math.min(
                                container.clientHeight - toolTipHeight - toolTipMargin,
                                coordinate + toolTipMargin
                            )
                        );
                toolTip.style.left = shiftedCoordinate + 'px';
                toolTip.style.top = coordinateY + 'px';
            }
        });

        chart.timeScale().fitContent();

        // 리사이즈 핸들러
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            if (toolTip.parentNode) {
                toolTip.parentNode.removeChild(toolTip);
            }
            chart.remove();
        };
    }, [data, period]);

    if (!data || data.length === 0) {
        return (
            <div className="h-[400px] flex items-center justify-center border border-dashed border-muted-foreground/25 rounded-lg">
                <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                        PER 차트 데이터 없음
                    </p>
                    <p className="text-xs text-muted-foreground">
                        표시할 데이터가 없습니다
                    </p>
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
