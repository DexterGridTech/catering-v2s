import type {ComponentProps} from 'react';
import {StoreTerminalFormDrawer} from './StoreTerminalFormDrawer';

type TerminalCreateDrawerProps = ComponentProps<typeof StoreTerminalFormDrawer>;

/** Creation surface owns the first device-type step; shared form mechanics stay in the lifecycle-backed drawer. */
export function TerminalCreateDrawer(props: TerminalCreateDrawerProps) {
  return <StoreTerminalFormDrawer {...props} editor={props.editor?.mode === 'create' ? props.editor : undefined} />;
}
