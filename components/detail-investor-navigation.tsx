'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Info, List, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getMarketcapScopeColor } from '@/lib/chart-selection';
import { useCompanyTabNavigation } from './company-tab-navigation';
import { MarketcapComposition, type MarketcapCompositionModel } from './detail-marketcap-composition';
import { DetailRecordInfo } from './detail-record-info';
import { getReadingSection, PageNavigation } from './page-navigation';
import { RecentSecuritiesSidebar } from './recent-securities-sidebar';
import { useMarketcapTargetHref } from './marketcap-chart-range';
import type { DetailSecurityRow } from './detail-types';
import styles from './detail-investor-navigation.module.css';

export type DetailNavItem = { href?: string; label: string; selected?: boolean; target?: string };
export type DetailSectionLink = { id: string; label: string };
export type DetailSwitchCandidate = {
  securityId: string;
  name: string;
  ticker?: string | null;
  type?: string | null;
  href?: string;
  value?: string | null;
  dpsRanking?: DetailSecurityRow['dpsRanking'];
  selected: boolean;
};
export type DetailRailFact = { label: string; value: string; date?: string; href?: string; direction?: 'up' | 'down' | 'flat' };

const metricGroupNames = ['', '', '투자 지표', '배당'];
const unavailableMetricNote = '이 종목은 해당 지표를 제공하지 않아요';
const desktopMetricMedia = '(min-width: 768px)';
const rightRailMedia = '(min-width: 1280px)';
const marketcapUnderlineMotionMedia = `${rightRailMedia} and (prefers-reduced-motion: no-preference)`;
const tabletOutlineMedia = '(768px <= width < 1280px)';
const mobileOutlineMedia = '(width < 768px)';
const peerVisitKey = 'detail-peer-visit';
const peerReturnKey = 'detailPeerReturn';
const capSummarySelector = '[data-detail-cap-summary]';
const capTitleSelector = '[data-detail-cap-title]';
const railSwitchSelector = '[data-detail-peer-navigation]';
type SwitchSurface = 'summary' | 'header' | 'rail';
type PeerReturn = { source: string; scrollTop: number; focusSecurityId?: string; surface?: SwitchSurface };
let pendingPeerReturn: string | undefined;
let departingCapEntry: string | undefined;
let pendingMarketcapUnderline: { target: string; x: number; y: number; time: number } | undefined;

function fragmentDestination(url: URL) {
  return url.pathname.replace(/\/$/, '') + url.search + url.hash;
}

function MetricLinks({ groups, onNavigate }: { groups: DetailNavItem[][]; onNavigate?: () => void }) {
  const navigateCompanyTab = useCompanyTabNavigation();
  const targetGroup = groups.find(group => group.some(item => item.target));

  return groups.map((group, index) => group.length > 0 && (
    <div key={group[0].label} className={styles.metricGroup}>
      {metricGroupNames[index] && <span className={styles.metricGroupName}>{metricGroupNames[index]}</span>}
      {group === targetGroup && <span className={styles.metricGroupTarget}>{group.find(item => item.target)?.target}</span>}
      {group.map(({ href, label, selected, target }) => {
        const accessibleLabel = target ? label + ' · ' + target : undefined;
        const current = selected ? 'page' : undefined;
        if (!href) return <DetailRecordInfo key={label} asChild dismissOnDialogTap label={accessibleLabel ?? label} text={unavailableMetricNote}>
          <span className={styles.metricItem} role="link" aria-disabled="true" aria-current={current}>
            {label}<Info className={styles.metricHelpIcon} size={14} strokeWidth={1.5} aria-hidden="true" />
          </span>
        </DetailRecordInfo>;
        return <Link key={label} className={styles.metricItem} href={href} prefetch={false} aria-current={current}
          aria-label={accessibleLabel} onNavigate={event => {
            onNavigate?.();
            if (!navigateCompanyTab?.(href)) return;
            event.preventDefault();
            if (!selected) window.scrollTo({ top: 0, behavior: 'instant' });
          }}>{label}</Link>;
      })}
    </div>
  ));
}

export function DetailInvestorNavigation({ groups, name, sections = [] }: {
  groups: DetailNavItem[][]; name: string; sections?: DetailSectionLink[];
}) {
  return <div id="detail-metric-navigation" className={styles.metrics} tabIndex={-1}>
    <p className={styles.metricOwner}>{name}</p>
    <nav aria-label="기업·종목 지표 이동"><MetricLinks groups={groups} /></nav>
    <DetailInvestorOutline sections={sections} placement="left" />
  </div>;
}

export function DetailMetricMenu({ groups, name, metricLabel }: { groups: DetailNavItem[][]; name: string; metricLabel: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const desktop = window.matchMedia(desktopMetricMedia);
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [menuOpen]);

  return <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
    <DialogTrigger className={styles.metricTrigger} data-detail-metric-disclosure
      aria-label={'지표 변경, 현재 ' + metricLabel}>{metricLabel}<ChevronDown size={16} aria-hidden="true" /></DialogTrigger>
    <DialogContent showCloseButton={false} overlayClassName={styles.metricOverlay}
      className={styles.metricDialog} aria-describedby={undefined} onCloseAutoFocus={event => {
        if (!window.matchMedia(desktopMetricMedia).matches) return;
        event.preventDefault();
        document.getElementById('detail-metric-navigation')?.focus({ preventScroll: true });
      }}>
      <div className={styles.dialogHeader}>
        <DialogTitle>{name} 지표</DialogTitle>
        <DialogClose className={styles.dialogClose} aria-label="지표 변경 닫기"><X size={20} aria-hidden="true" /></DialogClose>
      </div>
      <nav aria-label="기업·종목 지표 이동"><MetricLinks groups={groups} onNavigate={() => setMenuOpen(false)} /></nav>
    </DialogContent>
  </Dialog>;
}

export function DetailInvestorOutline({ sections, placement = 'right' }: {
  sections: DetailSectionLink[]; placement?: 'inline' | 'left' | 'right';
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  if (!sections.length) return null;

  if (placement === 'inline') return <details ref={disclosure} className={`investor-outline-inline ${styles.inlineOutline}`} data-detail-inline-outline>
    <summary>이 페이지에서 <ChevronDown size={16} aria-hidden="true" /></summary>
    <PageNavigation sections={sections} label="본문 목차" className={styles.outlineLinks} readingMedia={mobileOutlineMedia} onNavigate={() => {
      if (disclosure.current) disclosure.current.open = false;
    }} />
  </details>;

  const left = placement === 'left';
  return <section className={left ? `${styles.railOutline} ${styles.leftOutline}` : styles.railOutline} data-detail-side-outline={placement}>
    <h2>이 페이지에서</h2>
    <PageNavigation sections={sections} label="본문 목차" className={styles.outlineLinks} readingMedia={left ? tabletOutlineMedia : rightRailMedia} />
  </section>;
}

export function DetailHeaderOutline({ sections }: { sections: DetailSectionLink[] }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const [menuState, setMenuState] = useState<'initial' | 'open' | 'closed'>('initial');
  const open = menuState === 'open';

  useEffect(() => {
    const picker = disclosure.current;
    const header = picker?.closest<HTMLElement>('[data-detail-header]');
    const inline = header?.parentElement?.querySelector<HTMLDetailsElement>('[data-detail-inline-outline]');
    if (!picker || !header || !inline) return;

    const desktop = window.matchMedia(desktopMetricMedia);
    let frame = 0;
    const update = () => {
      frame = 0;
      // Keep the inline disclosure in the flow so the handoff does not move its own threshold.
      const shown = !desktop.matches && inline.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom;
      if (shown === header.hasAttribute('data-outline-promoted')) return;

      const transferFocus = (shown ? inline : picker).contains(document.activeElement);
      if (!shown) picker.open = false;
      header.toggleAttribute('data-outline-promoted', shown);
      inline.inert = shown;
      if (transferFocus) {
        const target = desktop.matches
          ? [...(header.closest('[data-detail-route]')?.querySelectorAll<HTMLElement>('[data-detail-side-outline] [aria-current="location"]') ?? [])]
            .find(link => link.offsetWidth > 0)
          : (shown ? picker : inline).querySelector('summary');
        target?.focus({ preventScroll: true });
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resize = new ResizeObserver(schedule);
    resize.observe(header);
    resize.observe(inline);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('hashchange', schedule);
    window.addEventListener('pageshow', schedule);
    desktop.addEventListener('change', schedule);
    schedule();
    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame);
      header.removeAttribute('data-outline-promoted');
      inline.inert = false;
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('hashchange', schedule);
      window.removeEventListener('pageshow', schedule);
      desktop.removeEventListener('change', schedule);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      const picker = disclosure.current;
      if (picker && event.target instanceof Node && !picker.contains(event.target)) picker.open = false;
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  return <details ref={disclosure} className={styles.headerOutline} data-detail-header-outline
    onToggle={event => setMenuState(event.currentTarget.open ? 'open' : 'closed')}
    onKeyDown={event => {
      if (event.key !== 'Escape' || !event.currentTarget.open) return;
      event.stopPropagation();
      event.currentTarget.open = false;
      event.currentTarget.querySelector('summary')?.focus({ preventScroll: true });
    }}
    onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    }}>
    <summary><span className={styles.outlineIcon} aria-hidden="true">
      <List size={16} className={styles.outlineListIcon} /><X size={16} className={styles.outlineCloseIcon} />
    </span>목차</summary>
    {menuState !== 'initial' && <div className={styles.headerOutlinePanel} inert={!open}>
      <p>이 페이지에서</p>
      <PageNavigation sections={sections} label="본문 목차" className={styles.outlineLinks} trackReading={open}
        currentIndicator={<Check size={14} className={styles.outlineCheck} aria-hidden="true" />} onNavigate={() => {
        if (disclosure.current) disclosure.current.open = false;
      }} />
    </div>}
  </details>;
}

export function DetailSwitchLink({ candidate, children, className, sections, ariaLabel, onSwitch }: {
  candidate: DetailSwitchCandidate;
  children: ReactNode;
  className?: string;
  sections?: DetailSectionLink[];
  ariaLabel?: string;
  onSwitch?: (link: HTMLAnchorElement) => void;
}) {
  const { selected, securityId } = candidate;
  const marketcap = Boolean(candidate.href && /\/marketcap\/?(?:[?#]|$)/.test(candidate.href) && sections);
  const href = useMarketcapTargetHref(candidate.href, marketcap);
  const router = useRouter();
  if (!href) return <span className={className} data-security-id={securityId}>{children}</span>;
  const current = selected ? 'page' : undefined;
  if (!sections) return <Link href={href} prefetch={false} className={className}
    data-security-id={securityId} aria-current={current} aria-label={ariaLabel}>{children}</Link>;

  function switchSecurity(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    const disclosure = event.currentTarget.closest<HTMLDetailsElement>(capTitleSelector);
    const keyboard = event.detail === 0;
    if (disclosure) {
      disclosure.open = false;
      if (keyboard) disclosure.querySelector('summary')?.focus({ preventScroll: true });
    }
    if (selected) return;
    onSwitch?.(event.currentTarget);
    const targets = sections?.flatMap(({ id }) => {
      const target = document.getElementById(id);
      return target ? [target] : [];
    }) ?? [];
    const section = getReadingSection(targets);
    const destination = new URL(event.currentTarget.href);
    const surface = disclosure ? 'header' : event.currentTarget.closest(capSummarySelector) ? 'summary' : 'rail';
    const source = fragmentDestination(new URL(window.location.href));
    if (marketcap) departingCapEntry = source;
    window.history.replaceState({ ...window.history.state, [peerReturnKey]: {
      source, scrollTop: window.scrollY,
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
    if (marketcap) router.push(destination.pathname + destination.search + destination.hash, { scroll: !section });
    else window.location.assign(destination.href);
  }

  return <a href={href} className={className} data-security-id={securityId} aria-current={current} aria-label={ariaLabel}
    onClick={switchSecurity}>{children}</a>;
}

export function DetailMarketcapSwitch({ model, sections, breakdown, selectedDetail, rankHref }: {
  model: MarketcapCompositionModel;
  sections?: DetailSectionLink[];
  breakdown?: ReactNode;
  selectedDetail?: ReactNode;
  rankHref?: string;
}) {
  return <div data-detail-cap-summary={sections ? undefined : ''}>
    <MarketcapComposition model={model} compact={Boolean(sections)} breakdown={breakdown} selectedDetail={selectedDetail}
      rankHref={rankHref} renderTarget={(candidate, children, className) =>
      <DetailSwitchLink candidate={candidate} className={className} sections={sections ?? []}
        ariaLabel={[candidate.name, candidate.type, candidate.ticker].filter(Boolean).join(' · ') + ' 시가총액'}>
        {children}
      </DetailSwitchLink>
    } />
  </div>;
}

function hasMultipleMarketcapSecurities({ members }: MarketcapCompositionModel) {
  return members.filter(({ candidate }) => candidate.href).length > 1;
}

function MarketcapTargetDisclosure({ label, caption, children }: {
  label: string;
  caption: ReactNode;
  children: ReactNode;
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const picker = disclosure.current;
    if (!picker) return;
    const desktop = window.matchMedia(rightRailMedia);
    const close = () => { picker.open = false; };
    const dismiss = (event: PointerEvent) => {
      if (picker.open && event.target instanceof Node && !picker.contains(event.target)) close();
    };
    document.addEventListener('pointerdown', dismiss);
    desktop.addEventListener('change', close);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      desktop.removeEventListener('change', close);
    };
  }, []);

  return <details ref={disclosure} className={styles.titleCapSwitch} data-detail-cap-title
    onKeyDown={event => {
      if (event.key !== 'Escape' || !event.currentTarget.open) return;
      event.stopPropagation();
      event.currentTarget.open = false;
      event.currentTarget.querySelector('summary')?.focus({ preventScroll: true });
    }}
    onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    }}>
    <summary aria-label={label}>{caption}<ChevronDown size={14} aria-hidden="true" /></summary>
    {children}
  </details>;
}

export function DetailMarketcapTitleSwitch({ model, sections, seriesType }: {
  model: MarketcapCompositionModel;
  sections: DetailSectionLink[];
  seriesType?: string | null;
}) {
  const aggregate = model.aggregate?.candidate.selected;
  const chosen = aggregate ? model.aggregate?.candidate : model.members.find(({ candidate }) => candidate.selected)?.candidate;

  if (!chosen || !hasMultipleMarketcapSecurities(model)) return null;
  const shortLabel = aggregate ? '합산' : chosen.ticker || chosen.type || chosen.name;
  const shareType = !aggregate && chosen.ticker ? chosen.type : null;
  const accessibleLabel = aggregate ? '기업 합산' : [shortLabel, shareType].filter(Boolean).join(' ');
  const caption = <>
    <span className={styles.titleCapLine} style={{ backgroundColor: getMarketcapScopeColor(seriesType) }} aria-hidden="true" />
    <strong>{shortLabel}</strong>
    {shareType && <span className={styles.titleCapType}>· {shareType}</span>}
  </>;
  return <>
    <span className={styles.titleCapStatus} data-detail-cap-status>
      <span className="sr-only">현재 시가총액 대상 </span>{caption}
    </span>
    <MarketcapTargetDisclosure label={'시가총액 대상, 현재 ' + accessibleLabel} caption={caption}>
      <nav className={styles.titleCapPanel} aria-label="시가총액 대상">
        <DetailMarketcapSwitch model={model} sections={sections} />
      </nav>
    </MarketcapTargetDisclosure>
  </>;
}

function rememberMarketcapUnderline(link: HTMLAnchorElement) {
  pendingMarketcapUnderline = undefined;
  const target = link.dataset.securityId;
  const nav = link.closest(railSwitchSelector);
  if (!target || !nav || !window.matchMedia(marketcapUnderlineMotionMedia).matches) return;
  const current = nav.querySelector('[aria-current="page"] [data-marketcap-tab-line]')?.getBoundingClientRect();
  if (!current) return;
  const bounds = nav.getBoundingClientRect();
  // The route can remount the rail. Relative coordinates stay valid as the page scrolls.
  pendingMarketcapUnderline = { target, x: current.left - bounds.left, y: current.top - bounds.top, time: Date.now() };
}

function DetailMarketcapRailSwitch({ model, sections, seriesType }: {
  model: MarketcapCompositionModel;
  sections: DetailSectionLink[];
  seriesType?: string | null;
}) {
  const rail = useRef<HTMLElement>(null);
  const aggregate = model.aggregate?.candidate;
  const candidates = [aggregate, ...model.members.map(({ candidate }) => candidate)];
  const targets = candidates.flatMap(candidate => candidate?.href ? [candidate] : []);
  const selectedId = targets.find(candidate => candidate.selected)?.securityId;

  useLayoutEffect(() => {
    const transition = pendingMarketcapUnderline;
    if (!transition || transition.target !== selectedId) return;
    pendingMarketcapUnderline = undefined;
    const nav = rail.current;
    if (!nav || Date.now() - transition.time > 15_000 || !window.matchMedia(marketcapUnderlineMotionMedia).matches) return;
    const line = nav.querySelector<HTMLElement>('a[aria-current="page"] [data-marketcap-tab-line]');
    if (!line?.animate) return;
    const bounds = nav.getBoundingClientRect();
    const destination = line.getBoundingClientRect();
    const x = transition.x - (destination.left - bounds.left);
    const y = transition.y - (destination.top - bounds.top);
    const animation = line.animate([
      { transform: `translate(${x}px, ${y}px)` },
      { transform: 'translate(0, 0)' },
    ], { duration: 180, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    return () => animation.cancel();
  }, [selectedId]);

  return <nav ref={rail} className={styles.railCapTargets} aria-label="시가총액 대상" data-detail-peer-navigation
    style={{ '--marketcap-selection-color': getMarketcapScopeColor(seriesType) } as CSSProperties}>
    <ul>{targets.map(candidate => {
      const total = candidate === aggregate;
      const repeatedType = targets.some(peer => peer !== candidate && peer.type === candidate.type);
      const label = total ? '기업 합산' : candidate.type && !repeatedType ? candidate.type : candidate.ticker || candidate.name;
      return <li key={candidate.securityId}>
        <DetailSwitchLink candidate={candidate} sections={sections} className={styles.railCapOption}
          onSwitch={rememberMarketcapUnderline}
          ariaLabel={total ? '기업 합산 시가총액' : [candidate.name, candidate.type, candidate.ticker, '시가총액'].filter(Boolean).join(' · ')}>
          <span className={styles.titleCapLine} aria-hidden="true" data-marketcap-tab-line />
          <strong>{label}</strong>
          <span className={styles.railCapCheck} aria-hidden="true">{candidate.selected && <Check size={10} />}</span>
        </DetailSwitchLink>
      </li>;
    })}</ul>
  </nav>;
}

export function DetailInvestorRail({ candidates, facts, sections, secCode, name, route, basis, historyReady = true,
  candidateTitle = '종목 전환', preserveSections = true, composition, selectedSeriesType }: {
  candidates: DetailSwitchCandidate[];
  facts: DetailRailFact[];
  sections: DetailSectionLink[];
  secCode: string;
  name?: string;
  route?: string;
  basis?: string | null;
  historyReady?: boolean;
  candidateTitle?: string;
  preserveSections?: boolean;
  composition?: MarketcapCompositionModel;
  selectedSeriesType?: string | null;
}) {
  const switchHeading = useId();
  const destinations = candidates.filter(candidate => candidate.href);
  useEffect(() => {
    if (!preserveSections) return;
    let frame = 0;
    const restore = () => {
      const current = new URL(window.location.href);
      if (!historyReady || route && current.pathname.replace(/\/$/, '') !== route) return;
      const currentEntry = fragmentDestination(current);
      // App Router can mount the restored rail after the popstate event.
      if (departingCapEntry !== currentEntry) departingCapEntry = undefined;
      const historyState = window.history.state;
      const prior = historyState?.[peerReturnKey] as PeerReturn | undefined;
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const returning = route ? !departingCapEntry : pendingPeerReturn === currentEntry || navigation?.type === 'back_forward';

      if (returning && prior?.source === currentEntry && Number.isFinite(prior.scrollTop)) {
        pendingPeerReturn = undefined;
        // A restored static document can grow when its records hydrate, after native scroll restoration.
        const restoredState = { ...historyState };
        delete restoredState[peerReturnKey];
        window.history.replaceState(restoredState, '');
        window.scrollTo({ top: prior.scrollTop, behavior: 'instant' });
        if (prior.focusSecurityId) {
          const source = prior.surface === 'summary' ? capSummarySelector : railSwitchSelector;
          const links = document.querySelectorAll<HTMLAnchorElement>(source + ' a[data-security-id]');
          const picker = prior.surface !== 'summary' && route && !window.matchMedia(rightRailMedia).matches
            ? document.querySelector<HTMLElement>(capTitleSelector + ' > summary') : null;
          const target = picker ?? Array.from(links).find(link => link.dataset.securityId === prior.focusSecurityId);
          target?.focus({ preventScroll: true });
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
        if (visit.keyboard) {
          const selector = window.matchMedia(desktopMetricMedia).matches ? '#detail-metric-navigation' : '[data-detail-metric-disclosure]';
          document.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
        }
      }
    };
    const onPopState = (event: PopStateEvent) => {
      pendingPeerReturn = event.state?.[peerReturnKey]?.source;
      if (frame) cancelAnimationFrame(frame);
      if (historyReady && (pendingPeerReturn || window.location.hash)) frame = requestAnimationFrame(restore);
    };
    if (historyReady && (departingCapEntry || window.history.state?.[peerReturnKey] || window.location.hash)) frame = requestAnimationFrame(restore);
    window.addEventListener('popstate', onPopState);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('popstate', onPopState);
    };
  }, [historyReady, preserveSections, route, sections]);

  const switchModel = composition && hasMultipleMarketcapSecurities(composition) ? composition : null;
  const keyMetrics = (facts.length > 0 || switchModel) && <section className={styles.facts}>
    <h2>{name ? name + ' 핵심 지표' : '핵심 지표'}</h2>
    {switchModel && <DetailMarketcapRailSwitch model={switchModel} sections={sections} seriesType={selectedSeriesType} />}
    {facts.length > 0 && <dl>{facts.map(({ label, value, date, href, direction }) => <div key={label}>
      <dt>{label}</dt><dd data-direction={direction}>
        {href ? <Link href={href} prefetch={false}>{value}</Link> : value}
        {date && <time dateTime={date}>{date}</time>}
      </dd>
    </div>)}</dl>}
  </section>;

  return <aside className={styles.rail} aria-label="상세 요약과 탐색">
    {!composition && destinations.length > 1 && <nav aria-labelledby={switchHeading} className={styles.switcher}
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
              {candidate.dpsRanking && <small className={styles.switchRank}>
                <span className="sr-only">주당배당금 순위 </span>{candidate.dpsRanking.rank.toLocaleString('ko-KR')}위
                {candidate.dpsRanking.date && candidate.dpsRanking.date !== basis && <time dateTime={candidate.dpsRanking.date}>{candidate.dpsRanking.date}</time>}
              </small>}
              {candidate.value ?? '—'}
            </span>
          </DetailSwitchLink>
        </li>)}
      </ul>
    </nav>}
    {switchModel && keyMetrics}
    <div className={styles.railRecords}>
      {!switchModel && keyMetrics}
      <RecentSecuritiesSidebar currentSecCode={secCode} variant="preview" />
      <DetailInvestorOutline sections={sections} />
    </div>
  </aside>;
}
