import type {DisplayMode} from '@catering-v2s/kernel-base-display-context'
import type {RuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime'
import type {WorkspaceKey} from '@catering-v2s/kernel-base-state'
import {assertNonEmptyString} from './assertNonEmptyString'
import type {
  ContainerKey,
  PartKey,
  SurfaceForm,
  UiCatalog,
  UiCatalogContext,
  UiCatalogEntry,
} from '../types/catalog'

const displayModes = ['PRIMARY', 'SECONDARY'] as const satisfies readonly DisplayMode[]
const workspaces = ['MAIN', 'BRANCH'] as const satisfies readonly WorkspaceKey[]
const instanceModes = ['MASTER', 'SLAVE'] as const satisfies readonly RuntimeInstanceMode[]
const surfaceForms = ['laptop', 'mobile'] as const satisfies readonly SurfaceForm[]
const approvedEntryKeys = [
  'partKey',
  'rendererKey',
  'containerKeys',
  'displayModes',
  'workspaces',
  'instanceModes',
  'surfaceForm',
  'title',
  'description',
] as const

const assertStringArray = (
  value: unknown,
  label: string,
  allowEmpty: boolean,
): readonly string[] => {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || Object.getOwnPropertySymbols(value).length > 0) {
    throw new Error(`[ui-state] ${label} must be a ${allowEmpty ? '' : 'non-empty '}array`)
  }
  const result: string[] = []
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index]
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new Error(`[ui-state] ${label} contains an invalid value`)
    }
    if (result.includes(item)) throw new Error(`[ui-state] ${label} contains a duplicate value`)
    result.push(item)
  }
  return Object.freeze(result)
}

const assertClosedArray = <TValue extends string>(
  value: unknown,
  label: string,
  allowed: readonly TValue[],
): readonly TValue[] => {
  const result = assertStringArray(value, label, false)
  for (const item of result) {
    if (!allowed.includes(item as TValue)) {
      throw new Error(`[ui-state] ${label} contains an invalid value`)
    }
  }
  return result as readonly TValue[]
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
  assertNonEmptyString(raw.title, 'ui-state', 'catalog.title')
  assertNonEmptyString(raw.description, 'ui-state', 'catalog.description')
  const result: UiCatalogEntry = {
    partKey: raw.partKey,
    rendererKey: raw.rendererKey,
    // An empty container list intentionally means layer-only: the part is not eligible for screen enumeration.
    containerKeys: assertStringArray(raw.containerKeys, 'catalog.containerKeys', true),
    displayModes: assertClosedArray(raw.displayModes, 'catalog.displayModes', displayModes),
    workspaces: assertClosedArray(raw.workspaces, 'catalog.workspaces', workspaces),
    instanceModes: assertClosedArray(raw.instanceModes, 'catalog.instanceModes', instanceModes),
    surfaceForm: assertClosedArray(raw.surfaceForm, 'catalog.surfaceForm', surfaceForms),
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
  containerKey: ContainerKey | null,
  context: UiCatalogContext,
): readonly UiCatalogEntry[] => {
  if (containerKey !== null) assertNonEmptyString(containerKey, 'ui-state', 'catalog.containerKey')
  if (!displayModes.includes(context.displayMode)) throw new Error('[ui-state] invalid catalog displayMode')
  if (!workspaces.includes(context.workspace)) throw new Error('[ui-state] invalid catalog workspace')
  if (!instanceModes.includes(context.instanceMode)) throw new Error('[ui-state] invalid catalog instanceMode')
  if (!surfaceForms.includes(context.surfaceForm)) throw new Error('[ui-state] invalid catalog surfaceForm')
  return Object.freeze(catalog.entries.filter(entry => isUiCatalogEntryAvailable(entry, containerKey, context)))
}

export const isUiCatalogEntryAvailable = (
  entry: UiCatalogEntry,
  containerKey: ContainerKey | null,
  context: UiCatalogContext,
): boolean => {
  if (containerKey !== null) assertNonEmptyString(containerKey, 'ui-state', 'catalog.containerKey')
  if (!displayModes.includes(context.displayMode)) throw new Error('[ui-state] invalid catalog displayMode')
  if (!workspaces.includes(context.workspace)) throw new Error('[ui-state] invalid catalog workspace')
  if (!instanceModes.includes(context.instanceMode)) throw new Error('[ui-state] invalid catalog instanceMode')
  if (!surfaceForms.includes(context.surfaceForm)) throw new Error('[ui-state] invalid catalog surfaceForm')
  const placementMatches = containerKey === null
    ? entry.containerKeys.length === 0
    : entry.containerKeys.includes(containerKey)
  return placementMatches
    && entry.displayModes.includes(context.displayMode)
    && entry.workspaces.includes(context.workspace)
    && entry.instanceModes.includes(context.instanceMode)
    && entry.surfaceForm.includes(context.surfaceForm)
}
