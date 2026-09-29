import {createSlice, type PayloadAction, type UnknownAction} from '@reduxjs/toolkit';
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import {
  createWorkspaceStateKeys,
  toWorkspaceStateDescriptors,
  type StateJsonObject,
  type StateJsonValue,
  type StateRoot,
  type StateRuntimeSliceDescriptor,
  type StateRuntimeSliceRegistration,
  type WorkspaceKey,
} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {assertStateJsonValue, cloneAndFreezeStateJsonValue} from './valueValidation';
import type {LayerEntry, ScreenPlacement, UiContentState} from '../types/content';
import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {SyncRecordState, SyncValueEnvelope} from '@catering-v2s/kernel-base-state';

const contentBaseName = `${moduleName}.content`;
const displayModes: readonly DisplayMode[] = ['PRIMARY', 'SECONDARY'];

export type ContentHydrationDiagnosticReason =
  | 'unknown-part'
  | 'duplicate-layer-id'
  | 'ephemeral-entry'
  | 'invalid-entry'
  | 'hydrated-container-invalid'
  | 'hydrated-container-not-renderable';

export type ContentHydrationDiagnostic = Readonly<{
  readonly scope: 'layer' | 'container';
  readonly workspace: WorkspaceKey;
  readonly displayMode: DisplayMode | null;
  readonly layerId: string | null;
  readonly containerKey: string | null;
  readonly partKey: string | null;
  readonly reason: ContentHydrationDiagnosticReason;
}>;

export type ContentHydrationDiagnosticSink = (diagnostic: ContentHydrationDiagnostic) => void;

export const isValidOpenedAt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0;

export const contentStateKeys = createWorkspaceStateKeys(contentBaseName);

const isDisplayMode = (value: unknown): value is DisplayMode => value === 'PRIMARY' || value === 'SECONDARY';

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const readObject = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const readOptionalProps = (record: Record<string, unknown>): StateJsonValue | undefined => {
  const value = record.props;
  if (value === undefined) return undefined;
  try {
    assertStateJsonValue(value, 'content.props');
    return cloneAndFreezeStateJsonValue(value);
  } catch {
    return undefined;
  }
};

const readLayerPersistence = (value: unknown): 'durable' | 'ephemeral' | undefined => {
  if (value === undefined || value === 'durable' || value === 'ephemeral') return value;
  return undefined;
};

const hasInvalidOptionalProps = (record: Record<string, unknown>): boolean =>
  record.props !== undefined && readOptionalProps(record) === undefined;

const createInitialContentState = (): UiContentState => ({
  contentSets: {
    PRIMARY: {containers: {}, layers: []},
    SECONDARY: {containers: {}, layers: []},
  },
});

const readShowPayload = (
  value: unknown,
):
  | Readonly<{
      displayMode: DisplayMode;
      containerKey: string;
      placement: ScreenPlacement;
    }>
  | undefined => {
  const record = readObject(value);
  if (
    record === undefined ||
    !isDisplayMode(record.displayMode) ||
    !isNonEmptyString(record.containerKey) ||
    !isNonEmptyString(record.partKey) ||
    hasInvalidOptionalProps(record) ||
    (record.instanceId !== undefined && !isNonEmptyString(record.instanceId))
  ) {
    return undefined;
  }
  const props = readOptionalProps(record);
  const placement: ScreenPlacement = Object.freeze({
    partKey: record.partKey,
    ...(record.instanceId === undefined ? {} : {instanceId: record.instanceId}),
    ...(props === undefined ? {} : {props}),
  });
  return Object.freeze({
    displayMode: record.displayMode,
    containerKey: record.containerKey,
    placement,
  });
};

const readOpenLayerPayload = (
  value: unknown,
):
  | Readonly<{
      displayMode: DisplayMode;
      layer: LayerEntry;
    }>
  | undefined => {
  const record = readObject(value);
  const persistence = record === undefined ? undefined : readLayerPersistence(record.persistence);
  if (
    record === undefined ||
    !isDisplayMode(record.displayMode) ||
    !isNonEmptyString(record.layerId) ||
    !isNonEmptyString(record.partKey) ||
    !isValidOpenedAt(record.openedAt) ||
    hasInvalidOptionalProps(record) ||
    (record.persistence !== undefined && persistence === undefined)
  ) {
    return undefined;
  }
  const props = readOptionalProps(record);
  const layer: LayerEntry = Object.freeze({
    layerId: record.layerId,
    partKey: record.partKey,
    ...(props === undefined ? {} : {props}),
    openedAt: record.openedAt,
    ...(persistence === undefined ? {} : {persistence}),
  });
  return Object.freeze({displayMode: record.displayMode, layer});
};

const readCloseLayerPayload = (
  value: unknown,
):
  | Readonly<{
      displayMode: DisplayMode;
      layerId: string;
    }>
  | undefined => {
  const record = readObject(value);
  if (record === undefined || !isDisplayMode(record.displayMode) || !isNonEmptyString(record.layerId)) {
    return undefined;
  }
  return Object.freeze({displayMode: record.displayMode, layerId: record.layerId});
};

const readRemoveScreenPayload = (
  value: unknown,
):
  | Readonly<{
      displayMode: DisplayMode;
      containerKey: string;
    }>
  | undefined => {
  const record = readObject(value);
  if (record === undefined || !isDisplayMode(record.displayMode) || !isNonEmptyString(record.containerKey)) {
    return undefined;
  }
  return Object.freeze({displayMode: record.displayMode, containerKey: record.containerKey});
};

const readClearLayersPayload = (value: unknown): Readonly<{displayMode: DisplayMode}> | undefined => {
  const record = readObject(value);
  return record !== undefined && isDisplayMode(record.displayMode)
    ? Object.freeze({displayMode: record.displayMode})
    : undefined;
};

type MutableContentState = {
  contentSets: Record<
    DisplayMode,
    {
      containers: Record<string, ScreenPlacement>;
      layers: LayerEntry[];
    }
  >;
};

type ContentCaseReducers = {
  readonly showScreen: (state: MutableContentState, action: PayloadAction<unknown>) => void;
  readonly removeScreen: (state: MutableContentState, action: PayloadAction<unknown>) => void;
  readonly openLayer: (state: MutableContentState, action: PayloadAction<unknown>) => void;
  readonly closeLayer: (state: MutableContentState, action: PayloadAction<unknown>) => void;
  readonly clearLayers: (state: MutableContentState, action: PayloadAction<unknown>) => void;
};

const createContentReducers = (): ContentCaseReducers => ({
  showScreen: (state, action): void => {
    const payload = readShowPayload(action.payload);
    if (payload === undefined) return;
    state.contentSets[payload.displayMode].containers[payload.containerKey] = payload.placement;
  },
  removeScreen: (state, action): void => {
    const payload = readRemoveScreenPayload(action.payload);
    if (payload === undefined) return;
    delete state.contentSets[payload.displayMode].containers[payload.containerKey];
  },
  openLayer: (state, action): void => {
    const payload = readOpenLayerPayload(action.payload);
    if (payload === undefined) return;
    const contentSet = state.contentSets[payload.displayMode];
    if (contentSet.layers.some(layer => layer.layerId === payload.layer.layerId)) return;
    contentSet.layers.push(payload.layer);
  },
  closeLayer: (state, action): void => {
    const payload = readCloseLayerPayload(action.payload);
    if (payload === undefined) return;
    const contentSet = state.contentSets[payload.displayMode];
    const index = contentSet.layers.findIndex(layer => layer.layerId === payload.layerId);
    if (index < 0) return;
    contentSet.layers.splice(index, 1);
  },
  clearLayers: (state, action): void => {
    const payload = readClearLayersPayload(action.payload);
    if (payload === undefined) return;
    const contentSet = state.contentSets[payload.displayMode];
    contentSet.layers.splice(0, contentSet.layers.length);
  },
});

type GeneratedContentActionCreator = (payload: unknown) => UnknownAction;
type GeneratedContentSlice = Readonly<{
  reducer: (state: UiContentState | undefined, action: UnknownAction) => UiContentState;
  actions: Readonly<Record<string, GeneratedContentActionCreator>>;
}>;
type CreateContentSliceInput = Readonly<{
  name: string;
  initialState: UiContentState;
  reducers: ContentCaseReducers;
}>;

const createTypedSlice = createSlice as (input: CreateContentSliceInput) => GeneratedContentSlice;

const createContentSlice = (name: string): GeneratedContentSlice =>
  createTypedSlice({
    name,
    initialState: createInitialContentState(),
    reducers: createContentReducers(),
  });

const canonicalContentSlice = createContentSlice(contentBaseName);
const mainContentSlice = createContentSlice(contentStateKeys.MAIN);
const branchContentSlice = createContentSlice(contentStateKeys.BRANCH);

export const contentActions = canonicalContentSlice.actions;

const serializePlacement = (placement: ScreenPlacement): StateJsonObject => {
  const result: Record<string, StateJsonValue> = {partKey: placement.partKey};
  if (placement.instanceId !== undefined) result.instanceId = placement.instanceId;
  if (placement.props !== undefined) result.props = placement.props;
  return result;
};

const serializeContainers = (containers: Readonly<Record<string, ScreenPlacement>>): StateJsonObject => {
  const result: Record<string, StateJsonValue> = {};
  for (const [containerKey, placement] of Object.entries(containers)) {
    result[containerKey] = serializePlacement(placement);
  }
  return result;
};

const serializeContentEntries = (
  state: Readonly<UiContentState>,
): Readonly<Partial<Record<string, StateJsonValue>>> => ({
  PRIMARY: serializeContainers(state.contentSets.PRIMARY.containers),
  SECONDARY: serializeContainers(state.contentSets.SECONDARY.containers),
});

const serializeLayer = (layer: LayerEntry): StateJsonObject | undefined => {
  if (layer.persistence === 'ephemeral') return undefined;
  if (layer.persistence !== undefined && layer.persistence !== 'durable') return undefined;
  if (!isNonEmptyString(layer.layerId) || !isNonEmptyString(layer.partKey) || !isValidOpenedAt(layer.openedAt)) {
    return undefined;
  }
  if (layer.props !== undefined) {
    try {
      assertStateJsonValue(layer.props, 'content.layer.props');
    } catch {
      return undefined;
    }
  }
  return {
    layerId: layer.layerId,
    partKey: layer.partKey,
    ...(layer.props === undefined ? {} : {props: layer.props}),
    openedAt: layer.openedAt,
    ...(layer.persistence === undefined ? {} : {persistence: layer.persistence}),
  };
};

const serializeLayers = (layers: readonly LayerEntry[]): StateJsonValue[] => {
  const result: StateJsonValue[] = [];
  for (const layer of layers) {
    const serialized = serializeLayer(layer);
    if (serialized !== undefined) result.push(serialized);
  }
  return result;
};

const serializeLayerEntries = (state: Readonly<UiContentState>): Readonly<Partial<Record<string, StateJsonValue>>> => ({
  PRIMARY: serializeLayers(state.contentSets.PRIMARY.layers),
  SECONDARY: serializeLayers(state.contentSets.SECONDARY.layers),
});

const contentSyncKey = (kind: 'containers' | 'layers', displayMode: DisplayMode): string => `${kind}.${displayMode}`;

const serializeContentSyncEntries = (state: Readonly<UiContentState>): SyncRecordState => {
  const updatedAt = nowTimestampMs();
  const result: Record<string, SyncValueEnvelope> = {};
  for (const [displayMode, value] of Object.entries(serializeContentEntries(state))) {
    if (value !== undefined) result[contentSyncKey('containers', displayMode as DisplayMode)] = {value, updatedAt};
  }
  for (const [displayMode, value] of Object.entries(serializeLayerEntries(state))) {
    if (value !== undefined) result[contentSyncKey('layers', displayMode as DisplayMode)] = {value, updatedAt};
  }
  return result;
};

const readContentSyncValue = (
  entries: Readonly<Partial<Record<string, SyncValueEnvelope>>>,
  key: string,
  emptyValue: StateJsonValue,
): StateJsonValue => {
  const envelope = entries[key];
  if (envelope === undefined || envelope.tombstone === true) return emptyValue;
  return envelope.value;
};

const applyContentSyncEntries = (
  input: Readonly<{
    readonly state: Readonly<UiContentState>;
    readonly entries: Readonly<Partial<Record<string, SyncValueEnvelope>>>;
    readonly workspace: WorkspaceKey;
    readonly onHydrationDiagnostic: ContentHydrationDiagnosticSink;
  }>,
): UiContentState => {
  const {state, entries, workspace, onHydrationDiagnostic} = input;
  const containers: Partial<Record<string, StateJsonValue>> = {};
  const layers: Partial<Record<string, StateJsonValue>> = {};
  for (const displayMode of displayModes) {
    containers[displayMode] = readContentSyncValue(entries, contentSyncKey('containers', displayMode), {});
    layers[displayMode] = readContentSyncValue(entries, contentSyncKey('layers', displayMode), []);
  }
  const withContainers = applyPersistedContentEntries({
    state,
    entries: containers,
    workspace,
    onHydrationDiagnostic,
  });
  return applyPersistedLayerEntries({
    state: withContainers,
    entries: layers,
    workspace,
    onHydrationDiagnostic,
  });
};

const parsePlacement = (value: StateJsonValue): ScreenPlacement | undefined => {
  const record = readObject(value);
  if (record === undefined || !isNonEmptyString(record.partKey)) return undefined;
  if (record.instanceId !== undefined && !isNonEmptyString(record.instanceId)) return undefined;
  if (record.props !== undefined) {
    try {
      assertStateJsonValue(record.props, 'hydrated content.props');
    } catch {
      return undefined;
    }
  }
  return Object.freeze({
    partKey: record.partKey,
    ...(record.instanceId === undefined ? {} : {instanceId: record.instanceId}),
    ...(record.props === undefined ? {} : {props: record.props}),
  });
};

const diagnosticIdentity = (
  record: Record<string, unknown>,
): Readonly<{
  readonly layerId: string | null;
  readonly partKey: string | null;
}> =>
  Object.freeze({
    layerId: isNonEmptyString(record.layerId) ? record.layerId : null,
    partKey: isNonEmptyString(record.partKey) ? record.partKey : null,
  });

type HydrationParseInput = Readonly<{
  readonly workspace: WorkspaceKey;
  readonly displayMode: DisplayMode;
  readonly onHydrationDiagnostic: ContentHydrationDiagnosticSink;
}>;

const reportHydrationDiagnostic = (
  input: HydrationParseInput,
  diagnostic: Readonly<{
    readonly scope: 'layer' | 'container';
    readonly layerId: string | null;
    readonly containerKey: string | null;
    readonly partKey: string | null;
    readonly reason: ContentHydrationDiagnosticReason;
  }>,
): void => {
  input.onHydrationDiagnostic(
    Object.freeze({
      workspace: input.workspace,
      displayMode: input.displayMode,
      ...diagnostic,
    }),
  );
};

const parseContainers = (
  value: StateJsonValue,
  input: HydrationParseInput,
): Readonly<Record<string, ScreenPlacement>> => {
  const record = readObject(value);
  if (record === undefined) {
    reportHydrationDiagnostic(input, {
      scope: 'container',
      layerId: null,
      containerKey: null,
      partKey: null,
      reason: 'hydrated-container-invalid',
    });
    return Object.freeze({});
  }
  const containers: Record<string, ScreenPlacement> = {};
  for (const [containerKey, rawPlacement] of Object.entries(record)) {
    const rawRecord = readObject(rawPlacement);
    const partKey = rawRecord !== undefined && isNonEmptyString(rawRecord.partKey) ? rawRecord.partKey : null;
    if (!isNonEmptyString(containerKey)) {
      reportHydrationDiagnostic(input, {
        scope: 'container',
        layerId: null,
        containerKey: null,
        partKey,
        reason: 'hydrated-container-invalid',
      });
      continue;
    }
    const placement = parsePlacement(rawPlacement as StateJsonValue);
    if (placement === undefined) {
      reportHydrationDiagnostic(input, {
        scope: 'container',
        layerId: null,
        containerKey,
        partKey,
        reason: 'hydrated-container-invalid',
      });
      continue;
    }
    containers[containerKey] = placement;
  }
  return Object.freeze(containers);
};

const parseLayerEntry = (
  value: unknown,
  input: Readonly<{
    readonly workspace: WorkspaceKey;
    readonly displayMode: DisplayMode;
    readonly onHydrationDiagnostic: ContentHydrationDiagnosticSink;
  }>,
): LayerEntry | undefined => {
  const record = readObject(value);
  const persistence = record === undefined ? undefined : readLayerPersistence(record.persistence);
  const identity = record === undefined ? Object.freeze({layerId: null, partKey: null}) : diagnosticIdentity(record);
  if (
    record === undefined ||
    !isNonEmptyString(record.layerId) ||
    !isNonEmptyString(record.partKey) ||
    !isValidOpenedAt(record.openedAt) ||
    hasInvalidOptionalProps(record) ||
    (record.persistence !== undefined && persistence === undefined)
  ) {
    reportHydrationDiagnostic(input, {
      scope: 'layer',
      ...identity,
      containerKey: null,
      reason: 'invalid-entry',
    });
    return undefined;
  }
  if (persistence === 'ephemeral') {
    reportHydrationDiagnostic(input, {
      scope: 'layer',
      ...identity,
      containerKey: null,
      reason: 'ephemeral-entry',
    });
    return undefined;
  }
  const props = readOptionalProps(record);
  return Object.freeze({
    layerId: record.layerId,
    partKey: record.partKey,
    ...(props === undefined ? {} : {props}),
    openedAt: record.openedAt,
    ...(persistence === undefined ? {} : {persistence}),
  });
};

export const parseLayerEntries = (
  value: unknown,
  input: Readonly<{
    readonly workspace: WorkspaceKey;
    readonly displayMode: DisplayMode;
    readonly onHydrationDiagnostic: ContentHydrationDiagnosticSink;
  }>,
): readonly LayerEntry[] => {
  if (!Array.isArray(value)) {
    reportHydrationDiagnostic(input, {
      scope: 'layer',
      layerId: null,
      containerKey: null,
      partKey: null,
      reason: 'invalid-entry',
    });
    return Object.freeze([]);
  }
  const seenLayerIds = new Set<string>();
  const layers: LayerEntry[] = [];
  for (const raw of value) {
    const layer = parseLayerEntry(raw, input);
    if (layer === undefined) continue;
    if (seenLayerIds.has(layer.layerId)) {
      reportHydrationDiagnostic(input, {
        scope: 'layer',
        layerId: layer.layerId,
        containerKey: null,
        partKey: layer.partKey,
        reason: 'duplicate-layer-id',
      });
      continue;
    }
    seenLayerIds.add(layer.layerId);
    layers.push(layer);
  }
  return Object.freeze(layers);
};

const applyPersistedContentEntries = (
  input: Readonly<{
    readonly state: Readonly<UiContentState>;
    readonly entries: Readonly<Partial<Record<string, StateJsonValue>>>;
    readonly workspace: WorkspaceKey;
    readonly onHydrationDiagnostic: ContentHydrationDiagnosticSink;
  }>,
): UiContentState => {
  const {state, entries, workspace, onHydrationDiagnostic} = input;
  const contentSets = {...state.contentSets};
  for (const displayMode of displayModes) {
    const raw = entries[displayMode];
    if (raw === undefined) continue;
    contentSets[displayMode] = Object.freeze({
      ...contentSets[displayMode],
      containers: parseContainers(raw, {workspace, displayMode, onHydrationDiagnostic}),
    });
  }
  return Object.freeze({...state, contentSets: Object.freeze(contentSets)});
};

const applyPersistedLayerEntries = (
  input: Readonly<{
    readonly state: Readonly<UiContentState>;
    readonly entries: Readonly<Partial<Record<string, StateJsonValue>>>;
    readonly workspace: WorkspaceKey;
    readonly onHydrationDiagnostic: ContentHydrationDiagnosticSink;
  }>,
): UiContentState => {
  const {state, entries, workspace, onHydrationDiagnostic} = input;
  const contentSets = {...state.contentSets};
  for (const displayMode of displayModes) {
    const raw = entries[displayMode];
    if (raw === undefined) continue;
    contentSets[displayMode] = Object.freeze({
      ...contentSets[displayMode],
      layers: parseLayerEntries(raw, {workspace, displayMode, onHydrationDiagnostic}),
    });
  }
  return Object.freeze({...state, contentSets: Object.freeze(contentSets)});
};

const createContentDescriptor = (
  input: Readonly<{
    readonly workspace: WorkspaceKey;
    readonly sliceName: string;
    readonly reducer: StateRuntimeSliceDescriptor<UiContentState>['reducer'];
    readonly onHydrationDiagnostic: ContentHydrationDiagnosticSink;
  }>,
): StateRuntimeSliceDescriptor<UiContentState> => {
  const {workspace, sliceName, reducer, onHydrationDiagnostic} = input;
  return {
    name: sliceName,
    reducer,
    persistIntent: 'owner-only',
    persistence: [
      {
        kind: 'record',
        storageKeyPrefix: 'containers',
        getEntries: serializeContentEntries,
        applyEntries: (state, entries) =>
          applyPersistedContentEntries({
            state,
            entries,
            workspace,
            onHydrationDiagnostic,
          }),
      },
      {
        kind: 'record',
        storageKeyPrefix: 'layers',
        getEntries: serializeLayerEntries,
        applyEntries: (state, entries) =>
          applyPersistedLayerEntries({
            state,
            entries,
            workspace,
            onHydrationDiagnostic,
          }),
      },
    ],
    syncIntent: workspace === 'MAIN' ? 'master-to-slave' : 'slave-to-master',
    sync: {
      kind: 'record',
      getEntries: serializeContentSyncEntries,
      applyEntries: (state, entries) =>
        applyContentSyncEntries({
          state,
          entries,
          workspace,
          onHydrationDiagnostic,
        }),
    },
  };
};

export const createContentStateRegistrations = (
  onHydrationDiagnostic: ContentHydrationDiagnosticSink = () => undefined,
): readonly StateRuntimeSliceRegistration[] =>
  toWorkspaceStateDescriptors<UiContentState>({
    baseName: contentBaseName,
    reducers: {
      MAIN: mainContentSlice.reducer,
      BRANCH: branchContentSlice.reducer,
    },
    createDescriptor: (workspace, sliceName, reducer) =>
      createContentDescriptor({
        workspace,
        sliceName,
        reducer,
        onHydrationDiagnostic,
      }),
  });

export const readContentState = (root: StateRoot, workspace: WorkspaceKey): UiContentState => {
  const state = root[contentStateKeys[workspace]];
  if (state === undefined) throw new Error(`Missing ui-state content slice: ${contentStateKeys[workspace]}`);
  return state as UiContentState;
};
