'use client';

import Link from 'next/link';
import { ArrowUp } from 'lucide-react';
import { useCompanyTabNavigation } from './company-tab-navigation';
import { PageNavigation } from './page-navigation';

export type DetailNavItem = { href: string; label: string; selected?: boolean; target?: string };
export type DetailSectionLink = { id: string; label: string };

export function DetailInvestorNavigation({ groups }: { groups: DetailNavItem[][] }) {
  const navigateCompanyTab = useCompanyTabNavigation();
  const targetGroup = groups.find(group => group.some(item => item.target));
  return <nav id="detail-metric-navigation" tabIndex={-1} className="investor-navigation" aria-label="기업·종목 지표 이동">
    {groups.filter(group => group.length).map(group => (
      <div key={group[0].label} className="investor-nav-group">
        {group === targetGroup && <span className="investor-nav-scope">{group.find(item => item.target)?.target}</span>}
        {group.map(({ href, label, selected, target }) => (
          <Link key={href} href={href} prefetch={false} aria-current={selected ? 'page' : undefined}
            aria-label={target ? label + ' · ' + target : undefined}
            onNavigate={navigateCompanyTab ? event => {
              if (!navigateCompanyTab(href)) return;
              event.preventDefault();
              if (!selected) window.scrollTo({ top: 0, behavior: 'instant' });
            } : undefined}>
            {label}
          </Link>
        ))}
      </div>
    ))}
  </nav>;
}

export function DetailInvestorOutline({ sections, inline = false }: { sections: DetailSectionLink[]; inline?: boolean }) {
  if (!sections.length) return null;
  return <div className={inline ? 'investor-outline investor-outline-inline' : 'investor-outline'} data-detail-inline-outline={inline || undefined}>
    {inline && <a href="#detail-metric-navigation" className="investor-outline-top" aria-label="지표 이동으로 돌아가기">
      <ArrowUp aria-hidden="true" size={16} /> 지표
    </a>}
    <PageNavigation sections={sections} className="investor-outline-links" />
  </div>;
}
