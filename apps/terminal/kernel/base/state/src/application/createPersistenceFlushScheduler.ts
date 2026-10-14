import type {EnhancedStore} from '@reduxjs/toolkit';
import type {LoggerPort} from '@catering-v2s/kernel-base-platform-ports';
import type {PersistenceOperationResult} from '../types/persistence';
import type {StateRoot} from '../types/runtime';
import type {RegisteredStateRuntimeSlice} from '../types/slice';
import type {PersistenceEngine} from './persistenceEngine';

type AutoFlushSelection = 'all' | 'immediate';

const recordEntriesChanged = (
  previous: Readonly<Record<string, unknown>>,
  next: Readonly<Record<string, unknown>>,
): boolean => {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) return true;
  return previousKeys.some(key => !Object.is(previous[key], next[key]));
};

const persistenceDescriptorChanged = (
  descriptor: RegisteredStateRuntimeSlice['persistence'][number],
  previous: object | undefined,
  next: object | undefined,
): boolean => {
  if (previous === next) return false;
  if (previous === undefined || next === undefined) return true;
  if (descriptor.kind === 'field') {
    return !Object.is(descriptor.readField(previous), descriptor.readField(next));
  }
  return recordEntriesChanged(descriptor.getEntries(previous), descriptor.getEntries(next));
};

export const createPersistenceFlushScheduler = (
  input: Readonly<{
    store: EnhancedStore<StateRoot>;
    slices: readonly RegisteredStateRuntimeSlice[];
    engine: PersistenceEngine;
    debounceMs: number;
    logger: LoggerPort;
  }>,
): Readonly<{
  cancel(): void;
  dispose(): Promise<void>;
}> => {
  let disposed = false;
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingFlush: Promise<PersistenceOperationResult> = Promise.resolve({
    status: 'succeeded',
    writtenKeys: [],
    removedKeys: [],
  });
  let disposePromise: Promise<void> | undefined;
  const persistableSliceRefs = new Map<string, object | undefined>(
    input.slices
      .filter(slice => slice.persistence.length > 0)
      .map(slice => [slice.name, input.store.getState()[slice.name]]),
  );

  const cancel = (): void => {
    if (debounceTimer === undefined) return;
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
  };

  const runFlush = (selection: AutoFlushSelection): void => {
    pendingFlush = input.engine.flush(input.store.getState(), selection);
    pendingFlush.catch((error: unknown) => {
      input.logger.error({
        category: 'state.persistence',
        event: 'state.persistence.autoflush.unhandled',
        message: error instanceof Error ? error.message : 'state autoflush failed',
      });
    });
  };

  const scheduleAutoFlush = (): void => {
    if (disposed) return;
    const state = input.store.getState();
    const changedDescriptors = input.slices.flatMap(slice => {
      if (slice.persistence.length === 0) return [];
      const next = state[slice.name];
      const previous = persistableSliceRefs.get(slice.name);
      persistableSliceRefs.set(slice.name, next);
      return slice.persistence.filter(descriptor => persistenceDescriptorChanged(descriptor, previous, next));
    });
    const hasImmediateChange = changedDescriptors.some(entry => entry.flushMode !== 'debounced');
    const hasDebouncedChange = changedDescriptors.some(entry => entry.flushMode === 'debounced');
    if (!hasImmediateChange && !hasDebouncedChange) return;
    if (input.debounceMs === 0) {
      cancel();
      runFlush('all');
      return;
    }
    if (hasImmediateChange) runFlush('immediate');
    if (hasDebouncedChange && debounceTimer === undefined) {
      debounceTimer = setTimeout(() => {
        debounceTimer = undefined;
        if (!disposed) runFlush('all');
      }, input.debounceMs);
    }
  };

  const unsubscribe = input.store.subscribe(scheduleAutoFlush);

  return Object.freeze({
    cancel,
    dispose: (): Promise<void> => {
      if (disposePromise !== undefined) return disposePromise;
      disposed = true;
      cancel();
      unsubscribe();
      disposePromise = pendingFlush.then(() => undefined);
      return disposePromise;
    },
  });
};
