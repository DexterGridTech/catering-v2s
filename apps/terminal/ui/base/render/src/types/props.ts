import type {ReactNode} from 'react'
import type {LoggerPort} from '@catering-v2s/kernel-base-platform-ports'
import type {
  CommandDispatchOptions,
  CommandDispatchResult,
  CommandIntent,
  RuntimeStatus,
} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import type {
  ContainerKey,
  DisplayMode,
  UiCatalog,
  UiVariableDeclaration,
} from '@catering-v2s/kernel-base-ui-state'
import type {RendererCatalog} from './catalog'

// Keep this toolkit boundary structural: render consumes a read-only root
// snapshot and must not import or retain the complete Runtime handle.
type RenderStateRoot = Readonly<Record<string, object | undefined>>

type RenderStateSource = Readonly<{
  readonly getStatus: () => RuntimeStatus
  readonly getState: () => RenderStateRoot
  readonly subscribe: (listener: () => void) => () => void
}>

type RenderDispatchOptions = Readonly<{
  readonly requestId: NonNullable<CommandDispatchOptions['requestId']>
}>

type RenderDispatchCommand = <TPayload extends StateJsonValue>(
  command: CommandIntent<TPayload>,
  options: RenderDispatchOptions,
) => Promise<CommandDispatchResult>

type RenderUiVariableReader = <TValue extends StateJsonValue>(
  root: RenderStateRoot,
  declaration: UiVariableDeclaration<TValue>,
) => TValue

export type SurfaceRootProps = Readonly<{
  readonly displayMode: DisplayMode
  readonly containerKey: ContainerKey
  readonly children?: ReactNode
  readonly renderContentFrame?: (frame: SurfaceRootContentFrame) => ReactNode
}>

export type SurfaceRootContentFrame = Readonly<{
  readonly content: ReactNode
}>

export type RenderProviderProps = Readonly<{
  readonly stateSource: RenderStateSource
  readonly uiCatalog: UiCatalog
  readonly rendererCatalog: RendererCatalog
  readonly logger: LoggerPort
  readonly dispatchCommand: RenderDispatchCommand
  readonly selectUiVariable: RenderUiVariableReader
  readonly children?: ReactNode
}>
