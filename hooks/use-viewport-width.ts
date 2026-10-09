'use client';

import { useSyncExternalStore } from 'react';

const subscribe = (listener: () => void) => {
  window.addEventListener('resize', listener);
  return () => window.removeEventListener('resize', listener);
};
const width = () => window.innerWidth;
const serverWidth = () => 0;

export function useViewportWidth() {
  return useSyncExternalStore(subscribe, width, serverWidth);
}
