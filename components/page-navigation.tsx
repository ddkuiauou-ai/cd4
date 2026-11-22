"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PageSection = { id: string; label: string; icon?: ReactNode };

export function getReadingSection(targets: HTMLElement[], offset?: number) {
    const root = document.documentElement;
    const padding = parseFloat(window.getComputedStyle(root).scrollPaddingTop);
    const headerHeight = document.querySelector('[data-site-header]')?.getBoundingClientRect().height ?? 64;
    const detailHeight = document.querySelector('[data-detail-header]')?.getBoundingClientRect().height ?? 0;
    const atEnd = window.scrollY > 0 && Math.ceil(window.scrollY + window.innerHeight) >= root.scrollHeight;
    let current: string | null = null;
    let clampedHash: string | null = null;
    let lastReached: string | null = null;
    for (const target of targets) {
        // Match each fragment's actual margin and allow for a compacting sticky title and rounding.
        const anchorOffset = offset ?? padding + parseFloat(window.getComputedStyle(target).scrollMarginTop);
        const line = (Number.isFinite(anchorOffset) ? anchorOffset : headerHeight + detailHeight + 24) + 6;
        const { top } = target.getBoundingClientRect();
        if (top <= line) current = target.id;
        if (atEnd && top < window.innerHeight) {
            lastReached = target.id;
            if (top > line && window.location.hash === '#' + target.id) clampedHash = target.id;
        }
    }
    return clampedHash ?? lastReached ?? current;
}

export function PageNavigation({ sections, offset, onNavigate, className, currentIndicator, trackReading = true, readingMedia, label = '페이지 목차' }: {
    sections: PageSection[]; offset?: number; collapsible?: boolean; onNavigate?: () => void; className?: string;
    currentIndicator?: ReactNode; trackReading?: boolean; readingMedia?: string; label?: string;
}) {
    const [active, setActive] = useState(sections[0]?.id ?? null);
    useEffect(() => {
        if (!trackReading) return;
        const media = readingMedia ? window.matchMedia(readingMedia) : null;
        let frame = 0;
        const header = document.querySelector<HTMLElement>('[data-site-header]');
        const detailHeader = document.querySelector<HTMLElement>('[data-detail-header]');
        const targets = sections.flatMap(({ id }) => {
            const element = document.getElementById(id);
            return element ? [element] : [];
        });
        const update = () => {
            frame = 0;
            if (media?.matches === false) return;
            const next = getReadingSection(targets, offset) ?? sections[0]?.id ?? null;
            setActive(previous => previous === next ? previous : next);
        };
        const schedule = () => { if (!frame && media?.matches !== false) frame = requestAnimationFrame(update); };
        update();
        const observer = new ResizeObserver(schedule);
        if (header) observer.observe(header);
        if (detailHeader) observer.observe(detailHeader);
        for (const target of targets) observer.observe(target);
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        window.addEventListener('hashchange', schedule);
        window.addEventListener('popstate', schedule);
        media?.addEventListener('change', schedule);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            window.removeEventListener('hashchange', schedule);
            window.removeEventListener('popstate', schedule);
            media?.removeEventListener('change', schedule);
        };
    }, [sections, offset, trackReading, readingMedia]);
    return <nav aria-label={label} className={className ?? 'space-y-1'}>
        {sections.map(section => <a key={section.id} href={`#${section.id}`} onClick={event => {
            if (!event.defaultPrevented && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) onNavigate?.();
        }} aria-current={active === section.id ? 'location' : undefined}
            className={cn('block min-h-10 border-l py-2 pl-3 text-sm transition-colors',
                active === section.id ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {section.label}{active === section.id && currentIndicator}
        </a>)}
    </nav>;
}
