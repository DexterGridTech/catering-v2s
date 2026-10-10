import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {
  TerminalUpdateArtifact,
  UpdateActualVersions,
  UpdateNetworkSnapshot,
} from '@catering-v2s/kernel-base-platform-ports';
import type {StateJsonObject, StateRoot} from '@catering-v2s/kernel-base-state';
import type {TerminalUpdateReportPayload} from '@catering-v2s/kernel-base-terminal-data-client';

export interface UpdateArtifactSource {
  readonly sourceRef: string;
  readonly expectedSha256: string;
  /** Required for registered FULL snapshot identities; null for HOT and optional only in local fixtures. */
  readonly apkSha256?: string | null;
  readonly artifact: Pick<TerminalUpdateArtifact,
    'applicationId' | 'nativeVersion' | 'nativeBuildNumber' | 'bundleVersion' | 'runtimeVersion' | 'publicationId'>;
  /** Full immutable manifest is only carried by local test fixtures; CBS targets fetch it with the one-attempt grant. */
  readonly manifest?: TerminalUpdateArtifact;
  /** CBS-owned artifact identity; present for private registered content, absent for local fixtures. */
  readonly artifactRef?: string;
}

export interface FixedUpdateTarget {
  readonly ruleRef: string;
  /** Hash of the complete project rule collection from which this target was selected. */
  readonly collectionHash: string;
  readonly createdAt: TimestampMs;
  readonly applicationId: string;
  readonly full: UpdateArtifactSource | null;
  readonly hot: UpdateArtifactSource | null;
  /** Business timing is fixed with the task; it is not re-read from later project rules. */
  readonly policy: Readonly<{nSeconds: number; hotStrategy: 'IMMEDIATE' | 'IDLE' | null; mSeconds: number | null}>;
  readonly strategy: Readonly<{maxNetworkAttempts: number; bootTimeoutMs: number}>;
  readonly selectionContext: Readonly<{selectedSpace: string; contextIdentity: string; ruleRef: string}>;
}

export type RequestTerminalUpdatePayload = StateJsonObject;

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
    | 'waiting-idle'
    | 'waiting-user'
    | 'unknown'
    | 'succeeded'
    | 'failed';
  readonly actionId: string | null;
  /** Artifact kind bound to actionId while its outcome is pending or being reconciled. */
  readonly actionKind: 'full' | 'hot' | null;
  readonly preparedId: string | null;
  readonly bootId: string | null;
  /** Last user-facing FULL installation invitation time, used only for the fixed task's N reminder. */
  readonly lastInviteAt?: TimestampMs | null;
  readonly failureCode: string | null;
}

export interface TerminalUpdateRecentStatus {
  readonly taskId: string | null;
  readonly state: 'idle' | 'fixed' | 'preparing' | 'applying' | 'waiting-idle' | 'waiting-user' | 'unknown' | 'succeeded' | 'failed';
  readonly reason: string | null;
  readonly changedAt: TimestampMs;
  readonly applicationId?: string | null;
  readonly ruleRef?: string | null;
  readonly fullArtifactRef?: string | null;
  readonly hotArtifactRef?: string | null;
}

export interface TerminalUpdateState {
  readonly currentTask: TerminalUpdateTask | null;
  readonly recentStatus: TerminalUpdateRecentStatus;
  readonly failedArtifactIds: readonly string[];
  readonly actualVersions: UpdateActualVersions | null;
  /** One ephemeral, local invitation. It is neither persisted nor projected to a paired Runtime. */
  readonly invitation?: Readonly<{taskId: string; actionId: string | null; bootId: string}> | null;
  readonly reportDescriptor: Readonly<{
    readonly bindingIdentity: string | null;
    readonly contextIdentity: string | null;
    readonly nextReportSequence: number;
    /** Last taskless actual-version fact reported for this binding/context; bootId is intentionally excluded. */
    readonly lastObservationFactsKey?: string | null;
    readonly pendingReports: Readonly<Record<string, TerminalUpdateReportPayload>>;
    readonly sendPaused: boolean;
    readonly latestDeliveryFailure: Readonly<{
      taskId: string | null;
      reportId: string;
      reportSequence: number;
      reasonCode: string;
      observedAt: TimestampMs;
    }> | null;
  }>;
}

export type TerminalUpdateContextFacts = Readonly<{
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

export type CurrentUpdateTargetReader = (state: StateRoot, requested: FixedUpdateTarget) => FixedUpdateTarget | null;

export type UpdateNetworkSnapshotReader = (state: StateRoot, serverName: string) => UpdateNetworkSnapshot;
