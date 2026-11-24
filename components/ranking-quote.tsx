"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { businessChartSegments, formatBusinessValue } from "@/lib/business-analysis";
import type { RankingRow } from "@/lib/ranking-view";
import { layoutRankingQuote } from "@/lib/ranking-quote-layout";
import { RankingRate } from "./ranking-row-parts";
import { RankingSparklineEndpoint } from "./ranking-sparkline-endpoint";
import styles from "./ranking-view.module.css";

export function RankingQuote({ row }: { row: RankingRow }) {
  const plotRef = useRef<HTMLSpanElement>(null);
  const model = useMemo(() => {
    const observations = row.prices.flatMap(price => price.date ? [{ date: price.date, value: price.close }] : []);
    // Normalize only the exact decimal helper's display coordinates, never raw prices.
    const segments = businessChartSegments(observations, 1_000_000, 1_000_000).map(segment =>
      segment.split(" ").map(pair => {
        const [x, y] = pair.split(",").map(Number);
        return { x: x / 1_000_000, y: y / 1_000_000 };
      }));
    return { segments, hasEndpoint: formatBusinessValue(observations.at(-1)?.value ?? null) !== "—" };
  }, [row.prices]);
  const [size, setSize] = useState({ width: 108, height: 44 });
  const layout = layoutRankingQuote({ ...model, ...size });

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    let frame = 0;
    let disposed = false;

    const measure = () => {
      frame = 0;
      if (disposed) return;
      const style = getComputedStyle(plot);
      const width = parseFloat(style.width);
      const height = parseFloat(style.height);
      if (!width || !height) return;
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(measure);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (observer) observer.observe(plot);
    else window.addEventListener("resize", schedule);
    schedule();

    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      else window.removeEventListener("resize", schedule);
    };
  }, []);

  const direction = row.rate == null || row.rate === 0 ? "flat" : row.rate > 0 ? "up" : "down";
  const price = row.close == null ? "가격 정보 없음" : `${formatBusinessValue(row.close)}원`;
  return <div className={styles.responsiveQuote}>
    <span className={styles.price}>{price}</span>
    <RankingRate row={row} />
    <span ref={plotRef} className={`${styles.quotePlot} ${styles.sparkline}`} data-direction={direction} role="img"
      aria-label={layout.segments.length ? `${row.name} 주가 추이` : "가격 추이 정보 없음"}>
      {layout.segments.length ? <>
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="none" aria-hidden="true">
          {layout.segments.map((segment, index) => <g key={index}>
            <polyline points={segment.map(point => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            {segment.length === 1 && <circle cx={segment[0].x} cy={segment[0].y} r={2} fill="currentColor" />}
          </g>)}
        </svg>
        {layout.endpoint && <RankingSparklineEndpoint identity={row.id} left={layout.endpoint.x / layout.width * 100} top={layout.endpoint.y / layout.height * 100} />}
      </> : <span className={styles.noTrend}>—</span>}
    </span>
  </div>;
}
