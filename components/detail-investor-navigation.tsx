'use client';

import Link from 'next/link';
import { Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCompanyTabNavigation } from './company-tab-navigation';
import { MarketcapComposition, type MarketcapCompositionModel } from './detail-marketcap-composition';
import { getReadingSection, PageNavigation } from './page-navigation';
import { RecentSecuritiesSidebar } from './recent-securities-sidebar';
import styles from './detail-investor-navigation.module.css';

export type DetailNavItem = { href: string; label: string; selected?: boolean; target?: string };
export type DetailSectionLink = { id: string; label: string };
export type DetailSwitchCandidate = {
  securityId: string;
  name: string;
  ticker?: string | null;
  type?: string | null;
  href?: string;
  value?: string | null;
  selected: boolean;
};
export type DetailRailFact = { label: string; value: string; date?: string; href?: string; direction?: 'up' | 'down' | 'flat' };

const metricGroupNames = ['', '', '투자 지표', '배당'];
const peerVisitKey = 'detail-peer-visit';
const peerReturnKey = 'detailPeerReturn';
const capSummarySelector = '[data-detail-cap-summary]';
const capMobileSelector = '[data-detail-cap-mobile]';
const railSwitchSelector = '[data-detail-peer-navigation]';
type SwitchSurface = 'summary' | 'mobile' | 'rail';
type PeerReturn = { source: string; scrollTop: number; focusSecurityId?: string; surface?: SwitchSurface };

function fragmentDestination(url: URL) {
  return url.pathname.replace(/\/$/, '') + url.search + url.hash;
}

function MetricLinks({ groups, onNavigate }: { groups: DetailNavItem[][]; onNavigate?: () => void }) {
  const navigateCompanyTab = useCompanyTabNavigation();
  const targetGroup = groups.find(group => group.some(item => item.target));

  return groups.map((group, index) => group.length > 0 && (
    <div key={group[0].href} className={styles.metricGroup}>
      {metricGroupNames[index] && <span className={styles.metricGroupName}>{metricGroupNames[index]}</span>}
      {group === targetGroup && <span className={styles.metricGroupTarget}>{group.find(item => item.target)?.target}</span>}
      {group.map(({ href, label, selected, target }) => (
        <Link key={href} href={href} prefetch={false} aria-current={selected ? 'page' : undefined}
          aria-label={target ? label + ' · ' + target : undefined}
          onNavigate={event => {
            onNavigate?.();
            if (!navigateCompanyTab?.(href)) return;
            event.preventDefault();
            if (!selected) window.scrollTo({ top: 0, behavior: 'instant' });
          }}>
          {label}
        </Link>
      ))}
    </div>
  ));
}

export function DetailInvestorNavigation({ groups, name, metricLabel }: { groups: DetailNavItem[][]; name: string; metricLabel: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [menuOpen]);

  return <div id="detail-metric-navigation" className={styles.metrics} tabIndex={-1}>
    <div className={styles.metricDesktop}>
      <p className={styles.metricOwner}>{name}</p>
      <nav aria-label="기업·종목 지표 이동"><MetricLinks groups={groups} /></nav>
    </div>
    <div className={styles.metricMobile} data-detail-metric-disclosure>
      <span className={styles.metricIdentity}><span>{name}</span><span aria-hidden="true">/</span>{metricLabel}</span>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogTrigger className={styles.metricTrigger}>지표 변경 <ChevronDown size={16} aria-hidden="true" /></DialogTrigger>
        <DialogContent showCloseButton={false} overlayClassName={styles.metricOverlay}
          className={styles.metricDialog} aria-describedby={undefined}>
          <div className={styles.dialogHeader}>
            <DialogTitle>{name} 지표</DialogTitle>
            <DialogClose className={styles.dialogClose} aria-label="지표 변경 닫기"><X size={20} aria-hidden="true" /></DialogClose>
          </div>
          <nav aria-label="기업·종목 지표 이동"><MetricLinks groups={groups} onNavigate={() => setMenuOpen(false)} /></nav>
        </DialogContent>
      </Dialog>
    </div>
  </div>;
}

export function DetailInvestorOutline({ sections, inline = false }: { sections: DetailSectionLink[]; inline?: boolean }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  if (!sections.length) return null;

  if (inline) return <details ref={disclosure} className={`investor-outline-inline ${styles.inlineOutline}`} data-detail-inline-outline>
    <summary>이 페이지에서 <ChevronDown size={16} aria-hidden="true" /></summary>
    <PageNavigation sections={sections} label="본문 목차" className={styles.outlineLinks} onNavigate={() => {
      if (disclosure.current) disclosure.current.open = false;
    }} />
  </details>;

  return <section className={styles.railOutline}>
    <h2>이 페이지에서</h2>
    <PageNavigation sections={sections} label="본문 목차" className={styles.outlineLinks} />
  </section>;
}

export function DetailSwitchLink({ candidate, children, className, sections, ariaLabel }: {
  candidate: DetailSwitchCandidate;
  children: ReactNode;
  className?: string;
  sections?: DetailSectionLink[];
  ariaLabel?: string;
}) {
  const { href, selected, securityId } = candidate;
  if (!href) return <span className={className} data-security-id={securityId}>{children}</span>;
  const current = selected ? 'page' : undefined;
  if (!sections) return <Link href={href} prefetch={false} className={className}
    data-security-id={securityId} aria-current={current} aria-label={ariaLabel}>{children}</Link>;

  function switchSecurity(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    const disclosure = event.currentTarget.closest<HTMLDetailsElement>(capMobileSelector);
    const keyboard = event.detail === 0;
    if (disclosure) {
      disclosure.open = false;
      if (keyboard) disclosure.querySelector('summary')?.focus({ preventScroll: true });
    }
    if (selected) return;
    const targets = sections?.flatMap(({ id }) => {
      const target = document.getElementById(id);
      return target ? [target] : [];
    }) ?? [];
    const section = getReadingSection(targets);
    const destination = new URL(event.currentTarget.href);
    const surface = disclosure ? 'mobile' : event.currentTarget.closest(capSummarySelector) ? 'summary' : 'rail';
    window.history.replaceState({ ...window.history.state, [peerReturnKey]: {
      source: fragmentDestination(new URL(window.location.href)), scrollTop: window.scrollY,
      focusSecurityId: keyboard ? securityId : undefined, surface,
    } satisfies PeerReturn }, '');
    if (section) {
      destination.hash = section;
      try {
        sessionStorage.setItem(peerVisitKey, JSON.stringify({
          destination: fragmentDestination(destination), keyboard, time: Date.now(),
        }));
      } catch { /* The real URL still carries its fragment when storage is unavailable. */ }
    }
    window.location.assign(destination.href);
  }

  return <a href={href} className={className} data-security-id={securityId} aria-current={current} aria-label={ariaLabel}
    onClick={switchSecurity}>{children}</a>;
}

export function DetailMarketcapSwitch({ model, sections }: {
  model: MarketcapCompositionModel;
  sections?: DetailSectionLink[];
}) {
  return <div data-detail-cap-summary={sections ? undefined : ''}>
    <MarketcapComposition model={model} compact={Boolean(sections)} renderTarget={(candidate, children, className) =>
      <DetailSwitchLink candidate={candidate} className={className} sections={sections ?? []}
        ariaLabel={[candidate.name, candidate.type, candidate.ticker].filter(Boolean).join(' · ') + ' 시가총액'}>
        {children}
      </DetailSwitchLink>
    } />
  </div>;
}

export function DetailMarketcapMobileSwitch({ model, sections }: { model: MarketcapCompositionModel; sections: DetailSectionLink[] }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const [shown, setShown] = useState(false);
  const targets = [...model.members.map(({ candidate }) => candidate), model.aggregate?.candidate];
  const chosen = targets.find(candidate => candidate?.selected);
  const canSwitch = targets.filter(candidate => candidate?.href).length > 1;

  useEffect(() => {
    const picker = disclosure.current;
    const summary = document.querySelector<HTMLElement>(capSummarySelector);
    const header = picker?.closest<HTMLElement>('[data-detail-header]');
    if (!picker || !summary || !header) return;
    const desktop = window.matchMedia('(min-width: 1280px)');
    let frame = 0;
    const update = () => {
      frame = 0;
      const next = !desktop.matches && summary.getBoundingClientRect().bottom <=
        header.getBoundingClientRect().bottom - picker.getBoundingClientRect().height;
      if (!next) picker.open = false;
      setShown(next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const dismiss = (event: PointerEvent) => {
      if (picker.open && event.target instanceof Node && !picker.contains(event.target)) picker.open = false;
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(header);
    resize.observe(summary);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('pointerdown', dismiss);
    desktop.addEventListener('change', schedule);
    update();
    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('pointerdown', dismiss);
      desktop.removeEventListener('change', schedule);
    };
  }, [canSwitch]);

  if (!canSwitch) return null;
  return <details ref={disclosure} className={styles.mobileCapSwitch} data-detail-cap-mobile hidden={!shown}
    onKeyDown={event => {
      if (event.key !== 'Escape' || !event.currentTarget.open) return;
      event.stopPropagation();
      event.currentTarget.open = false;
      event.currentTarget.querySelector('summary')?.focus({ preventScroll: true });
    }}
    onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    }}>
    <summary><span>시가총액 대상{chosen && <strong>{chosen.name}</strong>}</span><ChevronDown size={16} aria-hidden="true" /></summary>
    <nav className={styles.mobileCapPanel} aria-label="시가총액 대상">
      <DetailMarketcapSwitch model={model} sections={sections} />
    </nav>
  </details>;
}

export function DetailInvestorRail({ candidates, facts, sections, secCode, name, historyReady = true,
  candidateTitle = '종목 전환', preserveSections = true, composition }: {
  candidates: DetailSwitchCandidate[];
  facts: DetailRailFact[];
  sections: DetailSectionLink[];
  secCode: string;
  name?: string;
  historyReady?: boolean;
  candidateTitle?: string;
  preserveSections?: boolean;
  composition?: MarketcapCompositionModel;
}) {
  const switchHeading = useId();
  const destinations = candidates.filter(candidate => candidate.href);
  const capDestinations = composition
    ? composition.members.filter(({ candidate }) => candidate.href).length + Number(Boolean(composition.aggregate?.candidate.href)) : 0;
  useEffect(() => {
    if (!historyReady || !preserveSections || (!window.location.hash && !window.history.state?.[peerReturnKey])) return;
    const frame = requestAnimationFrame(() => {
      const current = new URL(window.location.href);
      const currentEntry = fragmentDestination(current);
      const historyState = window.history.state;
      const prior = historyState?.[peerReturnKey] as PeerReturn | undefined;
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;

      if (navigation?.type === 'back_forward' && prior?.source === currentEntry && Number.isFinite(prior.scrollTop)) {
        // A restored static document can grow when its records hydrate, after native scroll restoration.
        const restoredState = { ...historyState };
        delete restoredState[peerReturnKey];
        window.history.replaceState(restoredState, '');
        window.scrollTo({ top: prior.scrollTop, behavior: 'instant' });
        if (prior.focusSecurityId) {
          const source = prior.surface === 'summary' ? capSummarySelector : railSwitchSelector;
          const links = document.querySelectorAll<HTMLAnchorElement>(source + ' a[data-security-id]');
          const target = prior.surface === 'mobile' ? document.querySelector<HTMLElement>(capMobileSelector + ' summary')
            : Array.from(links).find(link => link.dataset.securityId === prior.focusSecurityId);
          if (prior.surface === 'mobile') requestAnimationFrame(() => target?.focus({ preventScroll: true }));
          else target?.focus({ preventScroll: true });
        }
        return;
      }

      if (!current.hash) return;
      let visit: { destination: string; keyboard: boolean; time: number } | null;
      try {
        visit = JSON.parse(sessionStorage.getItem(peerVisitKey) ?? 'null');
        if (visit?.destination !== currentEntry) return;
        sessionStorage.removeItem(peerVisitKey);
      } catch { return; }
      if (Date.now() - visit.time > 60_000) return;

      // Static data may finish loading after the browser's first fragment scroll.
      const section = sections.find(({ id }) => '#' + id === current.hash);
      const target = section && document.getElementById(section.id);
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        if (visit.keyboard) target.focus({ preventScroll: true });
      } else {
        // A sibling can lack a record such as a nearby ranking or a comparison.
        window.history.replaceState(window.history.state, '', current.pathname + current.search);
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (visit.keyboard) document.querySelector<HTMLElement>('#detail-metric-navigation')?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [historyReady, preserveSections, sections]);

  return <aside className={styles.rail} aria-label="상세 요약과 탐색" data-full-recent-rail>
    {composition ? capDestinations > 1 && <nav aria-labelledby={switchHeading} className={styles.switcher} data-detail-peer-navigation>
      <h2 id={switchHeading}>시가총액 대상</h2>
      <div className={styles.railCapSwitch}><DetailMarketcapSwitch model={composition} sections={sections} /></div>
    </nav> : destinations.length > 1 && <nav aria-labelledby={switchHeading} className={styles.switcher}
      data-detail-peer-navigation={preserveSections || undefined} data-detail-member-navigation={!preserveSections || undefined}>
      <h2 id={switchHeading}>{candidateTitle}</h2>
      <ul className={styles.switchList}>
        {destinations.map(candidate => <li key={candidate.securityId}>
          <DetailSwitchLink candidate={candidate} className={styles.switchLink} sections={preserveSections ? sections : undefined}>
            <span className={styles.switchIdentity}><strong>{candidate.name}</strong>
              <small>{[candidate.type, candidate.ticker].filter(Boolean).join(' · ')}</small>
            </span>
            <span className={styles.switchValue}>
              {candidate.selected && <Check size={15} aria-hidden="true" />}
              {candidate.value ?? '—'}
            </span>
          </DetailSwitchLink>
        </li>)}
      </ul>
    </nav>}
    <div className={styles.railRecords}>
      {facts.length > 0 && <section className={styles.facts}>
        <h2>{name ? name + ' 핵심 지표' : '핵심 지표'}</h2>
        <dl>{facts.map(({ label, value, date, href, direction }) => <div key={label}>
          <dt>{label}</dt><dd data-direction={direction}>
            {href ? <Link href={href} prefetch={false}>{value}</Link> : value}
            {date && <time dateTime={date}>{date}</time>}
          </dd>
        </div>)}</dl>
      </section>}
      <RecentSecuritiesSidebar currentSecCode={secCode} />
      <DetailInvestorOutline sections={sections} />
    </div>
  </aside>;
}
