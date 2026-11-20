'use client';

import { Suspense, useCallback, useState, type ReactNode } from 'react';

export function DetailChartPlaceholder() {
  return <div className="flex h-[280px] items-center justify-center border-y border-border text-sm text-muted-foreground sm:h-[320px]">차트 준비 중…</div>;
}

export function ChartWhenVisible({ children, fallback = <DetailChartPlaceholder /> }: { children: ReactNode; fallback?: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const observe = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    if (!window.IntersectionObserver) {
      setVisible(true);
      return;
    }
    const observer = new window.IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      setVisible(true);
    }, { rootMargin: '320px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div ref={observe} className="min-w-0">
    {visible ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
  </div>;
}
