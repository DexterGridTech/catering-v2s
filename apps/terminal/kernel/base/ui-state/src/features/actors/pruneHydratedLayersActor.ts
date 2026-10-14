import {createWorkspaceActionDispatcher, type WorkspaceKey} from '@catering-v2s/kernel-base-state';
import {
  defineActor,
  onCommand,
  selectRuntimeInstanceMode,
  type ActorDefinition,
} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import {pruneHydratedLayersCommand} from '../../declarations/commands';
import {readContentState} from '../../foundations/workspaceSlices';
import {contentActions} from '../slices/contentActions';
import type {UiCatalog} from '../../types/catalog';
import {completeUiStateWrite} from './completeWrite';
import {assertContentWriteOwnership, currentWorkspace} from './shared/contentActorSupport';
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import {workspaceOwnedByInstanceMode} from '../../foundations/workspaceOwnership';

export const createPruneHydratedLayersActor = (
  input: Readonly<{
    readonly catalog: UiCatalog;
  }>,
): ActorDefinition =>
  defineActor(moduleName, 'prune-hydrated-layers', [
    onCommand(pruneHydratedLayersCommand, async context => {
      let changed = false;
      const workspaces: readonly WorkspaceKey[] = [
        workspaceOwnedByInstanceMode(selectRuntimeInstanceMode(context.getState())),
      ];
      const displayModes: readonly DisplayMode[] = ['PRIMARY', 'SECONDARY'];
      for (const workspace of workspaces) {
        const dispatch = createWorkspaceActionDispatcher({
          routeContext: {workspace},
          dispatch: context.dispatchAction,
        });
        assertContentWriteOwnership(context, workspace);
        for (const displayMode of displayModes) {
          const before = readContentState(context.getState(), workspace);
          const layers = before.contentSets[displayMode].layers;
          const unknownLayers = layers.filter(layer => input.catalog.byPartKey[layer.partKey] === undefined);
          for (const layer of unknownLayers) {
            context.platformPorts.logger.warn({
              category: 'ui-state-hydration',
              event: 'ui-state-hydration.layer.unknown-part',
              message: 'Hydrated UI layer removed because its catalog part is unknown',
              data: {
                workspace,
                displayMode,
                layerId: layer.layerId,
                partKey: layer.partKey,
                reason: 'unknown-part',
              },
            });
            dispatch(contentActions.closeLayer({displayMode, layerId: layer.layerId}));
          }
          const after = readContentState(context.getState(), workspace);
          changed = changed || after !== before;
        }
      }
      return completeUiStateWrite(
        context,
        {
          workspace: currentWorkspace(context),
          changed,
        },
        'content',
      );
    }),
  ]);
