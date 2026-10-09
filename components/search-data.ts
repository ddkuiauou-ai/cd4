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
};

const CACHE_TTL_MS = 300_000;
const initialState: SearchDataState = { status: "idle", data: [] };
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

  publish({ status: "loading", data: state.data });
  // Keep the shared request alive when one menu unmounts. Other subscribers
  // and the next page can reuse it without one consumer aborting their fetch.
  pending = fetch("/search-data.json", { cache: "no-cache" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Search data request failed: ${response.status}`);
      const data: unknown = await response.json();
      if (!Array.isArray(data) || !data.every(isSearchItem)) {
        throw new Error("Invalid search data response");
      }
      fetchedAt = Date.now();
      publish({ status: "success", data });
      return data;
    })
    .catch((error: unknown) => {
      publish({ status: "error", data: state.data });
      throw error;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const getServerSnapshot = () => initialState;
const retry = () => { void loadSearchData().catch(() => {}); };

export function useSearchData(enabled: boolean) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    if (enabled) retry();
  }, [enabled]);
  return { ...snapshot, retry };
}
