'use client';

import { SiteDocumentLink as Link } from '@/components/site-document-link';
import { useSyncExternalStore, type ComponentProps } from 'react';
import { copyMarketcapChartRanges, marketcapPeriods } from './detail-chart-observations';
import styles from './detail-chart.module.css';

type RangeKey = 'capRange' | 'priceRange';
const rangeEvent = 'detail-chart-range-change';

function subscribe(onChange: () => void) {
  window.addEventListener(rangeEvent, onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    window.removeEventListener(rangeEvent, onChange);
    window.removeEventListener('popstate', onChange);
  };
}

export function useMarketcapChartRange(key: RangeKey, initial: string | undefined) {
  const fallback = key === 'capRange' ? '5Y' : '3M';
  const validate = (value: string | null | undefined) => marketcapPeriods.some(([id]) => id === value) ? value! : fallback;
  const period = useSyncExternalStore(subscribe, () => validate(new URLSearchParams(window.location.search).get(key)), () => validate(initial));
  function select(value: string) {
    const url = new URL(window.location.href);
    if (value === fallback) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    window.history.replaceState(window.history.state, '', url);
    window.dispatchEvent(new Event(rangeEvent));
  }
  return { period, select };
}

export function useMarketcapTargetHref(href: string | undefined, enabled: boolean) {
  return useSyncExternalStore(subscribe, () => {
    if (!href || !enabled) return href;
    const current = new URL(window.location.href);
    const target = new URL(href, current);
    copyMarketcapChartRanges(current, target);
    return target.pathname + target.search + target.hash;
  }, () => href);
}

export function MarketcapRangeLink({ href, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const destination = useMarketcapTargetHref(href, true);
  return <Link {...props} href={destination ?? href} />;
}

export function MarketcapRangeControls({ label, period, select }: { label: string; period: string; select: (value: string) => void }) {
  return <div className={styles.controls}>
    <span className={styles.choiceCaption} aria-hidden="true">기간</span>
    <div className={styles.choices} role="group" aria-label={label}>
      {marketcapPeriods.map(([id, text]) => <button key={id} type="button" aria-pressed={period === id} onClick={() => select(id)}>{text}</button>)}
    </div>
  </div>;
}
