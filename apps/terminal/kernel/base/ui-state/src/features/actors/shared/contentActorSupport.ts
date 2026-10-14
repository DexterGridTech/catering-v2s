import {createAppError} from '@catering-v2s/kernel-base-contracts';
import {createWorkspaceActionDispatcher, type StateJsonValue, type WorkspaceKey} from '@catering-v2s/kernel-base-state';
import {selectRuntimeInstanceMode, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {resolveWorkspace, selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {assertStateJsonValue, cloneAndFreezeStateJsonValue} from '../../../foundations/valueValidation';
import {layerPartUnavailableErrorDefinition} from '../../../declarations/errors';
import {readContentState} from '../../../foundations/workspaceSlices';
import {contentActions} from '../../slices/contentActions';
import type {SurfaceForm, UiCatalog} from '../../../types/catalog';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import {isWorkspaceOwnedByInstanceMode, workspaceOwnedByInstanceMode} from '../../../foundations/workspaceOwnership';

type PayloadRecord = Readonly<Record<string, unknown>>;

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
  workspace?: WorkspaceKey;
  instanceId?: string;
  props?: StateJsonValue;
}>;

export const normalizeShowPayload = (value: unknown): NormalizedShowPayload => {
  const commandName = 'show-screen';
  const record = requireRecord(value, commandName);
  const displayMode = requireDisplayMode(record.displayMode, commandName);
  const containerKey = requireString(record, 'containerKey', commandName);
  const partKey = requireString(record, 'partKey', commandName);
  const workspace = record.workspace;
  if (workspace !== undefined && workspace !== 'MAIN' && workspace !== 'BRANCH') {
    throw new Error(`[ui-state] ${commandName}.workspace must be MAIN or BRANCH`);
  }
  const instanceId = record.instanceId;
  if (instanceId !== undefined && (typeof instanceId !== 'string' || instanceId.trim().length === 0)) {
    throw new Error(`[ui-state] ${commandName}.instanceId must be non-empty when provided`);
  }
  const props = readOptionalProps(record, commandName);
  return Object.freeze({
    displayMode,
    containerKey,
    partKey,
    ...(workspace === undefined ? {} : {workspace}),
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
  workspace?: WorkspaceKey;
}>;

export const normalizeOpenLayerPayload = (value: unknown): NormalizedOpenLayerPayload => {
  const commandName = 'open-layer';
  const record = requireRecord(value, commandName);
  const props = readOptionalProps(record, commandName);
  const persistence = record.persistence === undefined ? 'durable' : record.persistence;
  if (persistence !== 'durable' && persistence !== 'ephemeral') {
    throw new Error(`[ui-state] ${commandName}.persistence must be durable or ephemeral`);
  }
  const workspace = record.workspace;
  if (workspace !== undefined && workspace !== 'MAIN' && workspace !== 'BRANCH') {
    throw new Error(`[ui-state] ${commandName}.workspace must be MAIN or BRANCH`);
  }
  return Object.freeze({
    displayMode: requireDisplayMode(record.displayMode, commandName),
    layerId: requireString(record, 'layerId', commandName),
    partKey: requireString(record, 'partKey', commandName),
    ...(props === undefined ? {} : {props}),
    persistence,
    ...(workspace === undefined ? {} : {workspace}),
  });
};

type NormalizedCloseLayerPayload = Readonly<{
  displayMode: DisplayMode;
  layerId: string;
  workspace?: WorkspaceKey;
}>;

export const normalizeCloseLayerPayload = (value: unknown): NormalizedCloseLayerPayload => {
  const commandName = 'close-layer';
  const record = requireRecord(value, commandName);
  const workspace = record.workspace;
  if (workspace !== undefined && workspace !== 'MAIN' && workspace !== 'BRANCH') {
    throw new Error(`[ui-state] ${commandName}.workspace must be MAIN or BRANCH`);
  }
  return Object.freeze({
    displayMode: requireDisplayMode(record.displayMode, commandName),
    layerId: requireString(record, 'layerId', commandName),
    ...(workspace === undefined ? {} : {workspace}),
  });
};

export const normalizeClearLayersPayload = (value: unknown): Readonly<{displayMode: DisplayMode}> => {
  const commandName = 'clear-layers';
  const record = requireRecord(value, commandName);
  return Object.freeze({displayMode: requireDisplayMode(record.displayMode, commandName)});
};

export const currentWorkspace = (context: ActorExecutionContext): WorkspaceKey => {
  const state = context.getState();
  return resolveWorkspace({
    instanceMode: selectRuntimeInstanceMode(state),
    displayRole: selectDisplayRole(state),
  });
};

export const assertContentWriteOwnership = (context: ActorExecutionContext, workspace: WorkspaceKey): void => {
  const instanceMode = selectRuntimeInstanceMode(context.getState());
  const ownedWorkspace = workspaceOwnedByInstanceMode(instanceMode);
  if (!isWorkspaceOwnedByInstanceMode({instanceMode, workspace})) {
    throw new Error(
      `[ui-state] content write ownership violation: ${workspace} requires ${ownedWorkspace} for ${instanceMode}`,
    );
  }
};

export const currentCatalogContext = (
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

export const createLayerPartUnavailableError = (
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

export const dispatchContentAction = (
  context: ActorExecutionContext,
  action: ContentAction,
  workspaceOverride?: WorkspaceKey,
): Readonly<{workspace: WorkspaceKey; changed: boolean}> => {
  const workspace = workspaceOverride ?? currentWorkspace(context);
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
