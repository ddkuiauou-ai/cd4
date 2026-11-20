"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageNavigation({ sections, offset, onNavigate, className }: {
    sections: Array<{ id: string; label: string; icon?: ReactNode }>; offset?: number; collapsible?: boolean; onNavigate?: () => void; className?: string;
}) {
    const [active, setActive] = useState(sections[0]?.id ?? null);
    useEffect(() => {
        let frame = 0;
        const header = document.querySelector<HTMLElement>('[data-site-header]');
        const detailHeader = document.querySelector<HTMLElement>('[data-detail-header]');
        const inlineOutline = document.querySelector<HTMLElement>('[data-detail-inline-outline]');
        const targets = sections.flatMap(({ id }) => {
            const element = document.getElementById(id);
            return element ? [element] : [];
        });
        const update = () => {
            frame = 0;
            const root = document.documentElement;
            const padding = parseFloat(window.getComputedStyle(root).scrollPaddingTop);
            const margin = targets[0] ? parseFloat(window.getComputedStyle(targets[0]).scrollMarginTop) : NaN;
            // Match the browser's fragment position after applying sticky padding and anchor margin.
            const anchorOffset = Number.isFinite(padding + margin) ? padding + margin
                : (header?.getBoundingClientRect().height ?? 64) + (detailHeader?.getBoundingClientRect().height ?? 0)
                    + (inlineOutline?.getBoundingClientRect().height ?? 0) + 24;
            const line = (offset ?? anchorOffset) + 2;
            const atEnd = Math.ceil(window.scrollY + window.innerHeight) >= root.scrollHeight;
            let current = sections[0]?.id ?? null;
            let clampedHash: string | null = null;
            let lastReached: string | null = null;
            for (const target of targets) {
                const position = target.getBoundingClientRect();
                if (position.top <= line) current = target.id;
                if (atEnd && position.top < window.innerHeight) {
                    lastReached = target.id;
                    if (position.top > line && window.location.hash === '#' + target.id) clampedHash = target.id;
                }
            }
            const next = clampedHash ?? (atEnd && window.scrollY > 0 ? lastReached : null) ?? current;
            setActive(previous => previous === next ? previous : next);
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
        update();
        const observer = new ResizeObserver(schedule);
        if (header) observer.observe(header);
        if (detailHeader) observer.observe(detailHeader);
        if (inlineOutline) observer.observe(inlineOutline);
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        window.addEventListener('hashchange', schedule);
        window.addEventListener('popstate', schedule);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            window.removeEventListener('hashchange', schedule);
            window.removeEventListener('popstate', schedule);
        };
    }, [sections, offset]);
    return <nav aria-label="페이지 목차" className={className ?? 'space-y-1'}>
        {sections.map(section => <a key={section.id} href={`#${section.id}`} onClick={onNavigate} aria-current={active === section.id ? 'location' : undefined}
            className={cn('block min-h-10 border-l py-2 pl-3 text-sm transition-colors',
                active === section.id ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {section.label}
        </a>)}
    </nav>;
}
