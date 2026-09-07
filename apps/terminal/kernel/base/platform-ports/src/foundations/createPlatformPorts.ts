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

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
const STARTUP_GROUPS = Object.freeze([
  'startup.modules',
  'startup.slices',
  'startup.commands',
  'startup.actors',
  'startup.ports',
  'startup.parts',
]);

type PortDescriptorCapability = Readonly<{
  readonly capability: string;
  readonly state: 'real' | 'unavailable';
  readonly source: 'default' | 'adapter' | 'web' | 'fixture';
}>;

type PortDescriptor = Readonly<{
  readonly port: string;
  readonly capabilities: readonly PortDescriptorCapability[];
}>;

type StartupTracker = {
  readonly startupRunId: string;
  sequence: number;
  readonly completedGroups: Set<string>;
  readonly surfaces: Map<string, {declared: boolean; measured: boolean}>;
  terminal: 'complete' | 'failed' | null;
  writingTerminal: boolean;
};

let processLocalCounter = 0;

const createStartupTracker = (): StartupTracker | undefined => {
  if (!__DEV__) return undefined;
  processLocalCounter += 1;
  return {
    startupRunId: `terminal-startup-${nowTimestampMs()}-${processLocalCounter}`,
    sequence: 1,
    completedGroups: new Set<string>(),
    surfaces: new Map<string, {declared: boolean; measured: boolean}>(),
    terminal: null,
    writingTerminal: false,
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

const readString = (data: import('../types/logging').LogFields | undefined, key: string): string | undefined => {
  const value = data?.[key];
  return typeof value === 'string' ? value : undefined;
};

const readSurfaceKind = (data: import('../types/logging').LogFields | undefined): 'declared' | 'measured' | undefined => {
  const value = readString(data, 'kind');
  return value === 'declared' || value === 'measured' ? value : undefined;
};

const allStartupGroupsCompleted = (tracker: StartupTracker): boolean =>
  STARTUP_GROUPS.every(group => tracker.completedGroups.has(group))
  && [...tracker.surfaces.values()].some(surface => surface.declared && surface.measured);

const recordStartupSuccess = (tracker: StartupTracker, category: string, data: import('../types/logging').LogFields | undefined): void => {
  if (STARTUP_GROUPS.includes(category)) tracker.completedGroups.add(category);
  if (category === 'startup.surfaces') {
    const displayMode = readString(data, 'displayMode');
    const kind = readSurfaceKind(data);
    if (displayMode !== undefined && kind !== undefined) {
      const current = tracker.surfaces.get(displayMode) ?? {declared: false, measured: false};
      tracker.surfaces.set(displayMode, {...current, [kind]: true});
    }
  }
};

type StartupWrite = (level: LogEvent['level'], input: LogWriteInput) => LogWriteResult;

const maybeWriteStartupComplete = (tracker: StartupTracker, write: StartupWrite): void => {
  if (tracker.terminal !== null || tracker.writingTerminal || !allStartupGroupsCompleted(tracker)) return;
  tracker.writingTerminal = true;
  try {
    write('info', {
      category: 'startup.complete',
      event: 'startup.complete',
      message: 'Terminal startup diagnostics complete',
      data: {groupCount: STARTUP_GROUPS.length},
    });
  } finally {
    tracker.writingTerminal = false;
  }
};

const recordStartupEvent = (
  tracker: StartupTracker,
  input: LogWriteInput,
  output: Readonly<{readonly event: LogEvent; readonly write: StartupWrite}>,
): void => {
  const {event, write} = output;
  if (input.category === 'startup.failed') {
    tracker.terminal = 'failed';
    return;
  }
  if (input.category === 'startup.complete') {
    tracker.terminal = 'complete';
    return;
  }
  if (tracker.terminal !== null) return;
  recordStartupSuccess(tracker, input.category, event.data);
  maybeWriteStartupComplete(tracker, write);
};

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
          startupRunId: tracker.startupRunId,
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
      if (isStartupEvent) recordStartupEvent(tracker, input, {event, write});
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
    scope: (bindingInput: LogScopeBinding): LoggerPort => createLogger(binding, mergeScope(scope, bindingInput), {context, tracker}),
    withContext: (contextInput: LogContext): LoggerPort => createLogger(binding, scope, {context: mergeContext(context, contextInput), tracker}),
  });
};

const readPortDescriptor = (port: string, binding: object): Readonly<{
  readonly port: string;
  readonly descriptorStatus: 'complete' | 'missing-descriptor';
  readonly capabilities?: readonly PortDescriptorCapability[];
}> => {
  const descriptor = Reflect.get(binding, PORT_DESCRIPTOR_KEY) as PortDescriptor | undefined;
  if (descriptor === undefined) return {port, descriptorStatus: 'missing-descriptor'};
  return {
    port,
    descriptorStatus: 'complete',
    capabilities: descriptor.capabilities,
  };
};

const describeBindings = (bindings: PlatformPortBindings): Readonly<{
  readonly descriptorStatus: 'complete' | 'missing-descriptor';
  readonly descriptors: readonly Readonly<{
    readonly port: string;
    readonly descriptorStatus: 'complete' | 'missing-descriptor';
    readonly capabilities?: readonly PortDescriptorCapability[];
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
