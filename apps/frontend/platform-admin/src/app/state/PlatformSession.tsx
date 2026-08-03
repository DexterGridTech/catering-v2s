import {createContext, useContext, type ReactNode} from 'react';

type PlatformSessionContextValue = {
  refresh: () => Promise<void>;
};

const PlatformSessionContext = createContext<PlatformSessionContextValue | undefined>(undefined);

export function PlatformSessionProvider({refresh, children}: PlatformSessionContextValue & {children: ReactNode}) {
  return <PlatformSessionContext.Provider value={{refresh}}>{children}</PlatformSessionContext.Provider>;
}

export function usePlatformSessionRefresh() {
  const value = useContext(PlatformSessionContext);
  if (!value) throw new Error('Platform session context is unavailable outside the authenticated shell');
  return value.refresh;
}
