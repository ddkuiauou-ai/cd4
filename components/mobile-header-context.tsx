"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type MobileHeaderContent = {
  type: "company";
  displayName: string;
  companyName?: string | null;
  logoUrl?: string | null;
};

type MobileHeaderContextValue = {
  content: MobileHeaderContent | null;
  setContent: (content: MobileHeaderContent | null) => void;
};

const noop = () => {};

const defaultValue: MobileHeaderContextValue = {
  content: null,
  setContent: noop,
};

const MobileHeaderContext = createContext<MobileHeaderContextValue | undefined>(
  undefined
);

export function MobileHeaderProvider({ children }: { children: ReactNode }) {
  const [content, setContentState] = useState<MobileHeaderContent | null>(null);

  const setContent = useCallback((next: MobileHeaderContent | null) => {
    setContentState(prev => {
      if (prev === next) {
        return prev;
      }

      if (!prev && !next) {
        return prev;
      }

      if (!prev || !next) {
        return next ?? null;
      }

      const isSame =
        prev.type === next.type &&
        prev.displayName === next.displayName &&
        prev.companyName === next.companyName &&
        prev.logoUrl === next.logoUrl;

      return isSame ? prev : next;
    });
  }, []);

  const value = useMemo(
    () => ({
      content,
      setContent,
    }),
    [content, setContent]
  );

  return (
    <MobileHeaderContext.Provider value={value}>
      {children}
    </MobileHeaderContext.Provider>
  );
}

export function useMobileHeader() {
  return useContext(MobileHeaderContext) ?? defaultValue;
}

