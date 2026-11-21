"use client";

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
    historyAction?: ReactNode;
    contextActions?: ReactNode;
    compactActions?: boolean;
    onPinChange?: (pinned: boolean) => void;
}

export function StickyCompanyHeader({ displayName, companyName, logoUrl, stickyOffset = 80,
    titleSuffix = '시가총액', titleBadge, detail, actions, historyAction, contextActions, compactActions = false,
    onPinChange }: StickyCompanyHeaderProps) {
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
        <div ref={bar} data-detail-header data-pinned={pinned || undefined} className={cn('sticky z-30 bg-background py-2', pinned && 'border-b border-border py-2')}
            style={{ top: offset }}>
            <div className={cn('flex min-w-0 items-center justify-between gap-3', (historyAction || compactActions) && 'flex-wrap gap-y-2')}>
                <div className={cn('flex min-w-0 items-center gap-3', compactActions ? 'max-w-full flex-[1_1_12rem]'
                    : historyAction && 'max-w-full flex-auto')}>
                    <div className="min-w-0">
                        <h1 className={cn('break-keep [overflow-wrap:anywhere] font-bold tracking-tight',
                            !historyAction && !compactActions && 'sm:[overflow-wrap:normal]',
                            pinned ? 'text-lg sm:text-xl' : 'text-2xl sm:text-[32px]')}>
                            {displayName}<span className="detail-title-suffix mt-1 block text-sm font-medium text-muted-foreground sm:ml-2 sm:mt-0 sm:inline">{titleSuffix}</span>
                        </h1>
                        {(titleBadge || detail?.value || detail?.badge) && <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {titleBadge && <span>{titleBadge}</span>}
                            {detail?.value && <span className="font-medium text-foreground tabular-nums">{detail.label ? `${detail.label} ` : ''}{detail.value}</span>}
                            {detail?.badge && <span>{detail.badge}</span>}
                        </div>}
                    </div>
                </div>
                {historyAction || compactActions ? <div data-detail-header-actions className={cn('ms-auto flex max-w-full items-start justify-end gap-2',
                    compactActions ? 'shrink-0' : 'flex-wrap')}>
                    {actions && <div className="detail-share shrink-0">{actions}</div>}
                    {historyAction}
                </div> : actions && <div className="detail-share shrink-0">{actions}</div>}
            </div>
            {contextActions}
        </div>
    </>;
}
export default StickyCompanyHeader;
