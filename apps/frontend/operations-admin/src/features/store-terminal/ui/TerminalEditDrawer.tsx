import type {ComponentProps} from 'react';
import {StoreTerminalFormDrawer} from './StoreTerminalFormDrawer';

type TerminalEditDrawerProps = ComponentProps<typeof StoreTerminalFormDrawer>;

/** Edit surface starts at the complete-rule step and never exposes activation-code input. */
export function TerminalEditDrawer(props: TerminalEditDrawerProps) {
  return <StoreTerminalFormDrawer {...props} editor={props.editor?.mode === 'edit' ? props.editor : undefined} />;
}
