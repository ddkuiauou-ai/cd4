'use client';

import { useEffect, useState } from 'react';
import { RecordLoading } from './record-loading';
import styles from './document-navigation-feedback.module.css';

/** Native document navigations leave the current ranking visible while the next HTML arrives. */
export function DocumentNavigationFeedback() {
  const [label, setLabel] = useState('');
  useEffect(() => {
    function show(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[data-document-link]') : null;
      if (!link || link.hasAttribute('download') || link.target && link.target !== '_self') return;
      if (link.pathname.startsWith('/security/')) setLabel('종목 상세를 여는 중');
      else if (link.pathname.startsWith('/company/')) setLabel('기업 상세를 여는 중');
      else if (link.pathname === '/dashboard/') setLabel('대회장을 여는 중');
      else setLabel('순위 페이지를 여는 중');
    }
    const clear = () => setLabel('');
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') clear(); };
    document.addEventListener('click', show);
    window.addEventListener('pageshow', clear);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', show);
      window.removeEventListener('pageshow', clear);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);
  return label && <div className={styles.navigation}><RecordLoading label={label} /></div>;
}
