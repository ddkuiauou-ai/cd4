import type { CSSProperties } from "react";

export const GRADIENT_STOPS = [
    { offset: 0, alpha: 0.09 },
    { offset: 120, alpha: 0.05 },
    { offset: 280, alpha: 0.025 },
    { offset: 520, alpha: 0 },
] as const;

export const createSectionGradient = ([r, g, b]: [number, number, number]): CSSProperties => ({
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.02)`,
    backgroundImage: `linear-gradient(180deg, ${GRADIENT_STOPS.map(
        (stop) => `rgba(${r}, ${g}, ${b}, ${stop.alpha}) ${stop.offset}px`,
    ).join(", ")})`,
});

export const SECTION_GRADIENTS: Record<string, CSSProperties> = {
    overview: createSectionGradient([59, 130, 246]),
    charts: createSectionGradient([34, 197, 94]),
    securities: createSectionGradient([168, 85, 247]),
    indicators: createSectionGradient([249, 115, 22]),
    annual: createSectionGradient([239, 68, 68]),
};

export const EDGE_TO_EDGE_SECTION_BASE =
    "relative -mx-4 space-y-4 border-y px-4 py-4 shadow-sm sm:mx-0 sm:space-y-8 sm:overflow-hidden sm:rounded-3xl sm:border sm:px-6 sm:py-8";

export const EDGE_TO_EDGE_CARD_BASE =
    "border border-border/60 bg-background/80 shadow-sm sm:rounded-2xl";

export const ACTIVE_METRIC = {
    id: "marketcap",
    label: "시가총액",
    description: "Market Cap",
} as const;

