import {
  createPlatformPorts,
  unavailableDevicePort,
  type LogEvent,
  type PortResult,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports';
import {createRuntime, type CreateRuntimeInput, type RuntimeModule} from '@catering-v2s/kernel-base-runtime';

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

const createLoggerBinding = () => ({
  kind: 'sink' as const,
  write: (_event: LogEvent): void => undefined,
});

export const createTestRuntime = (modules: readonly RuntimeModule[], plainStorage = createMemoryStorageForTest()) =>
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
        logger: createLoggerBinding(),
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
      runtimeName: 'sample-wallpaper-test',
      environmentMode: 'TEST',
      persistenceKey: 'sample-wallpaper',
      persistenceDebounceMs: 0,
    },
  });
