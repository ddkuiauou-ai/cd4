"use client";

import { useEffect, useId } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useCollapsedState } from '@/hooks/use-collapsed-state';

export function DetailMetricFacts({ rows, title = '핵심 지표', note, onCollapsedChange }: {
    rows: Array<[string, string]>; title?: string; note?: string;
    onCollapsedChange?: (collapsed: boolean) => void;
}) {
    const [collapsed, toggle] = useCollapsedState('key-metrics-collapsed', false);
    const id = useId();
    useEffect(() => { onCollapsedChange?.(collapsed); }, [collapsed, onCollapsedChange]);
    return <section className="border-t border-border pt-5">
        <button type="button" onClick={toggle} aria-expanded={!collapsed} aria-controls={id}
            className="flex min-h-10 w-full items-center justify-between gap-3 text-left text-base font-semibold">
            {title}{collapsed ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
        </button>
        {!collapsed && <div id={id}>
            <dl className="mt-3 space-y-3 text-sm">
                {rows.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium tabular-nums">{value}</dd>
                </div>)}
            </dl>
            {note && <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{note}</p>}
        </div>}
    </section>;
}
