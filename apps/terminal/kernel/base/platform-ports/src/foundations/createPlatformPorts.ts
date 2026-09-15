import {createRuntimeInstanceId, nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
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
  PlatformPortCapability,
  PlatformPortCapabilitySnapshot,
  PlatformPortBindings,
  PlatformPorts,
} from '../types/platformPorts';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');

type PortDescriptor = Readonly<{
  readonly port: string;
  readonly capabilities: readonly PlatformPortCapability[];
}>;

type StartupTracker = {
  readonly startupRunId: string;
  sequence: number;
};

const createStartupTracker = (): StartupTracker | undefined => {
  if (!__DEV__) return undefined;
  return {
    startupRunId: createRuntimeInstanceId(),
    sequence: 1,
  };
};

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

const startupPhaseOf = (category: string): string => category.startsWith('startup.')
  ? category.slice('startup.'.length)
  : category;

type LoggerOptions = Readonly<{
  readonly context?: LogContext;
  readonly tracker?: StartupTracker;
}>;

const createLogger = (
  binding: LoggerBinding,
  scope: LogScope = defaultScope,
  options: LoggerOptions = {},
): LoggerPort => {
  const {context, tracker} = options;
  const write = (level: LogEvent['level'], input: LogWriteInput): LogWriteResult => {
    const isStartupEvent = tracker !== undefined && input.category.startsWith('startup.');
    const startupSequence = tracker?.sequence;
    if (isStartupEvent) tracker.sequence += 1;
    const event = sanitizeLogEvent({
      timestamp: nowTimestampMs(),
      level,
      category: input.category,
      event: input.event,
      message: input.message,
      scope,
      context: context === undefined ? input.context : mergeContext(context, input.context ?? {}),
      data: isStartupEvent && tracker !== undefined
        ? {
          ...input.data,
          startupRunId: typeof input.data?.startupRunId === 'string'
            ? input.data.startupRunId
            : tracker.startupRunId,
          phase: startupPhaseOf(input.category),
          sequence: startupSequence ?? tracker.sequence,
        }
        : input.data,
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
  const logger: LoggerPort = {
    debug: (input: LogWriteInput): LogWriteResult => write('debug', input),
    info: (input: LogWriteInput): LogWriteResult => write('info', input),
    warn: (input: LogWriteInput): LogWriteResult => write('warn', input),
    error: (input: LogWriteInput): LogWriteResult => write('error', input),
    scope: (bindingInput: LogScopeBinding): LoggerPort => createLogger(binding, mergeScope(scope, bindingInput), {context, tracker}),
    withContext: (contextInput: LogContext): LoggerPort => createLogger(binding, scope, {context: mergeContext(context, contextInput), tracker}),
  };
  const descriptor = Reflect.get(binding, PORT_DESCRIPTOR_KEY) as PortDescriptor | undefined;
  if (descriptor !== undefined) {
    Object.defineProperty(logger, PORT_DESCRIPTOR_KEY, {
      value: descriptor,
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
  return Object.freeze(logger);
};

const readPortDescriptor = (port: string, binding: object): Readonly<{
  readonly port: string;
  readonly descriptorStatus: 'complete' | 'missing-descriptor';
  readonly capabilities?: readonly PlatformPortCapability[];
}> => {
  const descriptor = Reflect.get(binding, PORT_DESCRIPTOR_KEY) as PortDescriptor | undefined;
  if (descriptor === undefined) return {port, descriptorStatus: 'missing-descriptor'};
  return {
    port,
    descriptorStatus: 'complete',
    capabilities: descriptor.capabilities,
  };
};

export const describePlatformPortCapabilities = (
  ports: PlatformPorts,
): readonly PlatformPortCapabilitySnapshot[] => {
  const portNames = [
    'logger',
    'persistKv',
    'persistSecure',
    'device',
    'appControl',
    'script',
    'connector',
    'hotUpdate',
    'logUpload',
    'topologyHost',
  ] as const;
  return Object.freeze(portNames.map((port) => {
    const descriptor = readPortDescriptor(port, ports[port]);
    return Object.freeze({
      port,
      descriptorStatus: descriptor.descriptorStatus,
      capabilities: Object.freeze(descriptor.capabilities ?? []),
    });
  }));
};

const describeBindings = (bindings: PlatformPortBindings): Readonly<{
  readonly descriptorStatus: 'complete' | 'missing-descriptor';
  readonly descriptors: readonly Readonly<{
    readonly port: string;
    readonly descriptorStatus: 'complete' | 'missing-descriptor';
    readonly capabilities?: readonly PlatformPortCapability[];
  }>[];
}> => {
  const entries = [
    ['logger', bindings.logger],
    ['persistKv', bindings.persistKv],
    ['persistSecure', bindings.persistSecure],
    ['device', bindings.device],
    ['appControl', bindings.appControl],
    ['script', bindings.script],
    ['connector', bindings.connector],
    ['hotUpdate', bindings.hotUpdate],
    ['logUpload', bindings.logUpload],
    ['topologyHost', bindings.topologyHost],
  ] as const;
  const descriptors = Object.freeze(entries.map(([port, binding]) => Object.freeze(readPortDescriptor(port, binding))));
  return Object.freeze({
    descriptorStatus: descriptors.every(descriptor => descriptor.descriptorStatus === 'complete')
      ? 'complete'
      : 'missing-descriptor',
    descriptors,
  });
};

export const createPlatformPorts = (input: CreatePlatformPortsInput): Readonly<PlatformPorts> => {
  const bindings: PlatformPortBindings = input.bindings;
  const tracker = createStartupTracker();
  const ports = Object.freeze({
    ...(tracker === undefined ? {} : {startupRunId: tracker.startupRunId}),
    logger: createLogger(bindings.logger, defaultScope, {tracker}),
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
  if (__DEV__ && tracker !== undefined) {
    const descriptorSummary = describeBindings(bindings);
    ports.logger.info({
      category: 'startup.ports',
      event: 'startup.ports',
      message: 'Platform port descriptors registered',
      data: {
        portCount: descriptorSummary.descriptors.length,
        descriptorStatus: descriptorSummary.descriptorStatus,
        descriptors: descriptorSummary.descriptors,
      },
    });
  }
  return ports;
};
