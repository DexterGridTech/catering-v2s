import {createAppError, createModuleErrorFactory, nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {createWorkspaceActionDispatcher, type StateJsonValue, type WorkspaceKey} from '@catering-v2s/kernel-base-state';
import {
  defineActor,
  onCommand,
  selectRuntimeInstanceMode,
  type ActorDefinition,
  type ActorExecutionContext,
} from '@catering-v2s/kernel-base-runtime';
import {resolveWorkspace, selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {assertStateJsonValue, cloneAndFreezeStateJsonValue} from '../../foundations/valueValidation';
import {moduleName} from '../../moduleName';
import {
  clearLayersCommand,
  closeLayerCommand,
  openLayerCommand,
  pruneHydratedContainersCommand,
  pruneHydratedLayersCommand,
  showScreenCommand,
} from '../commands';
import {contentActions, readContentState} from '../../foundations/workspaceSlices';
import {hasUiContainerDeclarations, isUiCatalogEntryAvailable} from '../../foundations/catalog';
import type {SurfaceForm, UiCatalog} from '../../types/catalog';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {completeUiStateWrite} from './completeWrite';
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import {isWorkspaceOwnedByInstanceMode, workspaceOwnedByInstanceMode} from '../../foundations/workspaceOwnership';

type PayloadRecord = Readonly<Record<string, unknown>>;

const defineError = createModuleErrorFactory(moduleName);
const layerPartUnavailableErrorDefinition = defineError('layer-part-unavailable', {
  name: 'UI layer part is unavailable for the current surface',
  defaultTemplate: 'UI layer part is unavailable for the current surface',
  category: 'VALIDATION',
  severity: 'LOW',
  code: 'ERR_TER_UI_STATE_LAYER_PART_UNAVAILABLE',
});

const readRecord = (value: unknown): PayloadRecord | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as PayloadRecord) : undefined;

const requireRecord = (value: unknown, commandName: string): PayloadRecord => {
  const record = readRecord(value);
  if (record === undefined) throw new Error(`[ui-state] ${commandName} payload must be an object`);
  return record;
};

const requireDisplayMode = (value: unknown, commandName: string): DisplayMode => {
  if (value !== 'PRIMARY' && value !== 'SECONDARY') {
    throw new Error(`[ui-state] ${commandName}.displayMode must be PRIMARY or SECONDARY`);
  }
  return value;
};

const requireString = (record: PayloadRecord, key: string, commandName: string): string => {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`[ui-state] ${commandName}.${key} must be non-empty`);
  }
  return value;
};

const readOptionalProps = (record: PayloadRecord, commandName: string): StateJsonValue | undefined => {
  const value = record.props;
  if (value === undefined) return undefined;
  assertStateJsonValue(value, `[ui-state] ${commandName}.props`);
  return cloneAndFreezeStateJsonValue(value);
};

type NormalizedShowPayload = Readonly<{
  displayMode: DisplayMode;
  containerKey: string;
  partKey: string;
  instanceId?: string;
  props?: StateJsonValue;
}>;

const normalizeShowPayload = (value: unknown): NormalizedShowPayload => {
  const commandName = 'show-screen';
  const record = requireRecord(value, commandName);
  const displayMode = requireDisplayMode(record.displayMode, commandName);
  const containerKey = requireString(record, 'containerKey', commandName);
  const partKey = requireString(record, 'partKey', commandName);
  const instanceId = record.instanceId;
  if (instanceId !== undefined && (typeof instanceId !== 'string' || instanceId.trim().length === 0)) {
    throw new Error(`[ui-state] ${commandName}.instanceId must be non-empty when provided`);
  }
  const props = readOptionalProps(record, commandName);
  return Object.freeze({
    displayMode,
    containerKey,
    partKey,
    ...(instanceId === undefined ? {} : {instanceId}),
    ...(props === undefined ? {} : {props}),
  });
};

type NormalizedOpenLayerPayload = Readonly<{
  displayMode: DisplayMode;
  layerId: string;
  partKey: string;
  props?: StateJsonValue;
  persistence: 'durable' | 'ephemeral';
}>;

const normalizeOpenLayerPayload = (value: unknown): NormalizedOpenLayerPayload => {
  const commandName = 'open-layer';
  const record = requireRecord(value, commandName);
  const props = readOptionalProps(record, commandName);
  const persistence = record.persistence === undefined ? 'durable' : record.persistence;
  if (persistence !== 'durable' && persistence !== 'ephemeral') {
    throw new Error(`[ui-state] ${commandName}.persistence must be durable or ephemeral`);
  }
  return Object.freeze({
    displayMode: requireDisplayMode(record.displayMode, commandName),
    layerId: requireString(record, 'layerId', commandName),
    partKey: requireString(record, 'partKey', commandName),
    ...(props === undefined ? {} : {props}),
    persistence,
  });
};

type NormalizedCloseLayerPayload = Readonly<{
  displayMode: DisplayMode;
  layerId: string;
}>;

const normalizeCloseLayerPayload = (value: unknown): NormalizedCloseLayerPayload => {
  const commandName = 'close-layer';
  const record = requireRecord(value, commandName);
  return Object.freeze({
    displayMode: requireDisplayMode(record.displayMode, commandName),
    layerId: requireString(record, 'layerId', commandName),
  });
};

const normalizeClearLayersPayload = (value: unknown): Readonly<{displayMode: DisplayMode}> => {
  const commandName = 'clear-layers';
  const record = requireRecord(value, commandName);
  return Object.freeze({displayMode: requireDisplayMode(record.displayMode, commandName)});
};

const currentWorkspace = (context: ActorExecutionContext): WorkspaceKey => {
  const state = context.getState();
  return resolveWorkspace({
    instanceMode: selectRuntimeInstanceMode(state),
    displayRole: selectDisplayRole(state),
  });
};

const assertContentWriteOwnership = (context: ActorExecutionContext, workspace: WorkspaceKey): void => {
  const instanceMode = selectRuntimeInstanceMode(context.getState());
  const ownedWorkspace = workspaceOwnedByInstanceMode(instanceMode);
  if (!isWorkspaceOwnedByInstanceMode({instanceMode, workspace})) {
    throw new Error(
      `[ui-state] content write ownership violation: ${workspace} requires ${ownedWorkspace} for ${instanceMode}`,
    );
  }
};

const currentCatalogContext = (
  input: Readonly<{
    readonly state: StateRoot;
    readonly displayMode: DisplayMode;
    readonly selectSurfaceForm: (root: StateRoot) => SurfaceForm;
    readonly workspaceOverride?: WorkspaceKey;
  }>,
) => {
  const {state, displayMode, selectSurfaceForm, workspaceOverride} = input;
  const instanceMode = selectRuntimeInstanceMode(state);
  const displayRole = selectDisplayRole(state);
  return Object.freeze({
    displayMode,
    workspace: workspaceOverride ?? resolveWorkspace({instanceMode, displayRole}),
    instanceMode,
    surfaceForm: selectSurfaceForm(state),
  });
};

const createLayerPartUnavailableError = (
  context: ActorExecutionContext,
  input: Readonly<{
    readonly partKey: string;
    readonly catalog: UiCatalog;
    readonly catalogContext: ReturnType<typeof currentCatalogContext>;
  }>,
) =>
  createAppError(layerPartUnavailableErrorDefinition, {
    context: {
      commandName: context.command.commandName,
      commandId: context.command.commandId,
      requestId: context.command.requestId ?? undefined,
      nodeId: context.localNodeId,
    },
    details: {
      reasonCode: 'layer-part-unavailable',
      partKey: input.partKey,
      displayMode: input.catalogContext.displayMode,
      workspace: input.catalogContext.workspace,
      instanceMode: input.catalogContext.instanceMode,
      surfaceForm: input.catalogContext.surfaceForm,
      catalogEntryPresent: input.catalog.byPartKey[input.partKey] !== undefined,
    },
  });

type ContentAction =
  | ReturnType<typeof contentActions.showScreen>
  | ReturnType<typeof contentActions.removeScreen>
  | ReturnType<typeof contentActions.openLayer>
  | ReturnType<typeof contentActions.closeLayer>
  | ReturnType<typeof contentActions.clearLayers>;

const dispatchContentAction = (
  context: ActorExecutionContext,
  action: ContentAction,
): Readonly<{workspace: WorkspaceKey; changed: boolean}> => {
  const workspace = currentWorkspace(context);
  const instanceMode = selectRuntimeInstanceMode(context.getState());
  assertContentWriteOwnership(context, workspace);
  const before = readContentState(context.getState(), workspace);
  const dispatch = createWorkspaceActionDispatcher({
    routeContext: {workspace},
    dispatch: context.dispatchAction,
  });
  dispatch(action);
  const after = readContentState(context.getState(), workspace);
  const actionPayload = readRecord(action.payload);
  const displayMode = actionPayload?.displayMode;
  const containerKey = actionPayload?.containerKey;
  const partKey = actionPayload?.partKey;
  const layerId = actionPayload?.layerId;
  const changed = after !== before;
  context.platformPorts.logger.info({
    category: 'ui-state.content',
    event: 'ui-state.content-write',
    message: 'Content slice write observed',
    data: {
      commandName: context.command.commandName,
      actionType: action.type,
      workspace,
      instanceMode,
      displayMode: displayMode === 'PRIMARY' || displayMode === 'SECONDARY' ? displayMode : null,
      containerKey: typeof containerKey === 'string' ? containerKey : null,
      partKey: typeof partKey === 'string' ? partKey : null,
      layerId: typeof layerId === 'string' ? layerId : null,
      changed,
    },
  });
  return Object.freeze({workspace, changed});
};

export const createShowScreenActor = (): ActorDefinition =>
  defineActor(moduleName, 'show-screen', [
    onCommand(showScreenCommand, async context => {
      const payload = normalizeShowPayload(context.command.payload);
      return completeUiStateWrite(
        context,
        dispatchContentAction(context, contentActions.showScreen(payload)),
        'content',
      );
    }),
  ]);

export const createOpenLayerActor = (
  input: Readonly<{
    readonly catalog: UiCatalog;
    readonly selectSurfaceForm: (root: StateRoot) => SurfaceForm;
  }>,
): ActorDefinition =>
  defineActor(moduleName, 'open-layer', [
    onCommand(openLayerCommand, async context => {
      const payload = normalizeOpenLayerPayload(context.command.payload);
      const state = context.getState();
      const catalogContext = currentCatalogContext({
        state,
        displayMode: payload.displayMode,
        selectSurfaceForm: input.selectSurfaceForm,
      });
      const entry = input.catalog.byPartKey[payload.partKey];
      if (entry === undefined || !isUiCatalogEntryAvailable(entry, null, catalogContext)) {
        throw createLayerPartUnavailableError(context, {
          partKey: payload.partKey,
          catalog: input.catalog,
          catalogContext,
        });
      }
      const workspace = currentWorkspace(context);
      const current = readContentState(context.getState(), workspace);
      if (current.contentSets[payload.displayMode].layers.some(layer => layer.layerId === payload.layerId)) {
        context.platformPorts.logger.warn({
          category: 'ui-state',
          event: 'ui-state.layer.duplicate-rejected',
          message: 'Duplicate UI layer id rejected',
          data: {workspace, displayMode: payload.displayMode, hasLayerId: true},
        });
        throw new Error('[ui-state] duplicate layerId');
      }
      return completeUiStateWrite(
        context,
        dispatchContentAction(
          context,
          contentActions.openLayer(
            Object.freeze({
              ...payload,
              openedAt: nowTimestampMs(),
            }),
          ),
        ),
        'content',
      );
    }),
  ]);

export const createCloseLayerActor = (): ActorDefinition =>
  defineActor(moduleName, 'close-layer', [
    onCommand(closeLayerCommand, async context => {
      const payload = normalizeCloseLayerPayload(context.command.payload);
      return completeUiStateWrite(
        context,
        dispatchContentAction(context, contentActions.closeLayer(payload)),
        'content',
      );
    }),
  ]);

export const createClearLayersActor = (): ActorDefinition =>
  defineActor(moduleName, 'clear-layers', [
    onCommand(clearLayersCommand, async context => {
      const payload = normalizeClearLayersPayload(context.command.payload);
      return completeUiStateWrite(
        context,
        dispatchContentAction(context, contentActions.clearLayers(payload)),
        'content',
      );
    }),
  ]);

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
