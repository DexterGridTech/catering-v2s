import type {CommandIntent} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import {selectAvailableParts, type UiCatalog, type UiCatalogContext, type UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import {
  ADMIN_DISPLAY_CONTEXT_RAW_PART_KEY,
  ADMIN_PLATFORM_PORTS_PAGE_PART_KEY,
  ADMIN_RUNTIME_PAGE_PART_KEY,
  ADMIN_SECTION_CONTAINER_KEY,
  ADMIN_TOPOLOGY_SECTION_PART_KEY,
} from './adminIdentity'

export type AdminPageKey = 'platform-ports' | 'runtime' | 'topology'

export type AdminPageSpec = Readonly<{
  readonly key: AdminPageKey
  readonly title: string
  readonly sourcePartKeys: readonly string[]
  readonly rendererKey: string
}>

export type AdminPageProjection = Readonly<{
  readonly pageKey: AdminPageKey | undefined
  readonly entry: UiCatalogEntry
  readonly spec: AdminPageSpec | undefined
}>

const canonicalPageTemplates: readonly Readonly<{
  readonly key: AdminPageKey
  readonly title: string
  readonly sourcePartKeys: readonly string[]
}>[] = [
  Object.freeze({key: 'platform-ports', title: '平台端口', sourcePartKeys: Object.freeze([ADMIN_PLATFORM_PORTS_PAGE_PART_KEY])}),
  Object.freeze({key: 'runtime', title: '运行状态', sourcePartKeys: Object.freeze([ADMIN_RUNTIME_PAGE_PART_KEY, ADMIN_DISPLAY_CONTEXT_RAW_PART_KEY])}),
  Object.freeze({key: 'topology', title: '双机拓扑', sourcePartKeys: Object.freeze([ADMIN_TOPOLOGY_SECTION_PART_KEY])}),
]

const specFor = (template: typeof canonicalPageTemplates[number], entry: UiCatalogEntry): AdminPageSpec => Object.freeze({
  key: template.key,
  title: template.title,
  sourcePartKeys: template.sourcePartKeys,
  rendererKey: entry.rendererKey,
})

export const selectAdminPageProjections = (
  entries: readonly UiCatalogEntry[],
): readonly AdminPageProjection[] => {
  const byPartKey = new Map(entries.map(entry => [entry.partKey, entry] as const))
  const pages: AdminPageProjection[] = []

  for (const template of canonicalPageTemplates) {
    const entry = template.sourcePartKeys.map(rawKey => byPartKey.get(rawKey)).find((candidate): candidate is UiCatalogEntry => candidate !== undefined)
    if (entry === undefined) continue
    pages.push(Object.freeze({pageKey: template.key, entry, spec: specFor(template, entry)}))
  }

  return Object.freeze(pages)
}

export const selectAdminSections = (
  catalog: UiCatalog,
  context: UiCatalogContext,
): readonly UiCatalogEntry[] => selectAdminPageProjections(
  selectAvailableParts(catalog, ADMIN_SECTION_CONTAINER_KEY, context),
).map(page => page.entry)

export class AdminNavigationRejectedError extends Error {
  readonly code = 'admin-navigation-rejected' as const
  readonly commandName: string

  constructor(commandName: string) {
    super(`[ui-base-admin-shell] navigation command rejected: ${commandName}`)
    this.name = 'AdminNavigationRejectedError'
    this.commandName = commandName
  }
}

export type AdminSectionCommandBoundary = Readonly<{
  readonly dispatch: <TPayload extends StateJsonValue>(command: CommandIntent<TPayload>) => Promise<never>
}>

export const createAdminSectionCommandBoundary = (): AdminSectionCommandBoundary => Object.freeze({
  dispatch: async <TPayload extends StateJsonValue>(command: CommandIntent<TPayload>): Promise<never> => {
    throw new AdminNavigationRejectedError(command.definition.commandName)
  },
})
