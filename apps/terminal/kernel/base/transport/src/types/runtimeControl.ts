import type {NetworkStatusChanged} from '@catering-v2s/kernel-base-platform-ports';
import type {TransportHttpProxy, TransportServerAddress} from '@catering-v2s/kernel-base-contracts';

export type TransportConnectionEvent = Readonly<
  | {readonly type: 'open'; readonly addressName?: string}
  | {readonly type: 'message'; readonly raw: string}
  | {readonly type: 'close'; readonly code?: number; readonly reason?: string}
  | {readonly type: 'error'; readonly reason?: string}
>;

export type TransportConnection = Readonly<{
  readonly send: (raw: string) => Promise<void>;
  readonly subscribe: (listener: (event: TransportConnectionEvent) => void) => () => void;
}>;

export type TransportManagedConnection = TransportConnection &
  Readonly<{readonly close: (reason?: string) => Promise<void>}>;

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

export type TransportNetworkSnapshot = Readonly<{
  readonly serverName: string;
  readonly revision: number;
  readonly addresses: readonly TransportServerAddress[];
  readonly proxy?: TransportHttpProxy;
}>;

/** Composition supplies this adapter; it is the only layer that reads effective owner config. */
export type TransportNetworkAdapter = Readonly<{
  readonly readSnapshot: (serverName: string) => Promise<TransportNetworkSnapshot>;
  readonly connect: (
    input: Readonly<{
      readonly profileId: string;
      readonly address: TransportServerAddress;
      readonly endpointPathAndQuery?: string;
      readonly proxy?: TransportHttpProxy;
      readonly connectionToken: number;
    }>,
  ) => Promise<TransportManagedConnection>;
  readonly sendHttp?: (
    input: Readonly<{
      readonly address: TransportServerAddress;
      readonly proxy?: TransportHttpProxy;
      readonly method: string;
      readonly pathAndQuery: string;
      readonly headers: Readonly<Record<string, string>>;
      readonly body?: unknown;
      readonly timeoutMs: number;
    }>,
  ) => Promise<TransportHttpAttemptResult>;
}>;

export type TransportModuleOptions = Readonly<{
  readonly networkAdapter?: TransportNetworkAdapter;
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

export type TransportHttpAttemptResult = Readonly<
  | {readonly kind: 'response'; readonly status: number; readonly body: unknown; readonly contentType?: string}
  | {readonly kind: 'failure'; readonly category: 'not-delivered' | 'delivered-failure'; readonly code: string}
>;

export type TransportHttpExecutionResult = Readonly<
  | {
      readonly kind: 'response';
      readonly status: number;
      readonly body: unknown;
      readonly contentType?: string;
      readonly addressName: string;
      readonly configRevision: number;
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
