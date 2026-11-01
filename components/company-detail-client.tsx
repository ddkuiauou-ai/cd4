'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { companyPath } from '@/lib/entity-paths';
import { siteConfig } from '@/config/site';
import { DetailSurface, type DetailSearch, type DetailSurfaceProps } from './detail-surface';
import { CompanyTabNavigationContext } from './company-tab-navigation';

function CompanySearchObserver({ onChange }: { onChange: (search: DetailSearch) => void }) {
  const params = useSearchParams();
  const start = params.get('start') ?? undefined;
  const end = params.get('end') ?? undefined;
  useEffect(() => { onChange({ start, end }); }, [start, end, onChange]);
  return null;
}

const first = (value: DetailSearch[string]) => Array.isArray(value) ? value[0] : value;

/** Both routes use the same snapshot, so their shared header need not unmount. */
export function CompanyDetailClient(props: DetailSurfaceProps) {
  const pathname = usePathname().replace(/\/$/, '');
  const base = props.company ? companyPath(props.company) : null;
  const basic = pathname === base ? true : pathname === `${base}/marketcap` ? false : props.basic;
  const [search, setSearch] = useState(props.search);
  const onSearch = useCallback((next: DetailSearch) => setSearch(next), []);
  const navigate = useCallback((href: string) => {
    if (!base) return false;
    const destination = new URL(href, window.location.href);
    const nextPath = destination.pathname.replace(/\/$/, '');
    if (destination.origin !== window.location.origin || (nextPath !== base && nextPath !== `${base}/marketcap`)) return false;
    const currentPath = window.location.pathname.replace(/\/$/, '');
    if (nextPath !== currentPath || destination.search !== window.location.search) {
      // Next's native-history integration updates usePathname/useSearchParams and back/forward.
      window.history.pushState(null, '', destination.pathname + destination.search);
    }
    return true;
  }, [base]);
  const name = props.company?.companyKorName || props.company?.companyName || '기업';
  useEffect(() => {
    document.title = `${name} ${basic ? '기업 정보' : '기업 합산 시총'} - ${siteConfig.name}`;
    if (base) {
      const canonical = new URL(`${base}${basic ? '' : '/marketcap'}/`, siteConfig.url).href;
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', canonical);
      document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute('content', canonical);
    }
  }, [base, basic, name]);
  const sameRange = first(search.start) === first(props.search.start) && first(search.end) === first(props.search.end);

  return <CompanyTabNavigationContext.Provider value={navigate}>
    <Suspense fallback={null}><CompanySearchObserver onChange={onSearch} /></Suspense>
    <DetailSurface {...props} basic={basic} search={search} initialAnalysis={sameRange ? props.initialAnalysis : undefined} />
  </CompanyTabNavigationContext.Provider>;
}
