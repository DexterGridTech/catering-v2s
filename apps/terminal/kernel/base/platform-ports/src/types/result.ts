import type {RequestId, TimestampMs} from '@catering-v2s/kernel-base-contracts';

export type EnvironmentMode = 'DEV' | 'TEST' | 'PROD';

export type PlatformPortName =
  | 'logger'
  | 'persistKv'
  | 'persistSecure'
  | 'device'
  | 'appControl'
  | 'script'
  | 'connector'
  | 'hotUpdate'
  | 'logUpload'
  | 'topologyHost';

export type CapabilityUnavailableReason = 'ADAPTER_NOT_INJECTED' | 'PLATFORM_UNSUPPORTED';

export interface PortUnavailable {
  readonly status: 'unavailable';
  readonly port: PlatformPortName;
  readonly capability: string;
  readonly reason: CapabilityUnavailableReason;
  readonly message: string;
}

export interface PortError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface PortFailure {
  readonly status: 'failed';
  readonly port: PlatformPortName;
  readonly capability: string;
  readonly error: PortError;
}

export interface PortTimedOut {
  readonly status: 'timed-out';
  readonly port: PlatformPortName;
  readonly capability: string;
  readonly timeoutMs: number;
}

export interface PortSucceeded<TValue> {
  readonly status: 'succeeded';
  readonly value: TValue;
  readonly completedAt: TimestampMs;
}

export interface PortAccepted<TObservation extends string> {
  readonly status: 'accepted';
  readonly requestId: RequestId;
  readonly acceptedAt: TimestampMs;
  readonly terminalObservation: TObservation;
}

export interface NoOutput {
  readonly completed: true;
}

export type PortResult<TValue> = PortSucceeded<TValue> | PortFailure | PortTimedOut | PortUnavailable;

export type PortActionResult<TValue, TObservation extends string> = PortResult<TValue> | PortAccepted<TObservation>;
