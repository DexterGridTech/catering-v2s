import {createSlice, type PayloadAction, type UnknownAction} from '@reduxjs/toolkit'
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context'
import {
  createWorkspaceStateKeys,
  toWorkspaceStateDescriptors,
  type StateJsonObject,
  type StateJsonValue,
  type StateRoot,
  type StateRuntimeSliceDescriptor,
  type StateRuntimeSliceRegistration,
  type WorkspaceKey,
} from '@catering-v2s/kernel-base-state'
import {moduleName} from '../moduleName'
import {
  assertStateJsonValue,
  cloneAndFreezeStateJsonValue,
} from './valueValidation'
import type {
  LayerEntry,
  ScreenPlacement,
  UiContentState,
} from '../types/content'

const contentBaseName = `${moduleName}.content`
const displayModes: readonly DisplayMode[] = ['PRIMARY', 'SECONDARY']

export const contentStateKeys = createWorkspaceStateKeys(contentBaseName)

const isDisplayMode = (value: unknown): value is DisplayMode =>
  value === 'PRIMARY' || value === 'SECONDARY'

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const readObject = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined

const readOptionalProps = (
  record: Record<string, unknown>,
): StateJsonValue | undefined => {
  const value = record.props
  if (value === undefined) return undefined
  try {
    assertStateJsonValue(value, 'content.props')
    return cloneAndFreezeStateJsonValue(value)
  } catch (_error) {
    return undefined
  }
}

const hasInvalidOptionalProps = (record: Record<string, unknown>): boolean =>
  record.props !== undefined && readOptionalProps(record) === undefined

const createInitialContentState = (): UiContentState => ({
  contentSets: {
    PRIMARY: {containers: {}, layers: []},
    SECONDARY: {containers: {}, layers: []},
  },
})

const readShowPayload = (value: unknown): Readonly<{
  displayMode: DisplayMode
  containerKey: string
  placement: ScreenPlacement
}> | undefined => {
  const record = readObject(value)
  if (record === undefined
    || !isDisplayMode(record.displayMode)
    || !isNonEmptyString(record.containerKey)
    || !isNonEmptyString(record.partKey)
    || hasInvalidOptionalProps(record)
    || (record.instanceId !== undefined && !isNonEmptyString(record.instanceId))) {
    return undefined
  }
  const props = readOptionalProps(record)
  const placement: ScreenPlacement = Object.freeze({
    partKey: record.partKey,
    ...(record.instanceId === undefined ? {} : {instanceId: record.instanceId}),
    ...(props === undefined ? {} : {props}),
  })
  return Object.freeze({
    displayMode: record.displayMode,
    containerKey: record.containerKey,
    placement,
  })
}

const readOpenLayerPayload = (value: unknown): Readonly<{
  displayMode: DisplayMode
  layer: LayerEntry
}> | undefined => {
  const record = readObject(value)
  if (record === undefined
    || !isDisplayMode(record.displayMode)
    || !isNonEmptyString(record.layerId)
    || !isNonEmptyString(record.partKey)
    || typeof record.openedAt !== 'number'
    || !Number.isFinite(record.openedAt)
    || hasInvalidOptionalProps(record)) {
    return undefined
  }
  const props = readOptionalProps(record)
  const layer: LayerEntry = Object.freeze({
    layerId: record.layerId,
    partKey: record.partKey,
    ...(props === undefined ? {} : {props}),
    openedAt: record.openedAt,
  })
  return Object.freeze({displayMode: record.displayMode, layer})
}

const readCloseLayerPayload = (value: unknown): Readonly<{
  displayMode: DisplayMode
  layerId: string
}> | undefined => {
  const record = readObject(value)
  if (record === undefined || !isDisplayMode(record.displayMode) || !isNonEmptyString(record.layerId)) {
    return undefined
  }
  return Object.freeze({displayMode: record.displayMode, layerId: record.layerId})
}

const readClearLayersPayload = (value: unknown): Readonly<{displayMode: DisplayMode}> | undefined => {
  const record = readObject(value)
  return record !== undefined && isDisplayMode(record.displayMode)
    ? Object.freeze({displayMode: record.displayMode})
    : undefined
}

type MutableContentState = {
  contentSets: Record<DisplayMode, {
    containers: Record<string, ScreenPlacement>
    layers: LayerEntry[]
  }>
}

type ContentCaseReducers = {
  readonly showScreen: (state: MutableContentState, action: PayloadAction<unknown>) => void
  readonly openLayer: (state: MutableContentState, action: PayloadAction<unknown>) => void
  readonly closeLayer: (state: MutableContentState, action: PayloadAction<unknown>) => void
  readonly clearLayers: (state: MutableContentState, action: PayloadAction<unknown>) => void
}

const createContentReducers = (): ContentCaseReducers => ({
  showScreen: (state, action): void => {
    const payload = readShowPayload(action.payload)
    if (payload === undefined) return
    state.contentSets[payload.displayMode].containers[payload.containerKey] = payload.placement
  },
  openLayer: (state, action): void => {
    const payload = readOpenLayerPayload(action.payload)
    if (payload === undefined) return
    const contentSet = state.contentSets[payload.displayMode]
    if (contentSet.layers.some(layer => layer.layerId === payload.layer.layerId)) return
    contentSet.layers.push(payload.layer)
  },
  closeLayer: (state, action): void => {
    const payload = readCloseLayerPayload(action.payload)
    if (payload === undefined) return
    const contentSet = state.contentSets[payload.displayMode]
    const index = contentSet.layers.findIndex(layer => layer.layerId === payload.layerId)
    if (index < 0) return
    contentSet.layers.splice(index, 1)
  },
  clearLayers: (state, action): void => {
    const payload = readClearLayersPayload(action.payload)
    if (payload === undefined) return
    const contentSet = state.contentSets[payload.displayMode]
    contentSet.layers.splice(0, contentSet.layers.length)
  },
})

type GeneratedContentActionCreator = (payload: unknown) => UnknownAction
type GeneratedContentSlice = Readonly<{
  reducer: (state: UiContentState | undefined, action: UnknownAction) => UiContentState
  actions: Readonly<Record<string, GeneratedContentActionCreator>>
}>
type CreateContentSliceInput = Readonly<{
  name: string
  initialState: UiContentState
  reducers: ContentCaseReducers
}>

const createTypedSlice = createSlice as (input: CreateContentSliceInput) => GeneratedContentSlice

const createContentSlice = (name: string): GeneratedContentSlice => createTypedSlice({
  name,
  initialState: createInitialContentState(),
  reducers: createContentReducers(),
})

const canonicalContentSlice = createContentSlice(contentBaseName)
const mainContentSlice = createContentSlice(contentStateKeys.MAIN)
const branchContentSlice = createContentSlice(contentStateKeys.BRANCH)

export const contentActions = canonicalContentSlice.actions

const serializePlacement = (placement: ScreenPlacement): StateJsonObject => {
  const result: Record<string, StateJsonValue> = {partKey: placement.partKey}
  if (placement.instanceId !== undefined) result.instanceId = placement.instanceId
  if (placement.props !== undefined) result.props = placement.props
  return result
}

const serializeContainers = (
  containers: Readonly<Record<string, ScreenPlacement>>,
): StateJsonObject => {
  const result: Record<string, StateJsonValue> = {}
  for (const [containerKey, placement] of Object.entries(containers)) {
    result[containerKey] = serializePlacement(placement)
  }
  return result
}

const serializeContentEntries = (
  state: Readonly<UiContentState>,
): Readonly<Partial<Record<string, StateJsonValue>>> => ({
  PRIMARY: serializeContainers(state.contentSets.PRIMARY.containers),
  SECONDARY: serializeContainers(state.contentSets.SECONDARY.containers),
})

const parsePlacement = (value: StateJsonValue): ScreenPlacement | undefined => {
  const record = readObject(value)
  if (record === undefined || !isNonEmptyString(record.partKey)) return undefined
  if (record.instanceId !== undefined && !isNonEmptyString(record.instanceId)) return undefined
  if (record.props !== undefined) {
    try {
      assertStateJsonValue(record.props, 'hydrated content.props')
    } catch (_error) {
      return undefined
    }
  }
  return Object.freeze({
    partKey: record.partKey,
    ...(record.instanceId === undefined ? {} : {instanceId: record.instanceId}),
    ...(record.props === undefined ? {} : {props: record.props}),
  })
}

const parseContainers = (value: StateJsonValue): Readonly<Record<string, ScreenPlacement>> => {
  const record = readObject(value)
  if (record === undefined) return Object.freeze({})
  const containers: Record<string, ScreenPlacement> = {}
  for (const [containerKey, rawPlacement] of Object.entries(record)) {
    if (!isNonEmptyString(containerKey)) continue
    const placement = parsePlacement(rawPlacement as StateJsonValue)
    if (placement !== undefined) containers[containerKey] = placement
  }
  return Object.freeze(containers)
}

const applyPersistedContentEntries = (
  state: Readonly<UiContentState>,
  entries: Readonly<Partial<Record<string, StateJsonValue>>>,
): UiContentState => {
  const contentSets = {...state.contentSets}
  for (const displayMode of displayModes) {
    const raw = entries[displayMode]
    if (raw === undefined) continue
    contentSets[displayMode] = Object.freeze({
      ...contentSets[displayMode],
      containers: parseContainers(raw),
    })
  }
  return Object.freeze({...state, contentSets: Object.freeze(contentSets)})
}

const createContentDescriptor = (
  _workspace: WorkspaceKey,
  sliceName: string,
  reducer: StateRuntimeSliceDescriptor<UiContentState>['reducer'],
): StateRuntimeSliceDescriptor<UiContentState> => ({
  name: sliceName,
  reducer,
  persistIntent: 'owner-only',
  persistence: [
    {
      kind: 'record',
      storageKeyPrefix: 'containers',
      getEntries: serializeContentEntries,
      applyEntries: applyPersistedContentEntries,
    },
  ],
  syncIntent: 'isolated',
})

export const contentStateRegistrations: readonly StateRuntimeSliceRegistration[] =
  toWorkspaceStateDescriptors<UiContentState>({
    baseName: contentBaseName,
    reducers: {
      MAIN: mainContentSlice.reducer,
      BRANCH: branchContentSlice.reducer,
    },
    createDescriptor: createContentDescriptor,
  })

export const readContentState = (
  root: StateRoot,
  workspace: WorkspaceKey,
): UiContentState => {
  const state = root[contentStateKeys[workspace]]
  if (state === undefined) throw new Error(`Missing ui-state content slice: ${contentStateKeys[workspace]}`)
  return state as UiContentState
}
