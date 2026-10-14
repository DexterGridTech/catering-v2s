import type {TransportHttpProxy, TransportServerAddress} from '@catering-v2s/kernel-base-contracts';

export type TransportConnectionEvent = Readonly<
  | {readonly type: 'open'; readonly addressName?: string; readonly configRevision?: number}
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

export type TransportNetworkSnapshot = Readonly<{
  readonly serverName: string;
  readonly revision: number;
  readonly addresses: readonly TransportServerAddress[];
  readonly proxy?: TransportHttpProxy;
}>;

export type TransportHttpAttemptResult = Readonly<
  | {
      readonly kind: 'response';
      readonly status: number;
      readonly body: unknown;
      readonly contentType?: string;
      readonly requestId?: string;
      readonly correlationId?: string;
    }
  | {readonly kind: 'failure'; readonly category: 'not-delivered' | 'delivered-failure'; readonly code: string}
>;

/** Network adapter contract consumed by transport and implemented by platform adapters. */
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
