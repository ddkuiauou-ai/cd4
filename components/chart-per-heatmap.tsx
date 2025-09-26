'use client';

import { ResponsiveHeatMap } from '@nivo/heatmap';
import type { HeatMapSerie } from '@nivo/heatmap';
import { useState, useEffect } from 'react';

interface PERHeatmapProps {
  data: HeatMapSerie<{ x: string, y: number }, {}>[];
  minValue: number;
  maxValue: number;
}

export default function PERHeatmap({ data, minValue, maxValue }: PERHeatmapProps) {
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
          data={mobileData}
          margin={{ top: 30, right: 20, bottom: 30, left: 20 }}
          valueFormat=">-.1s"
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
          emptyColor="#555555"
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
              tickFormat: '>-.1s',
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
        data={data}
        margin={{ top: 60, right: 90, bottom: 60, left: 90 }}
        valueFormat=">-.2s"
        axisTop={{ tickRotation: -90 }}
        axisLeft={{ legend: '월', legendOffset: -72 }}
        colors={{
          type: 'diverging',
          scheme: 'red_yellow_blue',
          divergeAt: 0.5,
          minValue: maxValue,
          maxValue: minValue
        }}
        emptyColor="#555555"
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
            tickFormat: '>-.2s',
            title: 'PER →',
            titleAlign: 'start',
            titleOffset: 4
          }
        ]}
      />
    </div>
  );
}