"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
import CompanyLogo from '@/components/CompanyLogo';
import { useMobileHeader } from '@/components/mobile-header-context';
import { COMPANY_HEADER_PIN_EVENT } from '@/components/share-events';
import { cn } from '@/lib/utils';

interface StickyCompanyHeaderProps {
    displayName: string;
    companyName?: string | null;
    logoUrl?: string | null;
    stickyOffset?: number;
    titleSuffix?: string | null;
    titleBadge?: string | null;
    detail?: { label?: string | null; value?: string | null; badge?: string | null } | null;
    actions?: ReactNode;
    onPinChange?: (pinned: boolean) => void;
}

export function StickyCompanyHeader({ displayName, companyName, logoUrl, stickyOffset = 80,
    titleSuffix = '시가총액', titleBadge, detail, actions, onPinChange }: StickyCompanyHeaderProps) {
    const sentinel = useRef<HTMLDivElement>(null);
    const bar = useRef<HTMLDivElement>(null);
    const [pinned, setPinned] = useState(false);
    const [offset, setOffset] = useState(stickyOffset);
    const { setContent } = useMobileHeader();

    useEffect(() => {
        const header = document.querySelector<HTMLElement>('[data-site-header]');
        if (!header) return;
        const measure = () => setOffset(Math.round(header.getBoundingClientRect().height));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(header);
        return () => observer.disconnect();
    }, []);
    useEffect(() => {
        const node = sentinel.current;
        if (!node) return;
        const update = () => setPinned(node.getBoundingClientRect().top <= offset);
        update();
        const observer = new IntersectionObserver(update, { rootMargin: `-${offset}px 0px 0px 0px` });
        observer.observe(node);
        window.addEventListener('scroll', update, { passive: true });
        return () => { observer.disconnect(); window.removeEventListener('scroll', update); };
    }, [offset]);
    useEffect(() => {
        const node = bar.current;
        if (!node) return;
        const measure = () => {
            const height = node.getBoundingClientRect().height;
            document.documentElement.style.setProperty('--detail-header-height', `${height}px`);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => { observer.disconnect(); document.documentElement.style.removeProperty('--detail-header-height'); };
    }, []);
    useEffect(() => {
        onPinChange?.(pinned);
        setContent(pinned ? { type: 'company', displayName, companyName, logoUrl, titleSuffix, titleBadge, detail } : null);
        window.dispatchEvent(new CustomEvent(COMPANY_HEADER_PIN_EVENT, { detail: { pinned, offset } }));
    }, [pinned, offset, onPinChange, setContent, displayName, companyName, logoUrl, titleSuffix, titleBadge, detail]);
    useEffect(() => () => {
        setContent(null);
        window.dispatchEvent(new CustomEvent(COMPANY_HEADER_PIN_EVENT, { detail: { pinned: false } }));
    }, [setContent]);

    return <>
        <div ref={sentinel} aria-hidden="true" className="h-px" />
        <div ref={bar} data-detail-header className={cn('sticky z-30 bg-background py-4', pinned && 'border-b border-border py-2')}
            style={{ top: offset }}>
            <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <CompanyLogo companyName={companyName || displayName} logoUrl={logoUrl} size={pinned ? 36 : 48} className="shrink-0" />
                    <div className="min-w-0">
                        <h1 className={cn('break-keep font-bold tracking-tight', pinned ? 'text-lg sm:text-xl' : 'text-2xl sm:text-[32px]')}>
                            {displayName}<span className="ml-2 text-sm font-medium text-muted-foreground">{titleSuffix}</span>
                        </h1>
                        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {titleBadge && <span>{titleBadge}</span>}
                            {detail?.value && <span className="font-medium text-foreground tabular-nums">{detail.label ? `${detail.label} ` : ''}{detail.value}</span>}
                            {detail?.badge && <span>{detail.badge}</span>}
                        </div>
                    </div>
                </div>
                {actions && <div className="hidden shrink-0 sm:block">{actions}</div>}
            </div>
        </div>
    </>;
}
export default StickyCompanyHeader;
