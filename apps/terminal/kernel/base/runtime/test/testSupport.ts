import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  unavailableTopologyHostPort,
  type LogEvent,
  type PlatformPorts,
  type StateStoragePort,
  type NoOutput,
  type PortResult,
} from '@catering-v2s/kernel-base-platform-ports';
import {defineStateRuntimeSlice, type StateRuntimeSliceRegistration} from '@catering-v2s/kernel-base-state';
import {
  defineActor,
  onCommand,
  type ActorCommandHandler,
  type CommandDefinition,
  type CreateRuntimeInput,
  type RuntimeModule,
} from '../src/index';
import type {RuntimeUnknownAction} from '../src/types/runtime';

export type TestState = Readonly<{value: number}>;

export const createTestSlice = (name = 'test.module.state', initialValue = 0): StateRuntimeSliceRegistration =>
  defineStateRuntimeSlice<TestState>({
    name,
    reducer: (state: TestState = {value: initialValue}, action: RuntimeUnknownAction): TestState =>
      action.type === 'test/increment' ? {value: state.value + 1} : state,
    persistIntent: 'never',
    syncIntent: 'isolated',
  });

export const createSinkLoggerBinding = (events: LogEvent[]) => ({
  kind: 'sink' as const,
  write: (event: LogEvent): void => {
    events.push(event);
  },
});

export const createTestPlatformPorts = (
  input: Readonly<{
    plainStorage?: StateStoragePort;
    protectedStorage?: StateStoragePort;
    events?: LogEvent[];
  }> = {},
): PlatformPorts => {
  const events = input.events ?? [];
  return createPlatformPorts({
    environmentMode: 'TEST',
    bindings: {
      logger: createSinkLoggerBinding(events),
      persistKv: input.plainStorage ?? createProcessMemoryStateStoragePort(),
      persistSecure: input.protectedStorage ?? createProcessMemoryStateStoragePort(),
      device: unavailableDevicePort,
      appControl: unavailableAppControlPort,
      script: unavailableScriptPort,
      connector: unavailableConnectorPort,
      hotUpdate: unavailableHotUpdatePort,
      logUpload: unavailableLogUploadPort,
      topologyHost: unavailableTopologyHostPort,
    },
  });
};

export const createSharedMemoryStoragePort = () => {
  const values = new Map<string, string>();
  const succeeded = <TValue>(value: TValue): PortResult<TValue> => ({
    status: 'succeeded',
    value,
    completedAt: 1 as never,
  });
  const noOutput = (): PortResult<NoOutput> => succeeded({completed: true});
  const storage: StateStoragePort = {
    read: async ({key}) =>
      succeeded(
        values.has(key) ? {state: 'found' as const, value: values.get(key) ?? ''} : {state: 'missing' as const},
      ),
    write: async ({key, value}) => {
      values.set(key, value);
      return noOutput();
    },
    remove: async ({key}) => {
      values.delete(key);
      return noOutput();
    },
    readMany: async ({keys}) =>
      succeeded(
        keys.map(key => ({
          key,
          result: values.has(key)
            ? {state: 'found' as const, value: values.get(key) ?? ''}
            : {state: 'missing' as const},
        })),
      ),
    writeMany: async ({entries}) => {
      for (const entry of entries) values.set(entry.key, entry.value);
      return noOutput();
    },
    removeMany: async ({keys}) => {
      for (const key of keys) values.delete(key);
      return noOutput();
    },
    listKeys: async () => succeeded([...values.keys()]),
    clear: async () => noOutput(),
  };
  return {storage, values};
};

export const createTestRuntimeInput = (
  input: Readonly<{
    modules?: readonly RuntimeModule[];
    plainStorage?: StateStoragePort;
    protectedStorage?: StateStoragePort;
    runtimeName?: string;
    events?: LogEvent[];
  }> = {},
): CreateRuntimeInput => ({
  localNodeId: 'node_test' as CreateRuntimeInput['localNodeId'],
  modules: input.modules ?? [],
  platformPorts: createTestPlatformPorts(input),
  state: {
    runtimeName: input.runtimeName ?? 'runtime-test',
    environmentMode: 'TEST',
    persistenceKey: 'runtime-test',
    persistenceDebounceMs: 0,
  },
});

/** Build a minimal owner module for dispatch/lifecycle tests while retaining
 * the declarations that the runtime validates at registration time. */
export const createCommandModule = <TPayload extends import('@catering-v2s/kernel-base-state').StateJsonValue>(
  input: Readonly<{
    moduleName?: string;
    command: CommandDefinition<TPayload>;
    handler?: ActorCommandHandler<TPayload>;
    actorName?: string;
    stateSlice?: StateRuntimeSliceRegistration;
    install?: RuntimeModule['install'];
    preSetup?: RuntimeModule['preSetup'];
    onApplicationReset?: RuntimeModule['onApplicationReset'];
  }>,
): RuntimeModule => {
  const moduleName = input.moduleName ?? input.command.moduleName;
  const actorName = input.actorName ?? 'handler';
  const handler = input.handler ?? (() => null);
  const actor = defineActor(moduleName, actorName, [onCommand(input.command, handler)]);
  return Object.freeze({
    moduleName,
    kind: 'owner' as const,
    dependencies: [{moduleName: 'kernel.base.runtime'}],
    commands: [{name: input.command.commandName, visibility: input.command.visibility}],
    commandDefinitions: [input.command],
    actors: [{name: actorName}],
    actorDefinitions: [actor],
    stateSlices: input.stateSlice === undefined ? [] : [input.stateSlice],
    install: input.install,
    preSetup: input.preSetup,
    onApplicationReset: input.onApplicationReset,
  });
};

export const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
};
