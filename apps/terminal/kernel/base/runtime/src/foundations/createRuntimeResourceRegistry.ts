export type RuntimeResourceRegistry = Readonly<{
  register: (cleanup: () => void) => () => void;
  registerAsync: (cleanup: () => Promise<void>) => () => void;
  release: () => number;
  releaseAsync: () => Promise<number>;
}>;

export const createRuntimeResourceRegistry = (): RuntimeResourceRegistry => {
  const cleanups = new Set<() => void>();
  const asyncCleanups = new Set<() => Promise<void>>();
  const registry: RuntimeResourceRegistry = {
    register: (cleanup: () => void): (() => void) => {
      cleanups.add(cleanup);
      return () => {
        cleanups.delete(cleanup);
      };
    },
    registerAsync: (cleanup: () => Promise<void>): (() => void) => {
      asyncCleanups.add(cleanup);
      return () => {
        asyncCleanups.delete(cleanup);
      };
    },
    release: (): number => {
      if (asyncCleanups.size > 0) throw new Error('ASYNC_RUNTIME_RESOURCES_REQUIRE_RELEASE_ASYNC');
      const pending = [...cleanups];
      cleanups.clear();
      for (const cleanup of pending) {
        try {
          cleanup();
        } catch {
          /* resource cleanup is best effort */
        }
      }
      return pending.length;
    },
    releaseAsync: async (): Promise<number> => {
      const pending = [...cleanups, ...asyncCleanups];
      cleanups.clear();
      asyncCleanups.clear();
      const failures: unknown[] = [];
      for (const cleanup of pending) {
        try {
          await cleanup();
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length > 0) throw new AggregateError(failures, 'RUNTIME_RESOURCE_RELEASE_FAILED');
      return pending.length;
    },
  };
  return registry;
};
