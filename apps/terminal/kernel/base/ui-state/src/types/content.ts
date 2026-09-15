import type {TimestampMs} from '@catering-v2s/kernel-base-contracts'
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import type {ContainerKey, PartKey} from './catalog'

export type ScreenPlacement = Readonly<{
  readonly partKey: PartKey
  readonly instanceId?: string
  readonly props?: StateJsonValue
}>

export type LayerEntry = Readonly<{
  readonly layerId: string
  readonly partKey: PartKey
  readonly props?: StateJsonValue
  readonly openedAt: TimestampMs
  /** Omitted legacy values are durable; ephemeral entries never hydrate. */
  readonly persistence?: 'durable' | 'ephemeral'
}>

export type ContentSet = Readonly<{
  readonly containers: Readonly<Record<ContainerKey, ScreenPlacement>>
  readonly layers: readonly LayerEntry[]
}>

export type UiContentState = Readonly<{
  readonly contentSets: Readonly<Record<DisplayMode, ContentSet>>
}>
