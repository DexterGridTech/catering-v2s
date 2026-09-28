import type {RuntimeJournal, RuntimeJournalEvent} from '../types/journal';
import {freezeList} from './freezeList';

export type RuntimeJournalSink = Readonly<{
  append?: (event: RuntimeJournalEvent) => void;
  onAppendFailure?: (error: unknown) => void;
}>;

export type RuntimeJournalWithAppend = RuntimeJournal &
  Readonly<{
    append: (event: RuntimeJournalEvent) => void;
  }>;

export const createRuntimeJournal = (maxRecords: number, sink: RuntimeJournalSink = {}): RuntimeJournalWithAppend => {
  const records: RuntimeJournalEvent[] = [];
  const listeners = new Set<(event: RuntimeJournalEvent) => void>();
  const limit = Math.max(1, Math.floor(maxRecords));

  return Object.freeze({
    list: (): readonly RuntimeJournalEvent[] => freezeList(records),
    subscribe: (listener: (event: RuntimeJournalEvent) => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    append: (event: RuntimeJournalEvent): void => {
      records.push(event);
      while (records.length > limit) records.shift();
      try {
        sink.append?.(event);
      } catch (error) {
        sink.onAppendFailure?.(error);
      }
      for (const listener of [...listeners]) {
        try {
          listener(event);
        } catch (error) {
          sink.onAppendFailure?.(error);
        }
      }
    },
  });
};
