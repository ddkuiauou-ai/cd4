"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./ranking-view.module.css";

const endpoints = new Map<HTMLElement, boolean>();
let observer: IntersectionObserver | null = null;

function updateMotion(element: HTMLElement, inView: boolean) {
  element.dataset.animate = String(inView && document.visibilityState === "visible");
}

function updateDocumentVisibility() {
  for (const [element, inView] of endpoints) updateMotion(element, inView);
}

function observeEndpoint(element: HTMLElement) {
  if (typeof IntersectionObserver === "undefined") return;
  if (!observer) {
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const target = entry.target as HTMLElement;
        if (!endpoints.has(target)) continue;
        const inView = entry.isIntersecting && entry.intersectionRatio > 0;
        endpoints.set(target, inView);
        updateMotion(target, inView);
      }
    }, { threshold: 0.01 });
    document.addEventListener("visibilitychange", updateDocumentVisibility);
  }
  endpoints.set(element, false);
  updateMotion(element, false);
  observer.observe(element);
  return () => {
    observer?.unobserve(element);
    endpoints.delete(element);
    element.removeAttribute("data-animate");
    if (!endpoints.size) {
      observer?.disconnect();
      observer = null;
      document.removeEventListener("visibilitychange", updateDocumentVisibility);
    }
  };
}

export function RankingSparklineEndpoint({ left, top, identity = "" }: { left: number; top: number; identity?: string }) {
  // Stable across server rendering, hydration and visits; no random values or timers.
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index++) hash = Math.imul(hash ^ identity.charCodeAt(index), 16777619) >>> 0;
  const style = { left: `${left}%`, top: `${top}%`, animationDelay: `-${hash % 1800}ms`,
    "--endpoint-angle": `${(hash >>> 16) % 30}deg` } as CSSProperties;
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (ref.current) return observeEndpoint(ref.current);
  }, []);
  return <span ref={ref} className={styles.sparklineEndpoint} aria-hidden="true" style={style} />;
}
