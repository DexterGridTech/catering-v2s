import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {NoOutput, PortFailure, PortResult} from './result';

export interface DeviceInfo {
  readonly deviceId: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly systemName: string;
  readonly systemVersion: string;
  readonly logicalProcessorCount: number;
}
export interface DeviceIdentity {
  readonly available: boolean;
  readonly deviceId: string | null;
}
export interface DisplayInfo {
  readonly displayCount: number;
}
export interface ProcessorStatus {
  readonly logicalProcessorCount: number;
  readonly processUtilizationRatio: number;
}
export interface MemoryStatus {
  readonly totalBytes: number;
  readonly availableBytes: number;
  readonly processBytes: number;
}
export interface StorageStatus {
  readonly totalBytes: number;
  readonly availableBytes: number;
  readonly processBytes: number;
}
export interface NetworkStatus { readonly connected: boolean }
export interface PowerStatus {
  readonly source: 'external' | 'battery' | 'unknown';
  readonly charging: 'charging' | 'not-charging' | 'unknown';
  readonly levelRatio?: number;
}
export interface SystemStatus {
  readonly processor: ProcessorStatus;
  readonly memory: MemoryStatus;
  readonly storage: StorageStatus;
  readonly network: NetworkStatus;
  readonly power: PowerStatus;
  readonly observedAt: TimestampMs;
}
export interface PowerStatusChanged {
  readonly status: PowerStatus;
  readonly observedAt: TimestampMs;
}
export type PowerStatusListener = (event: PowerStatusChanged) => void;
export interface DeviceCall { readonly timeoutMs: number }
export interface PowerStatusSubscriptionInput extends DeviceCall {
  readonly listener: PowerStatusListener;
  readonly onError: (error: PortFailure['error']) => void;
}
export interface PowerStatusUnsubscribeInput extends DeviceCall { readonly subscriptionId: string }
export interface DevicePort {
  getDeviceInfo(input: DeviceCall): Promise<PortResult<DeviceInfo>>;
  getDisplayInfo(input: DeviceCall): Promise<PortResult<DisplayInfo>>;
  getSystemStatus(input: DeviceCall): Promise<PortResult<SystemStatus>>;
  getPowerStatus(input: DeviceCall): Promise<PortResult<PowerStatus>>;
  subscribePowerStatus(input: PowerStatusSubscriptionInput): Promise<PortResult<{readonly subscriptionId: string}>>;
  unsubscribePowerStatus(input: PowerStatusUnsubscribeInput): Promise<PortResult<NoOutput>>;
}
