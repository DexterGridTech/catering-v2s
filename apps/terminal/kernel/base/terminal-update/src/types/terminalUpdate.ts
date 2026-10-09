import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {
  TerminalUpdateArtifact,
  UpdateActualVersions,
  UpdateNetworkSnapshot,
} from '@catering-v2s/kernel-base-platform-ports';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import type {TerminalUpdateReportPayload} from '@catering-v2s/kernel-base-terminal-data-client';
import type {TerminalUpdateRuleSnapshotItem} from '@catering-v2s/kernel-base-terminal-data-client';

export interface UpdateArtifactSource {
  readonly sourceRef: string;
  readonly expectedSha256: string;
  readonly artifact: Pick<TerminalUpdateArtifact,
    'applicationId' | 'nativeVersion' | 'nativeBuildNumber' | 'bundleVersion' | 'runtimeVersion' | 'publicationId'>;
  /** Full immutable manifest is only carried by local test fixtures; CBS targets fetch it with the one-attempt grant. */
  readonly manifest?: TerminalUpdateArtifact;
  /** CBS-owned artifact identity; present for private registered content, absent for local fixtures. */
  readonly artifactRef?: string;
}

export interface FixedUpdateTarget {
  readonly ruleRef: string;
  readonly createdAt: TimestampMs;
  readonly applicationId: string;
  readonly full: UpdateArtifactSource | null;
  readonly hot: UpdateArtifactSource | null;
  readonly strategy: Readonly<{maxNetworkAttempts: number; bootTimeoutMs: number}>;
  readonly selectionContext: Readonly<{selectedSpace: string; contextIdentity: string; ruleRef: string}>;
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
  /** Artifact kind bound to actionId while its outcome is pending or being reconciled. */
  readonly actionKind: 'full' | 'hot' | null;
  readonly preparedId: string | null;
  readonly bootId: string | null;
  readonly failureCode: string | null;
}

export interface TerminalUpdateRecentStatus {
  readonly taskId: string | null;
  readonly state: 'idle' | 'fixed' | 'preparing' | 'applying' | 'waiting-user' | 'unknown' | 'succeeded' | 'failed';
  readonly reason: string | null;
  readonly changedAt: TimestampMs;
  readonly applicationId?: string | null;
  readonly ruleRef?: string | null;
  readonly fullArtifactRef?: string | null;
  readonly hotArtifactRef?: string | null;
}

export interface TerminalUpdateState {
  readonly ruleSnapshot: Readonly<{
    readonly contextIdentity: string | null;
    readonly selectedSpace: string | null;
    readonly projectRef: string | null;
    readonly collectionHash: string | null;
    readonly items: readonly StoredTerminalUpdateRule[];
  }>;
  readonly ruleSnapshotStatus: Readonly<{status: 'empty' | 'ready' | 'failed'; errorCode: string | null}>;
  readonly currentTask: TerminalUpdateTask | null;
  readonly recentStatus: TerminalUpdateRecentStatus;
  readonly failedArtifactIds: readonly string[];
  readonly actualVersions: UpdateActualVersions | null;
  readonly reportDescriptor: Readonly<{
    readonly bindingIdentity: string | null;
    readonly contextIdentity: string | null;
    readonly nextReportSequence: number;
    readonly pendingReports: Readonly<Record<string, TerminalUpdateReportPayload>>;
    readonly sendPaused: boolean;
    readonly latestDeliveryFailure: Readonly<{reportId: string; code: string; changedAt: TimestampMs}> | null;
  }>;
}

export type StoredTerminalUpdateArtifactSummary = Readonly<{
  artifactRef: string;
  kind: 'FULL' | 'HOT';
  applicationId: string;
  runtimeVersion: string;
  nativeBuildNumber: number;
  apkVersion: string;
  jsVersion: string;
  publicationId: string;
  zipSha256: string;
  byteSize: number;
  createdAtEpochMillis: number;
}>;

export type StoredTerminalUpdateRule = Readonly<{
  ruleRef: string;
  targetMode: 'ALL' | 'STORE_REFS';
  storeRefs: readonly string[];
  applicationId: string;
  createdAtEpochMillis: number;
  full: StoredTerminalUpdateArtifactSummary;
  hot: StoredTerminalUpdateArtifactSummary | null;
  nSeconds: number;
  hotStrategy: 'IMMEDIATE' | 'IDLE';
  mSeconds: number | null;
  description: string | null;
}>;

export type UpdateRuleSnapshotContext = Readonly<{
  readonly terminalRef: string;
  readonly bindingGeneration: number;
  readonly selectedSpace: string;
  readonly storeRef: string;
  readonly projectRef: string;
  readonly projectUpdatedAtEpochMillis: number;
}>;

export interface UpdateTargetSourceProvider {
  readTarget(selectionContext: FixedUpdateTarget['selectionContext']): Promise<FixedUpdateTarget | null>;
  /** Resolve a persisted opaque ref after process recreation; never persist the path in currentTask. */
  resolveSourcePath?(sourceRef: string): string | null | Promise<string | null>;
}

export type UpdateNetworkSnapshotReader = (state: StateRoot, serverName: string) => UpdateNetworkSnapshot;
