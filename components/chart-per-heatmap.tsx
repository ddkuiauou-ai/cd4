'use client';

import { ResponsiveHeatMap } from '@nivo/heatmap';
import type { HeatMapSerie } from '@nivo/heatmap';
import { useState, useEffect } from 'react';
import { heatmapLabelColor, heatmapTheme } from './chart-theme';
import {formatBusinessValue,formatCompactBusinessValue,type BusinessValue} from '@/lib/business-analysis';

interface PERHeatmapProps {
  data: HeatMapSerie<{ x: string, y: number }, object>[];
  minValue: number;
  maxValue: number;
  valueFormatter?: (value:number)=>string;
  sourceValues?: Record<string,BusinessValue>;
}

export default function PERHeatmap({ data, minValue, maxValue, valueFormatter, sourceValues }: PERHeatmapProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    // Mobile: Show all years but with horizontal scrolling
    const mobileData = data;

    return (
      <div style={{ height: '200px' }}>
        <ResponsiveHeatMap
          theme={heatmapTheme}
          labelTextColor={heatmapLabelColor}
          borderColor="transparent"
          label={cell => sourceValues ? formatCompactBusinessValue(sourceValues[`${cell.serieId}/${cell.data.x}`] ?? null) : cell.formattedValue || ''}
          tooltip={sourceValues ? ({cell}) => <div className="rounded-md border border-border bg-popover p-3 text-sm shadow-md">{cell.data.x}년 {cell.serieId} · {formatBusinessValue(sourceValues[`${cell.serieId}/${cell.data.x}`] ?? null)}</div> : undefined}
          data={mobileData}
          margin={{ top: 30, right: 20, bottom: 30, left: 20 }}
          valueFormat={valueFormatter || ">-.1s"}
          axisTop={{
            tickRotation: -90,
            tickSize: 0,
            tickPadding: 5
          }}
          axisLeft={{
            tickSize: 0
          }}
          colors={{
            type: 'diverging',
            scheme: 'red_yellow_blue',
            divergeAt: 0.5,
            minValue: maxValue,
            maxValue: minValue
          }}
          emptyColor="transparent"
          legends={[
            {
              anchor: 'bottom',
              translateX: 0,
              translateY: 15,
              length: 120,
              thickness: 3,
              direction: 'row',
              tickPosition: 'after',
              tickSize: 2,
              tickSpacing: 1,
              tickOverlap: false,
              tickFormat: valueFormatter || '>-.1s',
              title: 'PER',
              titleAlign: 'start',
              titleOffset: 4
            }
          ]}
        />
      </div>
    );
  }

  // Desktop: Full version
  return (
    <div style={{ height: '400px' }}>
      <ResponsiveHeatMap
          theme={heatmapTheme}
          labelTextColor={heatmapLabelColor}
          borderColor="transparent"
          label={cell => sourceValues ? formatCompactBusinessValue(sourceValues[`${cell.serieId}/${cell.data.x}`] ?? null) : cell.formattedValue || ''}
          tooltip={sourceValues ? ({cell}) => <div className="rounded-md border border-border bg-popover p-3 text-sm shadow-md">{cell.data.x}년 {cell.serieId} · {formatBusinessValue(sourceValues[`${cell.serieId}/${cell.data.x}`] ?? null)}</div> : undefined}
        data={data}
        margin={{ top: 60, right: 90, bottom: 60, left: 90 }}
        valueFormat={valueFormatter || ">-.2s"}
        axisTop={{ tickRotation: -90 }}
        axisLeft={{ legend: '월', legendOffset: -72 }}
        colors={{
          type: 'diverging',
          scheme: 'red_yellow_blue',
          divergeAt: 0.5,
          minValue: maxValue,
          maxValue: minValue
        }}
        emptyColor="transparent"
        legends={[
          {
            anchor: 'bottom',
            translateX: 0,
            translateY: 30,
            length: 400,
            thickness: 8,
            direction: 'row',
            tickPosition: 'after',
            tickSize: 3,
            tickSpacing: 4,
            tickOverlap: false,
            tickFormat: valueFormatter || '>-.2s',
            title: 'PER →',
            titleAlign: 'start',
            titleOffset: 4
          }
        ]}
      />
    </div>
  );
}