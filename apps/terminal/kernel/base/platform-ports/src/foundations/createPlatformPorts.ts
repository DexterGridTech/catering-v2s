import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {sanitizeLogEvent} from './sensitiveData';
import type {
  LogContext,
  LogEvent,
  LoggerPort,
  LogScope,
  LogScopeBinding,
  LogWriteInput,
  LogWriteResult,
} from '../types/logging';
import type {PortFailure} from '../types/result';
import type {
  CreatePlatformPortsInput,
  LoggerBinding,
  PlatformPortBindings,
  PlatformPorts,
} from '../types/platformPorts';

const defaultScope: LogScope = Object.freeze({moduleName: 'platform-ports', layer: 'kernel'});

const mergeScope = (scope: LogScope, binding: LogScopeBinding): LogScope => Object.freeze({
  moduleName: binding.moduleName ?? scope.moduleName,
  layer: binding.layer ?? scope.layer,
  subsystem: binding.subsystem ?? scope.subsystem,
  component: binding.component ?? scope.component,
});

const mergeContext = (context: LogContext | undefined, update: LogContext): LogContext => Object.freeze({
  ...context,
  ...update,
});

const sinkFailure = (capability: string): PortFailure => ({
  status: 'failed',
  port: 'logger',
  capability,
  error: {
    code: 'LOGGER_SINK_WRITE_FAILED',
    message: 'logger sink rejected the sanitized event',
    retryable: true,
  },
});

const sendToConsole = (level: LogEvent['level'], event: LogEvent): void => {
  if (level === 'debug') console.debug(event);
  else if (level === 'info') console.info(event);
  else if (level === 'warn') console.warn(event);
  else console.error(event);
};

const createLogger = (
  binding: LoggerBinding,
  scope: LogScope = defaultScope,
  context?: LogContext,
): LoggerPort => {
  const write = (level: LogEvent['level'], input: LogWriteInput): LogWriteResult => {
    const event = sanitizeLogEvent({
      timestamp: nowTimestampMs(),
      level,
      category: input.category,
      event: input.event,
      message: input.message,
      scope,
      context: context === undefined ? input.context : mergeContext(context, input.context ?? {}),
      data: input.data,
      error: input.error,
      security: {containsSensitiveRaw: false, maskingMode: 'masked'},
    });
    try {
      if (binding.kind === 'sink') binding.write(event);
      else sendToConsole(level, event);
      return {status: 'succeeded', value: event, completedAt: nowTimestampMs()};
    } catch (_error) {
      return sinkFailure(level);
    }
  };
  return Object.freeze({
    debug: (input: LogWriteInput): LogWriteResult => write('debug', input),
    info: (input: LogWriteInput): LogWriteResult => write('info', input),
    warn: (input: LogWriteInput): LogWriteResult => write('warn', input),
    error: (input: LogWriteInput): LogWriteResult => write('error', input),
    scope: (bindingInput: LogScopeBinding): LoggerPort => createLogger(binding, mergeScope(scope, bindingInput), context),
    withContext: (contextInput: LogContext): LoggerPort => createLogger(binding, scope, mergeContext(context, contextInput)),
  });
};

export const createPlatformPorts = (input: CreatePlatformPortsInput): Readonly<PlatformPorts> => {
  const bindings: PlatformPortBindings = input.bindings;
  return Object.freeze({
    logger: createLogger(bindings.logger),
    persistKv: bindings.persistKv,
    persistSecure: bindings.persistSecure,
    device: bindings.device,
    appControl: bindings.appControl,
    script: bindings.script,
    connector: bindings.connector,
    hotUpdate: bindings.hotUpdate,
    logUpload: bindings.logUpload,
    topologyHost: bindings.topologyHost,
  });
};
