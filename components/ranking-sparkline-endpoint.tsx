"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { observeVisibleMotion } from "@/lib/observe-visible-motion";
import styles from "./ranking-view.module.css";

export function RankingSparklineEndpoint({ left, top, identity = "" }: { left: number; top: number; identity?: string }) {
  // Stable across server rendering, hydration and visits; no random values or timers.
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index++) hash = Math.imul(hash ^ identity.charCodeAt(index), 16777619) >>> 0;
  const style = { left: `${left}%`, top: `${top}%`, animationDelay: `-${hash % 1800}ms`,
    "--endpoint-angle": `${(hash >>> 16) % 30}deg` } as CSSProperties;
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) return observeVisibleMotion(ref.current);
  }, []);
  return <span ref={ref} className={styles.sparklineEndpoint} aria-hidden="true" style={style} />;
}
