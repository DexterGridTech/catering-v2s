import {resolveWorkspace, selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {defineStateSelector, selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {isWorkspaceOwnedByInstanceMode} from '../foundations/workspaceOwnership';

const isCurrentWorkspaceOwnedByInstanceImplementation = (state: StateRoot): boolean => {
  const instanceMode = selectRuntimeInstanceMode(state);
  const currentWorkspace = resolveWorkspace({instanceMode, displayRole: selectDisplayRole(state)});
  return isWorkspaceOwnedByInstanceMode({instanceMode, workspace: currentWorkspace});
};

export const isCurrentWorkspaceOwnedByInstance = defineStateSelector(moduleName, 'isCurrentWorkspaceOwnedByInstance', {
  parameters: [],
  selector: isCurrentWorkspaceOwnedByInstanceImplementation,
});
