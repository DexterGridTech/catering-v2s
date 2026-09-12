import type {EnvironmentMode, PlatformPortName} from './result';
import type {LoggerPort, LogEvent} from './logging';
import type {StateStoragePort} from './storage';
import type {DevicePort} from './device';
import type {AppControlPort} from './appControl';
import type {ScriptPort} from './script';
import type {ConnectorPort} from './connector';
import type {HotUpdatePort} from './hotUpdate';
import type {LogUploadPort} from './logUpload';
import type {TopologyHostPort} from './topologyHost';

export interface LoggerConsoleBinding { readonly kind: 'console' }
export interface LoggerSinkBinding {
  readonly kind: 'sink';
  readonly write: (event: LogEvent) => void;
}
export type LoggerBinding = LoggerConsoleBinding | LoggerSinkBinding;

export type PlatformPortCapabilityState = 'real' | 'unavailable';
export type PlatformPortCapabilitySource = 'default' | 'adapter' | 'web' | 'fixture';

export interface PlatformPortCapability extends Readonly<Record<string, string>> {
  readonly capability: string;
  readonly state: PlatformPortCapabilityState;
  readonly source: PlatformPortCapabilitySource;
}

export interface PlatformPortCapabilitySnapshot {
  readonly port: PlatformPortName;
  readonly descriptorStatus: 'complete' | 'missing-descriptor';
  readonly capabilities: readonly PlatformPortCapability[];
}

export interface PlatformPortBindings {
  readonly logger: LoggerBinding;
  readonly persistKv: StateStoragePort;
  readonly persistSecure: StateStoragePort;
  readonly device: DevicePort;
  readonly appControl: AppControlPort;
  readonly script: ScriptPort;
  readonly connector: ConnectorPort;
  readonly hotUpdate: HotUpdatePort;
  readonly logUpload: LogUploadPort;
  readonly topologyHost: TopologyHostPort;
}

export interface PlatformPorts {
  readonly logger: LoggerPort;
  readonly persistKv: StateStoragePort;
  readonly persistSecure: StateStoragePort;
  readonly device: DevicePort;
  readonly appControl: AppControlPort;
  readonly script: ScriptPort;
  readonly connector: ConnectorPort;
  readonly hotUpdate: HotUpdatePort;
  readonly logUpload: LogUploadPort;
  readonly topologyHost: TopologyHostPort;
}

export interface CreatePlatformPortsInput {
  readonly environmentMode: EnvironmentMode;
  readonly bindings: PlatformPortBindings;
}
