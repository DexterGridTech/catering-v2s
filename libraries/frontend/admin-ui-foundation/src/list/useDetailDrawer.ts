import {useCallback, useState} from 'react';

/** Shared list-to-detail Drawer handoff; the page remains the state owner. */
export function useDetailDrawer<T>() {
  const [target, setTarget] = useState<T>();
  const open = useCallback((nextTarget: T) => setTarget(nextTarget), []);
  const close = useCallback(() => setTarget(undefined), []);
  return {target, open, close, isOpen: target !== undefined};
}
