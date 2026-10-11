import {useCallback, useEffect, useMemo, useRef} from 'react';
import {closeLayerCommand, openLayerCommand, selectLayers} from '@catering-v2s/kernel-base-ui-state';
import {resolveWorkspace, selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {selectTerminalUpdateInvitation} from '@catering-v2s/kernel-base-terminal-update';
import {dispatchWithRequestId, useDispatchCommand, useSurfaceContext, useUiStateSelector} from '@catering-v2s/ui-base-render';
import {UPDATE_INSTALL_REMINDER_LAYER_ID, UPDATE_INSTALL_REMINDER_PART_KEY} from '../foundations/updateReminderIdentity';

const localWorkspace = (root: Parameters<typeof selectRuntimeInstanceMode>[0]) => {
  const instanceMode = selectRuntimeInstanceMode(root);
  const displayRole = selectDisplayRole(root);
  return instanceMode === 'SLAVE' && displayRole === 'VICE'
    ? ('BRANCH' as const)
    : resolveWorkspace({instanceMode, displayRole});
};

export const InstallReminderController = () => {
  const surface = useSurfaceContext();
  const dispatchCommand = useDispatchCommand();
  const invitation = useUiStateSelector(selectTerminalUpdateInvitation) ?? null;
  const workspace = useUiStateSelector(localWorkspace);
  const reminderLayerOpen = useUiStateSelector(
    useMemo(
      () => (root: Parameters<typeof selectLayers>[0]) =>
        selectLayers(root, 'PRIMARY', workspace).some(layer => layer.layerId === UPDATE_INSTALL_REMINDER_LAYER_ID),
      [workspace],
    ),
  );
  const lastRequestKey = useRef<string | null>(null);
  const requestKey = invitation === null ? null : `${invitation.taskId}:${invitation.actionId ?? ''}:${invitation.bootId}`;

  const reconcile = useCallback(() => {
    if (!surface.isHostPrimaryDisplay) return;
    const shouldOpen = invitation !== null;
    if (shouldOpen === reminderLayerOpen) {
      if (!shouldOpen) lastRequestKey.current = null;
      return;
    }
    if (shouldOpen && requestKey !== null && lastRequestKey.current === requestKey) return;
    lastRequestKey.current = shouldOpen ? requestKey : null;
    const operation = shouldOpen
      ? dispatchWithRequestId({
          dispatchCommand,
          definition: openLayerCommand,
          payload: {
            displayMode: 'PRIMARY' as const,
            layerId: UPDATE_INSTALL_REMINDER_LAYER_ID,
            partKey: UPDATE_INSTALL_REMINDER_PART_KEY,
            workspace,
            persistence: 'ephemeral' as const,
          },
          target: 'local',
        })
      : dispatchWithRequestId({
          dispatchCommand,
          definition: closeLayerCommand,
          payload: {displayMode: 'PRIMARY' as const, layerId: UPDATE_INSTALL_REMINDER_LAYER_ID, workspace},
          target: 'local',
        });
    void operation.then(result => {
      if (result.status === 'completed') return;
      if (shouldOpen) lastRequestKey.current = null;
    }).catch(() => {
      if (shouldOpen) lastRequestKey.current = null;
    });
  }, [dispatchCommand, invitation, reminderLayerOpen, requestKey, surface.isHostPrimaryDisplay, workspace]);

  useEffect(() => reconcile(), [reconcile]);
  return null;
};
