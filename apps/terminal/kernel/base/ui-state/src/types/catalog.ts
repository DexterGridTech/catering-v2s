import type {DisplayMode, DisplayRole} from '@catering-v2s/kernel-base-display-context'
import type {RuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime'
import type {WorkspaceKey} from '@catering-v2s/kernel-base-state'

export type ContainerKey = string
export type PartKey = string

export type UiCatalogEntry = Readonly<{
  readonly partKey: PartKey
  readonly rendererKey: string
  readonly containerKeys: readonly ContainerKey[]
  readonly displayModes: readonly DisplayMode[]
  readonly workspaces: readonly WorkspaceKey[]
  readonly instanceModes: readonly RuntimeInstanceMode[]
  readonly title: string
  readonly description: string
}>

export type UiCatalog = Readonly<{
  readonly entries: readonly UiCatalogEntry[]
  readonly byPartKey: Readonly<Record<PartKey, UiCatalogEntry>>
}>

export type UiCatalogContext = Readonly<{
  readonly displayMode: DisplayMode
  readonly workspace: WorkspaceKey
  readonly instanceMode: RuntimeInstanceMode
}>
