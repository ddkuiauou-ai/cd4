"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageNavigation({ sections, offset }: {
    sections: Array<{ id: string; label: string; icon?: ReactNode }>; offset?: number; collapsible?: boolean;
}) {
    const [active, setActive] = useState(sections[0]?.id ?? null);
    useEffect(() => {
        let frame = 0;
        const update = () => {
            frame = 0;
            const header = document.querySelector<HTMLElement>('[data-site-header]');
            const detailHeader = document.querySelector<HTMLElement>('[data-detail-header]');
            const measuredOffset = offset ?? (header?.getBoundingClientRect().height ?? 64) + (detailHeader?.getBoundingClientRect().height ?? 0) + 16;
            let current = sections[0]?.id ?? null;
            for (const section of sections) {
                const target = document.getElementById(section.id);
                if (target && target.getBoundingClientRect().top <= measuredOffset + 4) current = section.id;
            }
            setActive(previous => previous === current ? previous : current);
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
        update();
        const observer = new ResizeObserver(schedule);
        const header = document.querySelector<HTMLElement>('[data-site-header]');
        const detailHeader = document.querySelector<HTMLElement>('[data-detail-header]');
        if (header) observer.observe(header);
        if (detailHeader) observer.observe(detailHeader);
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        return () => {
            observer.disconnect(); cancelAnimationFrame(frame);
            window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
        };
    }, [sections, offset]);
    return <nav aria-label="페이지 목차" className="space-y-1">
        {sections.map(section => <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? 'location' : undefined}
            className={cn('block min-h-10 border-l py-2 pl-3 text-sm transition-colors',
                active === section.id ? 'border-primary font-semibold text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {section.label}
        </a>)}
    </nav>;
}
