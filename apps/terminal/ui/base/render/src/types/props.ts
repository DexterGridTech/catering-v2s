import type {ReactNode} from 'react'
import type {LoggerPort} from '@catering-v2s/kernel-base-platform-ports'
import type {Runtime, RuntimeStatus} from '@catering-v2s/kernel-base-runtime'
import type {
  ContainerKey,
  DisplayMode,
  UiCatalog,
} from '@catering-v2s/kernel-base-ui-state'
import type {RendererCatalog} from './catalog'

type RuntimeStateRoot = ReturnType<Runtime['getState']>

type RenderStateSource = Readonly<{
  readonly getStatus: () => RuntimeStatus
  readonly getState: () => RuntimeStateRoot
  readonly subscribe: (listener: () => void) => () => void
}>

export type SurfaceRootProps = Readonly<{
  readonly displayMode: DisplayMode
  readonly containerKey: ContainerKey
  readonly children?: ReactNode
}>

export type RenderProviderProps = Readonly<{
  readonly stateSource: RenderStateSource
  readonly uiCatalog: UiCatalog
  readonly rendererCatalog: RendererCatalog
  readonly logger: LoggerPort
  readonly children?: ReactNode
}>
