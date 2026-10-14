import {createWorkspaceActionDispatcher, type WorkspaceKey} from '@catering-v2s/kernel-base-state';
import {
  defineActor,
  onCommand,
  selectRuntimeInstanceMode,
  type ActorDefinition,
  type ActorExecutionContext,
} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../../moduleName';
import {pruneHydratedContainersCommand} from '../../declarations/commands';
import {readContentState} from '../../foundations/workspaceSlices';
import {contentActions} from '../slices/contentActions';
import {hasUiContainerDeclarations, isUiCatalogEntryAvailable} from '../../foundations/catalog';
import type {SurfaceForm, UiCatalog} from '../../types/catalog';
import {completeUiStateWrite} from './completeWrite';
import {assertContentWriteOwnership, currentCatalogContext, currentWorkspace} from './shared/contentActorSupport';
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import {workspaceOwnedByInstanceMode} from '../../foundations/workspaceOwnership';

const pruneHydratedContainersForDisplayMode = ({
  context,
  catalog,
  selectSurfaceForm,
  workspace,
  displayMode,
}: Readonly<{
  readonly context: ActorExecutionContext;
  readonly catalog: UiCatalog;
  readonly selectSurfaceForm: (root: StateRoot) => SurfaceForm;
  readonly workspace: WorkspaceKey;
  readonly displayMode: DisplayMode;
}>): boolean => {
  const dispatch = createWorkspaceActionDispatcher({
    routeContext: {workspace},
    dispatch: context.dispatchAction,
  });
  assertContentWriteOwnership(context, workspace);
  const before = readContentState(context.getState(), workspace);
  const containers = before.contentSets[displayMode].containers;
  const catalogContext = currentCatalogContext({
    state: context.getState(),
    displayMode,
    selectSurfaceForm,
    workspaceOverride: workspace,
  });
  for (const [containerKey, placement] of Object.entries(containers)) {
    const entry = catalog.byPartKey[placement.partKey];
    const renderable = entry !== undefined && isUiCatalogEntryAvailable(entry, containerKey, catalogContext);
    if (renderable) continue;
    context.platformPorts.logger.warn({
      category: 'ui-state-hydration',
      event: 'ui-state-hydration.container.not-renderable',
      message: 'Hydrated UI container was removed because it is not renderable in the current catalog',
      data: {
        scope: 'container',
        workspace,
        displayMode,
        containerKey,
        layerId: null,
        partKey: placement.partKey,
        reason: 'hydrated-container-not-renderable',
      },
    });
    dispatch(contentActions.removeScreen({displayMode, containerKey}));
  }
  const after = readContentState(context.getState(), workspace);
  return after !== before;
};

export const createPruneHydratedContainersActor = (
  input: Readonly<{
    readonly catalog: UiCatalog;
    readonly selectSurfaceForm: (root: StateRoot) => SurfaceForm;
  }>,
): ActorDefinition =>
  defineActor(moduleName, 'prune-hydrated-containers', [
    onCommand(pruneHydratedContainersCommand, async context => {
      let changed = false;
      const workspaces: readonly WorkspaceKey[] = [
        workspaceOwnedByInstanceMode(selectRuntimeInstanceMode(context.getState())),
      ];
      const displayModes: readonly DisplayMode[] = ['PRIMARY', 'SECONDARY'];
      if (!hasUiContainerDeclarations(input.catalog)) {
        return completeUiStateWrite(
          context,
          {
            workspace: currentWorkspace(context),
            changed: false,
          },
          'content',
        );
      }
      for (const workspace of workspaces) {
        for (const displayMode of displayModes) {
          changed =
            pruneHydratedContainersForDisplayMode({
              context,
              catalog: input.catalog,
              selectSurfaceForm: input.selectSurfaceForm,
              workspace,
              displayMode,
            }) || changed;
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
