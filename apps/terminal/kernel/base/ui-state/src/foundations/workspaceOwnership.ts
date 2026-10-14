import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {WorkspaceKey} from '@catering-v2s/kernel-base-state';

export const workspaceOwnedByInstanceMode = (
  instanceMode: ReturnType<typeof selectRuntimeInstanceMode>,
): WorkspaceKey => (instanceMode === 'MASTER' ? 'MAIN' : 'BRANCH');

export const isWorkspaceOwnedByInstanceMode = (
  input: Readonly<{
    readonly instanceMode: ReturnType<typeof selectRuntimeInstanceMode>;
    readonly workspace: WorkspaceKey;
  }>,
): boolean => workspaceOwnedByInstanceMode(input.instanceMode) === input.workspace;

