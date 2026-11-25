'use client';

import { Suspense, useCallback, useState, type ReactNode } from 'react';
import { PendingChart } from './record-loading';

export function DetailChartPlaceholder() {
  return <div className="flex h-[280px] items-center justify-center border-y border-border text-sm text-muted-foreground sm:h-[320px]">차트 준비 중…</div>;
}

export function ChartWhenVisible({ children, fallback = <DetailChartPlaceholder />, onApproach, loadingLabel }: {
  children: ReactNode; fallback?: ReactNode; onApproach?: () => void; loadingLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  const observe = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    if (!window.IntersectionObserver) {
      onApproach?.();
      setVisible(true);
      return;
    }
    const observer = new window.IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      onApproach?.();
      setVisible(true);
    }, { rootMargin: '320px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onApproach]);

  return <div ref={observe} className="min-w-0">
    {visible ? <Suspense fallback={loadingLabel ? <PendingChart label={loadingLabel}>{fallback}</PendingChart> : fallback}>
      {children}
    </Suspense> : fallback}
  </div>;
}
