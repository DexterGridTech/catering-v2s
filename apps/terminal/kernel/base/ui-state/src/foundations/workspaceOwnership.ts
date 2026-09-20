import {resolveWorkspace, selectDisplayRole} from '@catering-v2s/kernel-base-display-context'
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime'
import type {StateRoot, WorkspaceKey} from '@catering-v2s/kernel-base-state'

export const workspaceOwnedByInstanceMode = (
  instanceMode: ReturnType<typeof selectRuntimeInstanceMode>,
): WorkspaceKey => instanceMode === 'MASTER' ? 'MAIN' : 'BRANCH'

export const isWorkspaceOwnedByInstanceMode = (input: Readonly<{
  readonly instanceMode: ReturnType<typeof selectRuntimeInstanceMode>
  readonly workspace: WorkspaceKey
}>): boolean => workspaceOwnedByInstanceMode(input.instanceMode) === input.workspace

export const isCurrentWorkspaceOwnedByInstance = (state: StateRoot): boolean => {
  const instanceMode = selectRuntimeInstanceMode(state)
  const currentWorkspace = resolveWorkspace({
    instanceMode,
    displayRole: selectDisplayRole(state),
  })
  return isWorkspaceOwnedByInstanceMode({instanceMode, workspace: currentWorkspace})
}
