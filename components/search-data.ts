"use client";

import { useEffect, useSyncExternalStore } from "react";

export interface SearchMenuItem {
  securityId: string;
  companyId: string | null;
  korName: string;
  type: string | null;
  exchange: string;
  ticker: string;
  routeCode?: string | null;
  companyRouteCode?: string | null;
}

type SearchDataState = {
  status: "idle" | "loading" | "success" | "error";
  data: SearchMenuItem[];
  hasSnapshot: boolean;
};

const CACHE_TTL_MS = 300_000;
const REQUEST_TIMEOUT_MS = 20_000;
const initialState: SearchDataState = { status: "idle", data: [], hasSnapshot: false };
let state = initialState;
let fetchedAt = 0;
let pending: Promise<SearchMenuItem[]> | null = null;
const listeners = new Set<() => void>();

function publish(next: SearchDataState) {
  state = next;
  for (const listener of listeners) listener();
}

function isSearchItem(value: unknown): value is SearchMenuItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.securityId === "string"
    && (item.companyId === null || typeof item.companyId === "string")
    && typeof item.korName === "string"
    && (item.type === null || typeof item.type === "string")
    && typeof item.exchange === "string"
    && typeof item.ticker === "string";
}

export function loadSearchData(): Promise<SearchMenuItem[]> {
  if (pending) return pending;
  if (state.status === "success" && Date.now() - fetchedAt < CACHE_TTL_MS) {
    return Promise.resolve(state.data);
  }

  // The store owns the timeout so navigation and individual subscribers
  // cannot abort a request the next page can reuse.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const finishRequest = () => {
    clearTimeout(timeout);
    pending = null;
  };
  pending = fetch("/search-data.json", {
    cache: "no-cache", priority: "low", signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Search data request failed: ${response.status}`);
      const data: unknown = await response.json();
      if (!Array.isArray(data) || !data.every(isSearchItem)) {
        throw new Error("Invalid search data response");
      }
      return data;
    })
    .then(data => {
      finishRequest();
      fetchedAt = Date.now();
      publish({ status: "success", data, hasSnapshot: true });
      return data;
    }, (error: unknown) => {
      finishRequest();
      publish({ ...state, status: "error" });
      throw error;
    });
  publish({ ...state, status: "loading" });
  return pending;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => initialState;
const retry = () => { void loadSearchData().catch(() => {}); };

export function useSearchData() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const entryState = snapshot.hasSnapshot ? "ready" : snapshot.status === "error" ? "retry" : "loading";
  return { ...snapshot, entryState, retry } as const;
}

export function useSearchPrefetch() {
  useEffect(() => {
    const prepare = () => {
      if (state.status === "idle" || state.hasSnapshot) retry();
    };
    if (typeof window.requestIdleCallback === "function") {
      const idle = window.requestIdleCallback(prepare, { timeout: 1_000 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = window.setTimeout(prepare, 150);
    return () => window.clearTimeout(timer);
  }, []);
}
