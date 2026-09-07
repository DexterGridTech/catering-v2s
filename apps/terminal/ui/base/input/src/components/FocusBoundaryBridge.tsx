import {useCallback, type ReactNode} from 'react';
import {SurfaceFocusBoundaryContext} from '@catering-v2s/ui-base-render';

export const FocusBoundaryBridge = ({
  notify,
  children,
}: Readonly<{
  readonly notify: (phase: 'suspend' | 'restore') => void;
  readonly children?: ReactNode;
}>) => {
  const listener = useCallback(
    (phase: 'suspend' | 'restore') => {
      notify(phase);
    },
    [notify],
  );
  return <SurfaceFocusBoundaryContext.Provider value={listener}>{children}</SurfaceFocusBoundaryContext.Provider>;
};
