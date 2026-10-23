'use client';

import { ResponsiveHeatMap } from '@nivo/heatmap';
import type { HeatMapSerie } from '@nivo/heatmap';
import { useState, useEffect } from 'react';
import { heatmapLabelColor, heatmapTheme } from './chart-theme';
import { formatBusinessValue, formatCompactBusinessValue, type BusinessValue } from '@/lib/business-analysis';

interface DPSHeatmapProps {
  data: HeatMapSerie<{ x: string, y: number }, object>[];
  minValue: number;
  maxValue: number;
  valueFormatter?: (value: number) => string;
  sourceValues?: Record<string, BusinessValue>;
}

const readableTheme = {
  ...heatmapTheme,
  text: { ...heatmapTheme.text, fontSize: 13 },
  axis: {
    ...heatmapTheme.axis,
    ticks: { text: { ...heatmapTheme.axis.ticks.text, fontSize: 13 } },
  },
  labels: { text: { fontSize: 13 } },
};

export default function DPSHeatmap({ data, minValue, maxValue, valueFormatter, sourceValues }: DPSHeatmapProps) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const yearCount = new Set(data.flatMap(month => month.data.map(cell => String(cell.x)))).size;
  const minChartWidth = Math.max(280, yearCount * 64 + 80);
  const chartHeight = Math.max(240, data.length * 28 + 104);
  const formatValue = valueFormatter || (isMobile ? '>-.1s' : '>-.2s');

  return <div className="min-w-0 max-w-full">
    {yearCount > 4 && <p className="mb-2 text-sm text-muted-foreground">좌우로 이동해 모든 연도의 기록을 확인하세요.</p>}
    <div className="max-w-full overflow-x-auto" role="region" aria-label="DPS 월별 기록 전체 연도" tabIndex={0}>
      <div style={{ height: chartHeight, minWidth: minChartWidth }}>
        <ResponsiveHeatMap
          theme={readableTheme}
          labelTextColor={heatmapLabelColor}
          borderColor="transparent"
          label={cell => sourceValues ? formatCompactBusinessValue(sourceValues[`${cell.serieId}/${cell.data.x}`] ?? null) : cell.formattedValue || ''}
          tooltip={sourceValues ? ({ cell }) => <div className="max-w-[calc(100vw-48px)] rounded-md border border-border bg-popover p-3 text-sm shadow-md">{cell.data.x}년 {cell.serieId} · {formatBusinessValue(sourceValues[`${cell.serieId}/${cell.data.x}`] ?? null)}원</div> : undefined}
          data={data}
          margin={{ top: 40, right: 20, bottom: 64, left: 48 }}
          valueFormat={formatValue}
          axisTop={{ tickRotation: 0, tickSize: 0, tickPadding: 8 }}
          axisLeft={{ tickSize: 0, tickPadding: 8 }}
          colors={{ type: 'diverging', scheme: 'red_yellow_blue', divergeAt: 0.5, minValue: isMobile ? maxValue : minValue, maxValue: isMobile ? minValue : maxValue }}
          emptyColor="transparent"
          legends={[{
            anchor: 'bottom', translateX: 0, translateY: 28,
            length: Math.min(400, minChartWidth - 80), thickness: 8,
            direction: 'row', tickPosition: 'after', tickSize: 3,
            tickSpacing: 4, tickOverlap: false, tickFormat: formatValue,
            title: 'DPS (원)', titleAlign: 'start', titleOffset: 4,
          }]}
        />
      </div>
    </div>
  </div>;
}
