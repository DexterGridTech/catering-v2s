import {useEffect, useRef} from 'react';

export type AsyncGenerationGuard = {
  begin: () => number;
  invalidate: () => void;
  isCurrent: (generation: number) => boolean;
};

/**
 * Guards one independently-rendered async resource. A caller obtains a
 * generation before dispatching a request and writes a result only while it
 * remains current, so a late response cannot overwrite newer user context.
 */
export function createAsyncGenerationGuard(): AsyncGenerationGuard {
  let current = 0;
  return {
    begin: () => ++current,
    invalidate: () => { ++current; },
    isCurrent: (generation) => generation === current,
  };
}

/** Invalidates outstanding work on unmount without imposing any transport. */
export function useAsyncGenerationGuard(): AsyncGenerationGuard {
  const guard = useRef<AsyncGenerationGuard | undefined>(undefined);
  if (!guard.current) guard.current = createAsyncGenerationGuard();
  useEffect(() => () => { guard.current?.invalidate(); }, []);
  return guard.current;
}
