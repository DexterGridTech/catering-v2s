import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {
  TerminalUpdateArtifact,
  UpdateActualVersions,
  UpdateNetworkSnapshot,
} from '@catering-v2s/kernel-base-platform-ports';
import type {StateRoot} from '@catering-v2s/kernel-base-state';

export interface UpdateArtifactSource {
  readonly sourceRef: string;
  readonly expectedSha256: string;
  readonly artifact: TerminalUpdateArtifact;
}

export interface FixedUpdateTarget {
  readonly ruleRef: string;
  readonly createdAt: TimestampMs;
  readonly applicationId: string;
  readonly full: UpdateArtifactSource | null;
  readonly hot: UpdateArtifactSource | null;
  readonly strategy: Readonly<{maxNetworkAttempts: number; bootTimeoutMs: number}>;
  readonly selectionContext: Readonly<{selectedSpace: string; contextIdentity: string}>;
}

export interface TerminalUpdateTask {
  readonly taskId: string;
  readonly target: FixedUpdateTarget;
  /** Bundle version observed before the first update action; retained across FULL reboot for downgrade checks. */
  readonly originalBundleVersion: string | null;
  readonly phase:
    | 'fixed'
    | 'preparing-full'
    | 'preparing-hot'
    | 'applying-full'
    | 'applying-hot'
    | 'waiting-user'
    | 'unknown'
    | 'succeeded'
    | 'failed';
  readonly actionId: string | null;
  readonly preparedId: string | null;
  readonly bootId: string | null;
  readonly failureCode: string | null;
}

export interface TerminalUpdateRecentStatus {
  readonly taskId: string | null;
  readonly state: 'idle' | 'fixed' | 'preparing' | 'applying' | 'waiting-user' | 'unknown' | 'succeeded' | 'failed';
  readonly reason: string | null;
  readonly changedAt: TimestampMs;
}

export interface TerminalUpdateState {
  readonly currentTask: TerminalUpdateTask | null;
  readonly recentStatus: TerminalUpdateRecentStatus;
  readonly failedArtifactIds: readonly string[];
  readonly actualVersions: UpdateActualVersions | null;
}

export interface UpdateTargetSourceProvider {
  readTarget(selectionContext: FixedUpdateTarget['selectionContext']): Promise<FixedUpdateTarget | null>;
  /** Resolve a persisted opaque ref after process recreation; never persist the path in currentTask. */
  resolveSourcePath?(sourceRef: string): string | null;
}

export type UpdateNetworkSnapshotReader = (state: StateRoot, serverName: string) => UpdateNetworkSnapshot;
