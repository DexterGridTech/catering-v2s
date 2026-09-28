import type {
  CommandId,
  ConnectionId,
  NodeId,
  RequestId,
  SessionId,
  TimestampMs,
} from '@catering-v2s/kernel-base-contracts';
import type {PortFailure, PortSucceeded} from './result';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogMaskingMode = 'masked';
export type LogPrimitive = string | number | boolean | null;
export type LogValue = LogPrimitive | readonly LogValue[] | LogFields;
export interface LogFields {
  readonly [key: string]: LogValue;
}

export interface LogScope {
  readonly moduleName: string;
  readonly layer?: 'kernel' | 'ui' | 'adapter' | 'application';
  readonly subsystem?: string;
  readonly component?: string;
}

export interface LogScopeBinding {
  readonly moduleName?: string;
  readonly layer?: 'kernel' | 'ui' | 'adapter' | 'application';
  readonly subsystem?: string;
  readonly component?: string;
}

export interface LogContext {
  readonly requestId?: RequestId;
  readonly commandId?: CommandId;
  readonly commandName?: string;
  readonly sessionId?: SessionId;
  readonly connectionId?: ConnectionId;
  readonly nodeId?: NodeId;
  readonly peerNodeId?: NodeId;
}

export interface LogError {
  readonly name?: string;
  readonly code?: string;
  readonly message: string;
  readonly stack?: string;
}

export interface LogSecurity {
  readonly containsSensitiveRaw: boolean;
  readonly maskingMode: LogMaskingMode;
}

export interface LogEvent {
  readonly timestamp: TimestampMs;
  readonly level: LogLevel;
  readonly category: string;
  readonly event: string;
  readonly message?: string;
  readonly scope: LogScope;
  readonly context?: LogContext;
  readonly data?: LogFields;
  readonly error?: LogError;
  readonly security: LogSecurity;
}

export interface LogWriteInput {
  readonly category: string;
  readonly event: string;
  readonly message?: string;
  readonly context?: LogContext;
  readonly data?: LogFields;
  readonly error?: LogError;
}

export type LogWriteResult = PortSucceeded<LogEvent> | PortFailure;

export interface LoggerPort {
  debug(input: LogWriteInput): LogWriteResult;
  info(input: LogWriteInput): LogWriteResult;
  warn(input: LogWriteInput): LogWriteResult;
  error(input: LogWriteInput): LogWriteResult;
  scope(binding: LogScopeBinding): LoggerPort;
  withContext(context: LogContext): LoggerPort;
}
