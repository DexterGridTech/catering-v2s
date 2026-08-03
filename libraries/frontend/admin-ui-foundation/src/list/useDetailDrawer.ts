import {useCallback, useState} from 'react';

/** Shared list-to-detail Drawer handoff; the page remains the state owner. */
export function useDetailDrawer<T>() {
  const [target, setTarget] = useState<T>();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const openLoading = useCallback(() => {
    setTarget(undefined);
    setLoading(true);
    setIsOpen(true);
  }, []);
  const open = useCallback((nextTarget: T) => {
    setTarget(nextTarget);
    setLoading(false);
    setIsOpen(true);
  }, []);
  const finishLoading = useCallback(() => setLoading(false), []);
  const close = useCallback(() => {
    setTarget(undefined);
    setLoading(false);
    setIsOpen(false);
  }, []);
  return {target, open, openLoading, finishLoading, close, isOpen, loading};
}
