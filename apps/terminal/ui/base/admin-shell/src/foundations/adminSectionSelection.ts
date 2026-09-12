import type {CommandIntent} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import {selectAvailableParts, type UiCatalog, type UiCatalogContext, type UiCatalogEntry} from '@catering-v2s/kernel-base-ui-state'
import {ADMIN_SECTION_CONTAINER_KEY} from './adminIdentity'

export const selectAdminSections = (
  catalog: UiCatalog,
  context: UiCatalogContext,
): readonly UiCatalogEntry[] => selectAvailableParts(catalog, ADMIN_SECTION_CONTAINER_KEY, context)

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
