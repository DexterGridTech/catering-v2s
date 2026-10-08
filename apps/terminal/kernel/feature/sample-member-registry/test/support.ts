import {
  createPlatformPorts,
  unavailableDevicePort,
  type LogEvent,
  type PortResult,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {
  createRuntime,
  defineActor,
  onCommand,
  type CommandDefinition,
  type CreateRuntimeInput,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';

const succeeded = <TValue>(value: TValue): PortResult<TValue> => ({
  status: 'succeeded',
  value,
  completedAt: 1,
});

export const createMemoryStorageForTest = (): StateStoragePort => {
  const values = new Map<string, string>();
  return {
    read: async ({key}) =>
      succeeded(
        values.has(key) ? {state: 'found' as const, value: values.get(key) ?? ''} : {state: 'missing' as const},
      ),
    write: async ({key, value}) => {
      values.set(key, value);
      return succeeded({completed: true as const});
    },
    remove: async ({key}) => {
      values.delete(key);
      return succeeded({completed: true as const});
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
      return succeeded({completed: true as const});
    },
    removeMany: async ({keys}) => {
      for (const key of keys) values.delete(key);
      return succeeded({completed: true as const});
    },
    listKeys: async () => succeeded([...values.keys()]),
    clear: async () => {
      values.clear();
      return succeeded({completed: true as const});
    },
  };
};

const createLoggerBinding = (events: LogEvent[]) => ({
  kind: 'sink' as const,
  write: (event: LogEvent): void => {
    events.push(event);
  },
});

export const createTestRuntime = (
  modules: readonly RuntimeModule[],
  plainStorage = createMemoryStorageForTest(),
  loggerEvents: LogEvent[] = [],
) =>
  createRuntime({
    localNodeId: 'node_test' as CreateRuntimeInput['localNodeId'],
    modules: [
      {
        moduleName: 'kernel.base.contracts',
        kind: 'toolkit',
        dependencies: [],
      },
      {
        moduleName: 'kernel.base.platform-ports',
        kind: 'toolkit',
        dependencies: [{moduleName: 'kernel.base.contracts'}],
      },
      {
        moduleName: 'kernel.base.state',
        kind: 'toolkit',
        dependencies: [{moduleName: 'kernel.base.contracts'}, {moduleName: 'kernel.base.platform-ports'}],
      },
      ...modules,
    ],
    platformPorts: createPlatformPorts({
      environmentMode: 'TEST',
      bindings: {
        logger: createLoggerBinding(loggerEvents),
        persistKv: plainStorage,
        persistSecure: createMemoryStorageForTest(),
        device: unavailableDevicePort,
        appControl: {} as never,
        script: {} as never,
        connector: {} as never,
        update: {} as never,
        logUpload: {} as never,
        topologyHost: {} as never,
      },
    }),
    state: {
      runtimeName: 'sample-member-registry-test',
      environmentMode: 'TEST',
      persistenceKey: 'sample-member-registry',
      persistenceDebounceMs: 0,
    },
  });

export type RecordedEvent = Readonly<{
  commandName: string;
  payload: StateJsonValue;
  requestId: string | null;
}>;

export const createEventRecorderModule = (
  definitions: readonly Readonly<{readonly commandName: string}>[],
  events: RecordedEvent[],
): RuntimeModule => {
  const moduleName = 'test.sample-member-registry.events';
  const actor = defineActor(
    moduleName,
    'recorder',
    definitions.map(definition =>
      onCommand(definition as unknown as CommandDefinition<StateJsonValue>, context => {
        events.push({
          commandName: context.command.commandName,
          payload: context.command.payload,
          requestId: context.command.requestId === null ? null : String(context.command.requestId),
        });
        return null;
      }),
    ),
  );
  return Object.freeze({
    moduleName,
    kind: 'toolkit' as const,
    dependencies: [{moduleName: 'kernel.base.runtime'}],
    actors: [{name: actor.actorName}],
    actorDefinitions: [actor],
  });
};
