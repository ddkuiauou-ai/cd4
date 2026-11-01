"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { businessChartSegments, formatBusinessValue } from "@/lib/business-analysis";
import type { RankingRow } from "@/lib/ranking-view";
import { layoutRankingQuote } from "@/lib/ranking-quote-layout";
import { RankingRate } from "./ranking-row-parts";
import { RankingSparklineEndpoint } from "./ranking-sparkline-endpoint";
import styles from "./ranking-view.module.css";

export function RankingQuote({ row }: { row: RankingRow }) {
  const root = useRef<HTMLDivElement>(null);
  const model = useMemo(() => {
    const observations = row.prices.flatMap(price => price.date ? [{ date: price.date, value: price.close }] : []);
    // Normalize only the exact decimal helper's display coordinates, never raw prices.
    const segments = businessChartSegments(observations, 1_000_000, 1_000_000).map(segment =>
      segment.split(" ").map(pair => { const [x, y] = pair.split(",").map(Number); return { x: x / 1_000_000, y: y / 1_000_000 }; }));
    return { segments, hasEndpoint: formatBusinessValue(observations.at(-1)?.value ?? null) !== "—",
      description: `${row.name} 가격 관측 ${observations[0]?.date}–${observations.at(-1)?.date}. 결측 구간은 연결하지 않습니다.` };
  }, [row.prices, row.name]);
  const initial = useMemo(() => layoutRankingQuote({ ...model, width: 108, height: 44,
    price: { width: 0, height: 18 }, rate: { width: 0, height: 16 }, overlay: false }), [model]);
  const [measured, setMeasured] = useState<{ model: typeof model; width: number; layout: typeof initial } | null>(null);
  const current = measured?.model === model ? measured : null;
  const layout = current?.layout ?? initial;

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let frame = 0, disposed = false;
    const price = element.querySelector<HTMLElement>(`.${styles.price}`)!;
    const rate = element.querySelector<HTMLElement>(`.${styles.rate}`)!;
    const plot = element.querySelector<HTMLElement>(`.${styles.quotePlot}`)!;
    const measure = () => {
      frame = 0;
      if (disposed) return;
      const css = getComputedStyle(element), overlay = css.getPropertyValue("--quote-mode").trim() === "overlay";
      const width = parseFloat(getComputedStyle(plot).width), height = parseFloat(getComputedStyle(plot).height);
      if (!width || !height) return;
      const scale = element.getBoundingClientRect().width / parseFloat(css.width) || 1;
      const size = (label: HTMLElement) => { const rect = label.getBoundingClientRect(); return { width: rect.width / scale, height: rect.height / scale }; };
      const next = layoutRankingQuote({ ...model, width, height: overlay ? 88 : height, price: size(price), rate: size(rate), overlay });
      setMeasured(previous => previous?.model === model && previous.width === width && JSON.stringify(previous.layout) === JSON.stringify(next)
        ? previous : { model, width, layout: next });
    };
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(measure); };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    [element, plot, price, rate].forEach(target => observer?.observe(target));
    window.addEventListener("resize", schedule);
    document.fonts?.ready.then(schedule);
    schedule();
    return () => { disposed = true; observer?.disconnect(); window.removeEventListener("resize", schedule); if (frame) cancelAnimationFrame(frame); };
  }, [model]);

  const direction = row.rate == null || row.rate === 0 ? "flat" : row.rate > 0 ? "up" : "down";
  const price = row.close == null ? "가격 정보 없음" : `${formatBusinessValue(row.close)}원`;
  const style = current ? { "--quote-height": `${layout.height}px`, "--price-left": `${layout.priceLeft}px`, "--rate-left": `${layout.rateLeft}px` } as CSSProperties : undefined;
  return <div ref={root} className={styles.responsiveQuote} data-measured={current ? "true" : undefined} data-placement={layout.placement} style={style}>
    <span className={styles.price} title={row.priceDate ? `가격 관측일 ${row.priceDate}` : undefined} aria-label={`종가 ${price}`}>{price}</span>
    <span className={`${styles.quotePlot} ${styles.sparkline}`} data-direction={direction} role="img" aria-label={model.segments.length ? model.description : "가격 추이 정보 없음"}>
      {model.segments.length ? <>
        <svg viewBox={`0 0 ${current?.width ?? 108} ${layout.height}`} preserveAspectRatio="none" aria-hidden="true">
          {layout.segments.map((segment, index) => <g key={index}>
            <polyline points={segment.map(point => `${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            {segment.length === 1 && <circle cx={segment[0].x} cy={segment[0].y} r={2} fill="currentColor" />}
          </g>)}
        </svg>
        {layout.endpoint && <RankingSparklineEndpoint identity={row.id} left={layout.endpoint.x / (current?.width ?? 108) * 100} top={layout.endpoint.y / layout.height * 100} />}
      </> : <span className={styles.noTrend}>—</span>}
    </span>
    <RankingRate row={row} />
  </div>;
}
