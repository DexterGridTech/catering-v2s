import type {ReactNode} from 'react';
import type {CommandRouteContext, TopologyAdminCapability} from '@catering-v2s/kernel-base-contracts';
import type {LoggerPort, NativeLoadingCapability} from '@catering-v2s/kernel-base-platform-ports';
import type {
  CommandDispatchOptions,
  CommandDispatchResult,
  CommandIntent,
  CommandRouteIntent,
  RuntimeStatus,
} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {
  ContainerKey,
  DisplayMode,
  PartKey,
  SurfaceForm,
  UiCatalog,
  UiVariableDeclaration,
} from '@catering-v2s/kernel-base-ui-state';
import type {RendererCatalog} from './catalog';
import type {RenderRuntimeFacts} from './runtimeFacts';
import type {SurfaceCanvasDeclaration, SurfaceHostSource} from '../foundations/surfaceHost';

// Keep this toolkit boundary structural: render consumes a read-only root
// snapshot and must not import or retain the complete Runtime handle.
export type RenderStateRoot = Readonly<Record<string, object | undefined>>;

type RenderStateSource = Readonly<{
  readonly getStatus: () => RuntimeStatus;
  readonly getState: () => RenderStateRoot;
  readonly subscribe: (listener: () => void) => () => void;
}>;

type RenderDispatchOptions = Readonly<{
  readonly requestId: NonNullable<CommandDispatchOptions['requestId']>;
  /** Internal route metadata; SurfaceRoot supplies routeContext for its subtree. */
  readonly routeContext?: CommandRouteContext | null;
  /** Semantic intent only; the runtime derives the concrete target. */
  readonly routeIntent?: CommandRouteIntent;
}>;

type RenderDispatchCommand = <TPayload extends StateJsonValue>(
  command: CommandIntent<TPayload>,
  options: RenderDispatchOptions,
) => Promise<CommandDispatchResult>;

/**
 * A feature-owned dismissal intent for a layer.  Render owns the physical
 * backdrop/back gesture, but it must not invent or bypass the feature command
 * that owns the layer's state transition.
 */
export type RenderLayerDismissal = (
  input: Readonly<{
    readonly dispatchCommand: RenderDispatchCommand;
    readonly displayMode: DisplayMode;
    readonly layerId: string;
  }>,
) => void | Promise<unknown>;

type RenderUiVariableReader = <TValue extends StateJsonValue>(
  root: RenderStateRoot,
  declaration: UiVariableDeclaration<TValue>,
) => TValue;

type RenderSurfaceFormReader = (root: RenderStateRoot) => SurfaceForm;

export type SurfaceRootProps = Readonly<{
  readonly displayMode: DisplayMode;
  readonly containerKey: ContainerKey;
  /** Optional integration-owned fallback used only when no persisted placement exists. */
  readonly defaultContainerPartKeys?: Readonly<Partial<Record<ContainerKey, PartKey>>>;
  readonly children?: ReactNode;
  readonly renderContentFrame?: (frame: SurfaceRootContentFrame) => ReactNode;
  readonly canvas?: SurfaceCanvasDeclaration;
  readonly surfaceHostSource?: SurfaceHostSource;
}>;

export type SurfaceRootContentFrame = Readonly<{
  readonly content: ReactNode;
}>;

export type RenderRouteContextFactory = (root: RenderStateRoot, displayMode: DisplayMode) => CommandRouteContext | null;

export type ContentFailureReason =
  'render-error' | 'missing-catalog-entry' | 'incompatible-catalog-entry' | 'container-empty' | 'invalid-props';

export type SystemFailureReason = 'missing-renderer' | 'runtime-start-failed' | 'surface-host-unavailable';

export type TransitionFailureReason = 'runtime-not-started';

export type RenderFailure =
  | Readonly<{
      readonly category: 'content';
      readonly reason: ContentFailureReason;
      readonly partKey: string | null;
      readonly containerKey: ContainerKey;
      readonly surfaceForm: SurfaceForm;
    }>
  | Readonly<{
      readonly category: 'system';
      readonly reason: SystemFailureReason;
    }>
  | Readonly<{
      readonly category: 'transition';
      readonly reason: TransitionFailureReason;
    }>;

export type RenderSurfaceReadyInput = Readonly<{
  readonly surfaceKey: 'PRIMARY';
  readonly displayIndex: 0;
  readonly displayMode: DisplayMode;
  readonly containerKey: ContainerKey;
  readonly readyPartKey: string | null;
  readonly contentFailure: ContentFailureReason | null;
}>;

export type RenderProviderProps = Readonly<{
  readonly stateSource: RenderStateSource;
  readonly uiCatalog: UiCatalog;
  readonly rendererCatalog: RendererCatalog;
  readonly logger: LoggerPort;
  /** Required bridge from a rendered terminal state to the native splash owner. */
  readonly nativeLoadingCapability: NativeLoadingCapability;
  /** Integration-owned command bridge invoked only after the real primary part lays out. */
  readonly onPrimarySurfaceReady?: (input: RenderSurfaceReadyInput) => void | Promise<void>;
  /** Run-scoped latch shared by the primary surface's successive providers. */
  readonly getPrimarySurfaceReady?: () => boolean;
  readonly runtimeFacts: RenderRuntimeFacts;
  /** Owner-provided retry boundary for a failed runtime; the shell never starts runtime itself. */
  readonly onRuntimeRetry?: () => void | Promise<void>;
  /** Narrow topology control surface for the shared admin section. */
  readonly topologyCapability?: TopologyAdminCapability;
  readonly dispatchCommand: RenderDispatchCommand;
  /** Assembly-owned route context source used by each Root Surface. */
  readonly createRouteContext?: RenderRouteContextFactory;
  /** Feature-owned intents used by generic layer affordances. */
  readonly layerDismissals?: Readonly<Record<string, RenderLayerDismissal>>;
  readonly selectUiVariable: RenderUiVariableReader;
  /** Required by SurfaceRoot; optional only for provider consumers that do not mount a surface. */
  readonly selectSurfaceForm?: RenderSurfaceFormReader;
  readonly children?: ReactNode;
}>;
