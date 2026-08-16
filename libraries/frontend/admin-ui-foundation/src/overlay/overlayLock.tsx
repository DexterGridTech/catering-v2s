import {createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode} from 'react';

type OverlayLockContextValue = {
  overlayLocked: boolean;
  dirtyLocked: boolean;
  locked: boolean;
  setOpen: (registrationId: string, open: boolean) => void;
  setDirty: (registrationId: string, dirty: boolean) => void;
};

const OverlayLockContext = createContext<OverlayLockContextValue | null>(null);

export function updateOpenRegistrations(
  current: ReadonlySet<string>,
  registrationId: string,
  open: boolean,
): Set<string> {
  return updateRegistrations(current, registrationId, open);
}

export function updateDirtyRegistrations(
  current: ReadonlySet<string>,
  registrationId: string,
  dirty: boolean,
): Set<string> {
  return updateRegistrations(current, registrationId, dirty);
}

function updateRegistrations(current: ReadonlySet<string>, registrationId: string, active: boolean): Set<string> {
  if (current.has(registrationId) === active) return current as Set<string>;
  const next = new Set(current);
  if (active) next.add(registrationId);
  else next.delete(registrationId);
  return next;
}

export function OverlayLockProvider({children}: {children: ReactNode}) {
  const [openRegistrations, setOpenRegistrations] = useState<Set<string>>(() => new Set());
  const [dirtyRegistrations, setDirtyRegistrations] = useState<Set<string>>(() => new Set());
  const setOpen = useCallback((registrationId: string, open: boolean) => {
    setOpenRegistrations(current => updateOpenRegistrations(current, registrationId, open));
  }, []);
  const setDirty = useCallback((registrationId: string, dirty: boolean) => {
    setDirtyRegistrations(current => updateDirtyRegistrations(current, registrationId, dirty));
  }, []);
  const value = useMemo(() => {
    const overlayLocked = openRegistrations.size > 0;
    const dirtyLocked = dirtyRegistrations.size > 0;
    return {overlayLocked, dirtyLocked, locked: overlayLocked || dirtyLocked, setOpen, setDirty};
  }, [dirtyRegistrations, openRegistrations, setDirty, setOpen]);
  return <OverlayLockContext.Provider value={value}>{children}</OverlayLockContext.Provider>;
}

/** Registers one Drawer/Modal owner with the app Shell without DOM inspection. */
export function useOverlayLock(open?: boolean): boolean {
  const context = useContext(OverlayLockContext);
  const setOpen = context?.setOpen;
  const registrationId = useId();
  useEffect(() => {
    if (!setOpen || open === undefined) return;
    setOpen(registrationId, open);
    return () => setOpen(registrationId, false);
  }, [open, registrationId, setOpen]);
  return context?.locked ?? false;
}

export function useDirtyFormLock(dirty?: boolean): boolean {
  const context = useContext(OverlayLockContext);
  const setDirty = context?.setDirty;
  const registrationId = useId();
  useEffect(() => {
    if (!setDirty || dirty === undefined) return;
    setDirty(registrationId, dirty);
    return () => setDirty(registrationId, false);
  }, [dirty, registrationId, setDirty]);
  return context?.locked ?? false;
}

export function useShellInteractionLock(): {overlayLocked: boolean; dirtyLocked: boolean; locked: boolean} {
  const context = useContext(OverlayLockContext);
  return context ?? {overlayLocked: false, dirtyLocked: false, locked: false};
}
