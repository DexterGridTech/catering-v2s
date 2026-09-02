import type {DisplayMode} from '@catering-v2s/kernel-base-display-context'
import type {RuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime'
import type {WorkspaceKey} from '@catering-v2s/kernel-base-state'
import {assertNonEmptyString} from './assertNonEmptyString'
import type {
  ContainerKey,
  PartKey,
  UiCatalog,
  UiCatalogContext,
  UiCatalogEntry,
} from '../types/catalog'

const displayModes = ['PRIMARY', 'SECONDARY'] as const satisfies readonly DisplayMode[]
const workspaces = ['MAIN', 'BRANCH'] as const satisfies readonly WorkspaceKey[]
const instanceModes = ['MASTER', 'SLAVE'] as const satisfies readonly RuntimeInstanceMode[]
const approvedEntryKeys = [
  'partKey',
  'rendererKey',
  'containerKey',
  'displayModes',
  'workspaces',
  'instanceModes',
  'title',
  'description',
] as const

const assertClosedArray = <TValue extends string>(
  value: unknown,
  label: string,
  allowed: readonly TValue[],
): readonly TValue[] => {
  if (!Array.isArray(value) || value.length === 0 || Object.getOwnPropertySymbols(value).length > 0) {
    throw new Error(`[ui-state] ${label} must be a non-empty closed array`)
  }
  const result: TValue[] = []
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index]
    if (typeof item !== 'string' || !allowed.includes(item as TValue)) {
      throw new Error(`[ui-state] ${label} contains an invalid value`)
    }
    if (result.includes(item as TValue)) throw new Error(`[ui-state] ${label} contains a duplicate value`)
    result.push(item as TValue)
  }
  return Object.freeze(result)
}

const assertEntryKeys = (entry: object): void => {
  const actual = Reflect.ownKeys(entry)
  if (actual.length !== approvedEntryKeys.length || approvedEntryKeys.some(key => !actual.includes(key))) {
    throw new Error('[ui-state] catalog entry own keys must equal the approved field set')
  }
  for (const key of approvedEntryKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(entry, key)
    if (descriptor === undefined || !('value' in descriptor)) {
      throw new Error(`[ui-state] catalog entry field must be a data property: ${key}`)
    }
  }
}

const canonicalEntry = (raw: UiCatalogEntry): UiCatalogEntry => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('[ui-state] catalog entry must be an object')
  }
  assertEntryKeys(raw)
  assertNonEmptyString(raw.partKey, 'ui-state', 'catalog.partKey')
  assertNonEmptyString(raw.rendererKey, 'ui-state', 'catalog.rendererKey')
  assertNonEmptyString(raw.containerKey, 'ui-state', 'catalog.containerKey')
  assertNonEmptyString(raw.title, 'ui-state', 'catalog.title')
  assertNonEmptyString(raw.description, 'ui-state', 'catalog.description')
  const result: UiCatalogEntry = {
    partKey: raw.partKey,
    rendererKey: raw.rendererKey,
    containerKey: raw.containerKey,
    displayModes: assertClosedArray(raw.displayModes, 'catalog.displayModes', displayModes),
    workspaces: assertClosedArray(raw.workspaces, 'catalog.workspaces', workspaces),
    instanceModes: assertClosedArray(raw.instanceModes, 'catalog.instanceModes', instanceModes),
    title: raw.title,
    description: raw.description,
  }
  return Object.freeze(result)
}

const createIndex = (entries: readonly UiCatalogEntry[]): Readonly<Record<PartKey, UiCatalogEntry>> => {
  const index: Record<PartKey, UiCatalogEntry> = {}
  for (const entry of entries) {
    Object.defineProperty(index, entry.partKey, {
      configurable: false,
      enumerable: true,
      value: entry,
      writable: false,
    })
  }
  return Object.freeze(index)
}

export const createUiCatalog = (entries: readonly UiCatalogEntry[]): UiCatalog => {
  if (!Array.isArray(entries)) throw new Error('[ui-state] catalog entries must be an array')
  const canonical: UiCatalogEntry[] = []
  const keys = new Set<string>()
  for (const entry of entries) {
    const next = canonicalEntry(entry)
    if (keys.has(next.partKey)) throw new Error(`[ui-state] duplicate partKey: ${next.partKey}`)
    keys.add(next.partKey)
    canonical.push(next)
  }
  const frozenEntries = Object.freeze(canonical)
  return Object.freeze({entries: frozenEntries, byPartKey: createIndex(frozenEntries)})
}

export const selectAvailableParts = (
  catalog: UiCatalog,
  containerKey: ContainerKey,
  context: UiCatalogContext,
): readonly UiCatalogEntry[] => {
  assertNonEmptyString(containerKey, 'ui-state', 'catalog.containerKey')
  if (!displayModes.includes(context.displayMode)) throw new Error('[ui-state] invalid catalog displayMode')
  if (!workspaces.includes(context.workspace)) throw new Error('[ui-state] invalid catalog workspace')
  if (!instanceModes.includes(context.instanceMode)) throw new Error('[ui-state] invalid catalog instanceMode')
  return Object.freeze(catalog.entries.filter(entry =>
    entry.containerKey === containerKey
      && entry.displayModes.includes(context.displayMode)
      && entry.workspaces.includes(context.workspace)
      && entry.instanceModes.includes(context.instanceMode),
  ))
}
