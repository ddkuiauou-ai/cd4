'use client';

import { createContext, useContext } from 'react';

/** Only a surface holding both company views may replace a route transition. */
export const CompanyTabNavigationContext = createContext<((href: string) => boolean) | null>(null);

export function useCompanyTabNavigation() {
  return useContext(CompanyTabNavigationContext);
}
