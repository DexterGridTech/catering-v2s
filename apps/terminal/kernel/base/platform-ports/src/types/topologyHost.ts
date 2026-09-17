import type {TimestampMs, TopologyIdentity} from '@catering-v2s/kernel-base-contracts';
import type {NoOutput, PortResult} from './result';

export type TopologyHostState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
export interface TopologyHostRuntimeConfig {
  readonly port: number;
  readonly basePath: string;
  readonly heartbeatIntervalMs: number;
  readonly heartbeatTimeoutMs: number;
}
export interface TopologyHostConfig extends TopologyHostRuntimeConfig {
  readonly timeoutMs: number
  readonly identity?: TopologyIdentity
}
export interface TopologyHostConfigWithIdentity extends TopologyHostConfig {
  readonly identity: TopologyIdentity
}
export interface TopologyHostAddress {
  readonly host: string;
  readonly port: number;
  readonly basePath: string;
  readonly httpBaseUrl: string;
  readonly wsUrl: string;
  readonly localHttpBaseUrl: string;
  readonly localWsUrl: string;
}
export interface TopologyHostStatus {
  readonly state: TopologyHostState;
  readonly address?: TopologyHostAddress;
  readonly config: TopologyHostRuntimeConfig;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}
export interface TopologyHostStats {
  readonly sessionCount: number;
  readonly peerCount: number;
  readonly stalePeerCount: number;
}
export interface TopologyHostDiagnostics {
  readonly status: TopologyHostStatus;
  readonly stats: TopologyHostStats;
  readonly capturedAt: TimestampMs;
}
export interface TopologyHostCall { readonly timeoutMs: number }
export interface TopologyHostPort {
  start(input: TopologyHostConfig): Promise<PortResult<TopologyHostAddress>>;
  stop(input: TopologyHostCall): Promise<PortResult<NoOutput>>;
  getStatus(input: TopologyHostCall): Promise<PortResult<TopologyHostStatus>>;
  getDiagnosticsSnapshot(input: TopologyHostCall): Promise<PortResult<TopologyHostDiagnostics>>;
}
