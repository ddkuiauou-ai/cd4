export const ITEMS_PER_PAGE = 100;

// Home page display limits
export const HOME_PAGE_LIMITS = {
    MOBILE_COMPANIES: 10,
    DESKTOP_COMPANIES: 20,
} as const;

// Chart dimensions
export const CHART_DIMENSIONS = {
    SPIKE_CHART: {
        MOBILE: { width: 300, height: 70 },
        DESKTOP: { width: 300, height: 80 },
    },
} as const;
