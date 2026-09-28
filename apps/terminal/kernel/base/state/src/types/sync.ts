import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {StateJsonValue} from './value';

export type SyncIntent = 'isolated' | 'master-to-slave' | 'slave-to-master';

export type SyncValueEnvelope<TValue extends StateJsonValue = StateJsonValue> =
  | {
      readonly value: TValue;
      readonly updatedAt: TimestampMs;
      readonly tombstone?: never;
    }
  | {
      readonly value?: never;
      readonly updatedAt: TimestampMs;
      readonly tombstone: true;
    };

export type SyncRecordState<TKey extends string = string, TValue extends StateJsonValue = StateJsonValue> = Readonly<
  Partial<Record<TKey, SyncValueEnvelope<TValue>>>
>;

export interface SyncStateSummaryEntry {
  readonly updatedAt: TimestampMs;
  readonly tombstone?: true;
  /**
   * Historical name kept for the POC-compatible contract.  This is not a
   * short digest; it is the full canonical JSON serialization prefixed with
   * `json:` so consumers must treat it as full-payload-sized comparison data.
   */
  readonly valueHash: string;
}

export type SyncStateSummary<TKey extends string = string> = Readonly<Partial<Record<TKey, SyncStateSummaryEntry>>>;

export interface SyncStateDiffEntry<TKey extends string = string, TValue extends StateJsonValue = StateJsonValue> {
  readonly key: TKey;
  readonly value: SyncValueEnvelope<TValue>;
}

export type SyncStateDiff<TKey extends string = string, TValue extends StateJsonValue = StateJsonValue> =
  | {
      readonly mode: 'authoritative';
      readonly replaceMissing: false;
      readonly entries: readonly SyncStateDiffEntry<TKey, TValue>[];
    }
  | {
      readonly mode: 'authoritative';
      readonly replaceMissing: true;
      readonly entries: readonly SyncStateDiffEntry<TKey, TValue>[];
    };

export interface SyncDiffOptions {
  readonly mode: 'authoritative';
}

export interface StateRuntimeSyncRecordDescriptor<
  TState extends object,
  TKey extends string = string,
  TValue extends StateJsonValue = StateJsonValue,
> {
  readonly kind: 'record';
  readonly getEntries: (state: Readonly<TState>) => SyncRecordState<TKey, TValue>;
  readonly applyEntries: (state: Readonly<TState>, entries: SyncRecordState<TKey, TValue>) => TState;
}

export type StateRuntimeSyncDescriptor<TState extends object> = StateRuntimeSyncRecordDescriptor<TState>;
