import {useSyncExternalStore} from 'react';

/**
 * A wire-agnostic notification primitive for app-owned cache invalidation.
 * Each app decides which successful commands publish and which read models
 * subscribe; foundation never knows a route, capability or endpoint.
 */
export type RefreshSignal = {
  publish: () => void;
  subscribe: (listener: () => void) => () => void;
  snapshot: () => number;
};

export function createRefreshSignal(): RefreshSignal {
  let version = 0;
  const listeners = new Set<() => void>();
  return {
    publish: () => {
      version += 1;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot: () => version,
  };
}

export function useRefreshVersion(signal: RefreshSignal): number {
  return useSyncExternalStore(signal.subscribe, signal.snapshot, signal.snapshot);
}
