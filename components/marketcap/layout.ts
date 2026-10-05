import type { CSSProperties } from 'react';

// Compatibility exports for the detail pages: sections now use the neutral page surface.
export const GRADIENT_STOPS = [] as const;
export const createSectionGradient = (_color: [number, number, number]): CSSProperties => ({});
export const SECTION_GRADIENTS: Record<string, CSSProperties> = {
    overview: {}, charts: {}, securities: {}, indicators: {}, annual: {},
};
export const EDGE_TO_EDGE_SECTION_BASE = 'detail-section relative space-y-5 border-t border-border py-6 sm:space-y-6 sm:py-8';
export const EDGE_TO_EDGE_CARD_BASE = 'detail-card min-w-0 border border-border bg-background';
export const ACTIVE_METRIC = { id: 'marketcap', label: '시가총액', description: 'Market Cap' } as const;
