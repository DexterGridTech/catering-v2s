import type {NetworkStatusChanged} from '@catering-v2s/kernel-base-platform-ports';
import type {
  TransportConnection,
  TransportConnectionEvent,
  TransportHttpAttemptResult,
  TransportManagedConnection,
  TransportNetworkAdapter,
  TransportNetworkSnapshot,
} from '@catering-v2s/kernel-base-platform-ports';

export type TransportReconnectPolicy = Readonly<{
  readonly initialDelayMs: number;
  readonly incrementMs: number;
  readonly maximumDelayMs: number;
  readonly maximumJitterRatio: number;
  readonly cappedDelayFloorRatio: number;
  readonly readyTimeoutMs: number;
  readonly networkRecoveryMinimumIntervalMs: number;
}>;

export type TransportStartInput = Readonly<{
  readonly profileId: string;
  readonly serverName: string;
  /** Opaque origin-relative route supplied by the protocol owner, never interpreted here. */
  readonly endpointPathAndQuery?: string;
  readonly reconnectPolicy: TransportReconnectPolicy;
}>;

export type TransportModuleOptions = Readonly<{
  readonly networkAdapter?: TransportNetworkAdapter;
  /** Composition-created adapter; receives the installed runtime context for owner-backed config reads. */
  readonly networkAdapterFactory?: (
    context: import('@catering-v2s/kernel-base-runtime').RuntimeModuleContext,
  ) => TransportNetworkAdapter;
  readonly now?: () => number;
  readonly random?: () => number;
}>;

export type TransportHttpRequest = Readonly<{
  readonly profileId: string;
  readonly serverName: string;
  readonly method: string;
  readonly pathAndQuery: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: unknown;
  readonly safeRetryable: boolean;
}>;

export type TransportHttpExecutionResult = Readonly<
  | {
      readonly kind: 'response';
      readonly status: number;
      readonly body: unknown;
      readonly contentType?: string;
      readonly addressName: string;
      readonly configRevision: number;
      readonly requestId?: string;
      readonly correlationId?: string;
    }
  | {readonly kind: 'failure'; readonly category: 'not-delivered' | 'delivered-failure'; readonly code: string}
>;

/** Generic transport command facade; implementations dispatch the transport owner commands. */
export type TransportCommandGateway = Readonly<{
  readonly start: (input: TransportStartInput) => Promise<TransportConnection>;
  readonly ready: (input: Readonly<{profileId: string; stableAfterMs: number}>) => Promise<void>;
  readonly invalid: (input: Readonly<{profileId: string; cause: string}>) => Promise<void>;
  readonly stop: (input: Readonly<{profileId: string}>) => Promise<void>;
  readonly executeHttp: (request: TransportHttpRequest) => Promise<TransportHttpExecutionResult>;
  readonly reportHttpAddressAvailable: (
    input: Readonly<{profileId: string; serverName: string; addressName: string; configRevision: number}>,
  ) => Promise<void>;
}>;

export type TransportNetworkTransition = Readonly<{
  readonly connected: boolean;
  readonly observedAt: number;
}>;

export type TransportNetworkStatusDispatch = (transition: TransportNetworkTransition) => Promise<unknown>;

export type TransportNetworkStatusBridge = Readonly<{
  readonly installed: boolean;
  readonly dispose: () => Promise<void>;
}>;

export type TransportNetworkStatusChanged = NetworkStatusChanged;
