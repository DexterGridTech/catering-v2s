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
import {
  readVariableState,
  type VariableStateFamily,
} from '../../foundations/variableSlices'
import {moduleName} from '../../moduleName'
import {
  clearUiVariablesCommand,
  setUiVariablesCommand,
} from '../commands'
import {completeUiStateWrite} from './completeWrite'
import type {UiVariableDeclaration, UiVariableWrite} from '../../types/variable'

type PayloadRecord = Readonly<Record<string, unknown>>
type VariableRegistry = ReadonlyMap<string, UiVariableDeclaration<StateJsonValue>>

const readRecord = (value: unknown): PayloadRecord | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as PayloadRecord
    : undefined

const requireRecord = (value: unknown, commandName: string): PayloadRecord => {
  const record = readRecord(value)
  if (record === undefined) throw new Error(`[ui-state] ${commandName} payload must be an object`)
  return record
}

const requireExactKeys = (value: object, keys: readonly string[], label: string): void => {
  const actual = Reflect.ownKeys(value)
  if (actual.length !== keys.length || keys.some(key => !actual.includes(key))) {
    throw new Error(`[ui-state] ${label} fields are invalid`)
  }
}

const currentWorkspace = (context: ActorExecutionContext): WorkspaceKey => {
  const state = context.getState()
  return resolveWorkspace({
    instanceMode: selectRuntimeInstanceMode(state),
    displayRole: selectDisplayRole(state),
  })
}

const normalizeSetPayload = (
  value: unknown,
  registry: VariableRegistry,
): Readonly<{readonly entries: readonly UiVariableWrite<StateJsonValue>[]}> => {
  const record = requireRecord(value, 'set-ui-variables')
  requireExactKeys(record, ['entries'], 'set-ui-variables')
  if (!Array.isArray(record.entries)) throw new Error('[ui-state] set-ui-variables.entries must be an array')
  const seen = new Set<string>()
  const entries: UiVariableWrite<StateJsonValue>[] = []
  for (const rawEntry of record.entries) {
    const entry = readRecord(rawEntry)
    if (entry === undefined) throw new Error('[ui-state] set-ui-variables entry must be an object')
    requireExactKeys(entry, ['key', 'value'], 'set-ui-variables entry')
    if (typeof entry.key !== 'string' || entry.key.trim().length === 0) {
      throw new Error('[ui-state] set-ui-variables entry key must be non-empty')
    }
    if (!registry.has(entry.key)) throw new Error(`[ui-state] unknown ui variable: ${entry.key}`)
    if (seen.has(entry.key)) throw new Error(`[ui-state] duplicate ui variable: ${entry.key}`)
    seen.add(entry.key)
    assertStateJsonValue(entry.value, `[ui-state] set-ui-variables.${entry.key}`)
    entries.push(Object.freeze({
      key: entry.key,
      value: cloneAndFreezeStateJsonValue(entry.value),
    }))
  }
  return Object.freeze({entries: Object.freeze(entries)})
}

const normalizeClearPayload = (
  value: unknown,
  registry: VariableRegistry,
): Readonly<{readonly keys: readonly string[]}> => {
  const record = requireRecord(value, 'clear-ui-variables')
  requireExactKeys(record, ['keys'], 'clear-ui-variables')
  if (!Array.isArray(record.keys)) throw new Error('[ui-state] clear-ui-variables.keys must be an array')
  const seen = new Set<string>()
  const keys: string[] = []
  for (const key of record.keys) {
    if (typeof key !== 'string' || key.trim().length === 0) {
      throw new Error('[ui-state] clear-ui-variables key must be non-empty')
    }
    if (!registry.has(key)) throw new Error(`[ui-state] unknown ui variable: ${key}`)
    if (seen.has(key)) throw new Error(`[ui-state] duplicate ui variable: ${key}`)
    seen.add(key)
    keys.push(key)
  }
  return Object.freeze({keys: Object.freeze(keys)})
}

type VariableAction = ReturnType<VariableStateFamily['actions']['setUiVariables']>
  | ReturnType<VariableStateFamily['actions']['clearUiVariables']>

const dispatchVariableAction = (
  context: ActorExecutionContext,
  family: VariableStateFamily,
  action: VariableAction,
): Readonly<{readonly workspace: WorkspaceKey; readonly changed: boolean}> => {
  const workspace = currentWorkspace(context)
  const before = readVariableState(context.getState(), family.stateKeys, workspace)
  const dispatch = createWorkspaceActionDispatcher({
    routeContext: {workspace},
    dispatch: context.dispatchAction,
  })
  dispatch(action)
  const after = readVariableState(context.getState(), family.stateKeys, workspace)
  return Object.freeze({workspace, changed: after !== before})
}

export const createSetUiVariablesActor = (
  registry: VariableRegistry,
  family: VariableStateFamily,
): ActorDefinition => defineActor(moduleName, 'set-ui-variables', [
  onCommand(setUiVariablesCommand, async context => {
    const payload = normalizeSetPayload(context.command.payload, registry)
    return completeUiStateWrite(
      context,
      dispatchVariableAction(context, family, family.actions.setUiVariables(payload)),
      'variables',
    )
  }),
])

export const createClearUiVariablesActor = (
  registry: VariableRegistry,
  family: VariableStateFamily,
): ActorDefinition => defineActor(moduleName, 'clear-ui-variables', [
  onCommand(clearUiVariablesCommand, async context => {
    const payload = normalizeClearPayload(context.command.payload, registry)
    return completeUiStateWrite(
      context,
      dispatchVariableAction(context, family, family.actions.clearUiVariables(payload)),
      'variables',
    )
  }),
])
