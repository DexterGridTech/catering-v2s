import {
  createAppError,
  createModuleErrorFactory,
  nowTimestampMs,
} from '@catering-v2s/kernel-base-contracts'
import {
  createWorkspaceActionDispatcher,
  type StateJsonValue,
  type WorkspaceKey,
} from '@catering-v2s/kernel-base-state'
import {
  defineActor,
  onCommand,
  selectRuntimeInstanceMode,
  type ActorDefinition,
  type ActorExecutionContext,
} from '@catering-v2s/kernel-base-runtime'
import {
  resolveWorkspace,
  selectDisplayRole,
} from '@catering-v2s/kernel-base-display-context'
import {
  assertStateJsonValue,
  cloneAndFreezeStateJsonValue,
} from '../../foundations/valueValidation'
import {moduleName} from '../../moduleName'
import {
  clearLayersCommand,
  closeLayerCommand,
  openLayerCommand,
  showScreenCommand,
} from '../commands'
import {
  contentActions,
  readContentState,
} from '../../foundations/workspaceSlices'
import {isUiCatalogEntryAvailable} from '../../foundations/catalog'
import type {SurfaceForm, UiCatalog} from '../../types/catalog'
import type {StateRoot} from '@catering-v2s/kernel-base-state'
import {completeUiStateWrite} from './completeWrite'
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context'

type PayloadRecord = Readonly<Record<string, unknown>>

const defineError = createModuleErrorFactory(moduleName)
const layerPartUnavailableErrorDefinition = defineError('layer-part-unavailable', {
  name: 'UI layer part is unavailable for the current surface',
  defaultTemplate: 'UI layer part is unavailable for the current surface',
  category: 'VALIDATION',
  severity: 'LOW',
  code: 'ERR_TER_UI_STATE_LAYER_PART_UNAVAILABLE',
})

const readRecord = (value: unknown): PayloadRecord | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as PayloadRecord
    : undefined

const requireRecord = (value: unknown, commandName: string): PayloadRecord => {
  const record = readRecord(value)
  if (record === undefined) throw new Error(`[ui-state] ${commandName} payload must be an object`)
  return record
}

const requireDisplayMode = (value: unknown, commandName: string): DisplayMode => {
  if (value !== 'PRIMARY' && value !== 'SECONDARY') {
    throw new Error(`[ui-state] ${commandName}.displayMode must be PRIMARY or SECONDARY`)
  }
  return value
}

const requireString = (record: PayloadRecord, key: string, commandName: string): string => {
  const value = record[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`[ui-state] ${commandName}.${key} must be non-empty`)
  }
  return value
}

const readOptionalProps = (record: PayloadRecord, commandName: string): StateJsonValue | undefined => {
  const value = record.props
  if (value === undefined) return undefined
  assertStateJsonValue(value, `[ui-state] ${commandName}.props`)
  return cloneAndFreezeStateJsonValue(value)
}

type NormalizedShowPayload = Readonly<{
  displayMode: DisplayMode
  containerKey: string
  partKey: string
  instanceId?: string
  props?: StateJsonValue
}>

const normalizeShowPayload = (value: unknown): NormalizedShowPayload => {
  const commandName = 'show-screen'
  const record = requireRecord(value, commandName)
  const displayMode = requireDisplayMode(record.displayMode, commandName)
  const containerKey = requireString(record, 'containerKey', commandName)
  const partKey = requireString(record, 'partKey', commandName)
  const instanceId = record.instanceId
  if (instanceId !== undefined && (typeof instanceId !== 'string' || instanceId.trim().length === 0)) {
    throw new Error(`[ui-state] ${commandName}.instanceId must be non-empty when provided`)
  }
  const props = readOptionalProps(record, commandName)
  return Object.freeze({
    displayMode,
    containerKey,
    partKey,
    ...(instanceId === undefined ? {} : {instanceId}),
    ...(props === undefined ? {} : {props}),
  })
}

type NormalizedOpenLayerPayload = Readonly<{
  displayMode: DisplayMode
  layerId: string
  partKey: string
  props?: StateJsonValue
}>

const normalizeOpenLayerPayload = (value: unknown): NormalizedOpenLayerPayload => {
  const commandName = 'open-layer'
  const record = requireRecord(value, commandName)
  const props = readOptionalProps(record, commandName)
  return Object.freeze({
    displayMode: requireDisplayMode(record.displayMode, commandName),
    layerId: requireString(record, 'layerId', commandName),
    partKey: requireString(record, 'partKey', commandName),
    ...(props === undefined ? {} : {props}),
  })
}

type NormalizedCloseLayerPayload = Readonly<{
  displayMode: DisplayMode
  layerId: string
}>

const normalizeCloseLayerPayload = (value: unknown): NormalizedCloseLayerPayload => {
  const commandName = 'close-layer'
  const record = requireRecord(value, commandName)
  return Object.freeze({
    displayMode: requireDisplayMode(record.displayMode, commandName),
    layerId: requireString(record, 'layerId', commandName),
  })
}

const normalizeClearLayersPayload = (value: unknown): Readonly<{displayMode: DisplayMode}> => {
  const commandName = 'clear-layers'
  const record = requireRecord(value, commandName)
  return Object.freeze({displayMode: requireDisplayMode(record.displayMode, commandName)})
}

const currentWorkspace = (context: ActorExecutionContext): WorkspaceKey => {
  const state = context.getState()
  return resolveWorkspace({
    instanceMode: selectRuntimeInstanceMode(state),
    displayRole: selectDisplayRole(state),
  })
}

const currentCatalogContext = (
  state: StateRoot,
  displayMode: DisplayMode,
  selectSurfaceForm: (root: StateRoot) => SurfaceForm,
) => {
  const instanceMode = selectRuntimeInstanceMode(state)
  const displayRole = selectDisplayRole(state)
  return Object.freeze({
    displayMode,
    workspace: resolveWorkspace({instanceMode, displayRole}),
    instanceMode,
    surfaceForm: selectSurfaceForm(state),
  })
}

const createLayerPartUnavailableError = (
  context: ActorExecutionContext,
  input: Readonly<{
    readonly partKey: string
    readonly catalog: UiCatalog
    readonly catalogContext: ReturnType<typeof currentCatalogContext>
  }>,
) => createAppError(layerPartUnavailableErrorDefinition, {
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
})

type ContentAction = ReturnType<typeof contentActions.showScreen>
  | ReturnType<typeof contentActions.openLayer>
  | ReturnType<typeof contentActions.closeLayer>
  | ReturnType<typeof contentActions.clearLayers>

const dispatchContentAction = (
  context: ActorExecutionContext,
  action: ContentAction,
): Readonly<{workspace: WorkspaceKey; changed: boolean}> => {
  const workspace = currentWorkspace(context)
  const before = readContentState(context.getState(), workspace)
  const dispatch = createWorkspaceActionDispatcher({
    routeContext: {workspace},
    dispatch: context.dispatchAction,
  })
  dispatch(action)
  const after = readContentState(context.getState(), workspace)
  return Object.freeze({workspace, changed: after !== before})
}

export const createShowScreenActor = (): ActorDefinition => defineActor(moduleName, 'show-screen', [
  onCommand(showScreenCommand, async context => {
    const payload = normalizeShowPayload(context.command.payload)
    return completeUiStateWrite(context, dispatchContentAction(
      context,
      contentActions.showScreen(payload),
    ), 'content')
  }),
])

export const createOpenLayerActor = (input: Readonly<{
  readonly catalog: UiCatalog
  readonly selectSurfaceForm: (root: StateRoot) => SurfaceForm
}>): ActorDefinition => defineActor(moduleName, 'open-layer', [
  onCommand(openLayerCommand, async context => {
    const payload = normalizeOpenLayerPayload(context.command.payload)
    const state = context.getState()
    const catalogContext = currentCatalogContext(state, payload.displayMode, input.selectSurfaceForm)
    const entry = input.catalog.byPartKey[payload.partKey]
    if (entry === undefined || !isUiCatalogEntryAvailable(entry, null, catalogContext)) {
      throw createLayerPartUnavailableError(context, {
        partKey: payload.partKey,
        catalog: input.catalog,
        catalogContext,
      })
    }
    const workspace = currentWorkspace(context)
    const current = readContentState(context.getState(), workspace)
    if (current.contentSets[payload.displayMode].layers.some(layer => layer.layerId === payload.layerId)) {
      context.platformPorts.logger.warn({
        category: 'ui-state',
        event: 'ui-state.layer.duplicate-rejected',
        message: 'Duplicate UI layer id rejected',
        data: {workspace, displayMode: payload.displayMode, hasLayerId: true},
      })
      throw new Error('[ui-state] duplicate layerId')
    }
    return completeUiStateWrite(context, dispatchContentAction(
      context,
      contentActions.openLayer(Object.freeze({
        ...payload,
        openedAt: nowTimestampMs(),
      })),
    ), 'content')
  }),
])

export const createCloseLayerActor = (): ActorDefinition => defineActor(moduleName, 'close-layer', [
  onCommand(closeLayerCommand, async context => {
    const payload = normalizeCloseLayerPayload(context.command.payload)
    return completeUiStateWrite(context, dispatchContentAction(
      context,
      contentActions.closeLayer(payload),
    ), 'content')
  }),
])

export const createClearLayersActor = (): ActorDefinition => defineActor(moduleName, 'clear-layers', [
  onCommand(clearLayersCommand, async context => {
    const payload = normalizeClearLayersPayload(context.command.payload)
    return completeUiStateWrite(context, dispatchContentAction(
      context,
      contentActions.clearLayers(payload),
    ), 'content')
  }),
])
