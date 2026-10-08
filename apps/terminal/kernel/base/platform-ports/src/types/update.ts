import type {PortResult} from './result';
import type {TerminalUpdateArtifact} from '../generated/terminalUpdateArtifact';
import type {TransportHttpProxy, TransportServerAddress} from '@catering-v2s/kernel-base-contracts';

/** Current server-config facts are injected at execution time and are never persisted in an update task. */
export type UpdateNetworkSnapshot = Readonly<{
  readonly addresses: readonly TransportServerAddress[];
  readonly proxy?: TransportHttpProxy;
}>;

export type UpdateFailureCode =
  | 'SOURCE_UNAVAILABLE'
  | 'TARGET_INVALID'
  | 'IDENTITY_CONFLICT'
  | 'ALREADY_ACTIVE'
  | 'PREPARE_FAILED'
  | 'APPLY_FAILED'
  | 'ACTION_UNKNOWN'
  | 'BOOT_UNCONFIRMED'
  | 'RESOURCE_BUSY';

export interface UpdateCall {
  readonly timeoutMs: number;
}

export interface UpdateActualVersions {
  readonly applicationId: string;
  readonly nativeVersion: string;
  readonly nativeBuildNumber: number;
  readonly runtimeVersion: string;
  readonly bundleVersion: string;
  readonly publicationId: string;
  readonly bootId: string;
  readonly entryKind: 'embedded' | 'hot' | 'file-recovery' | 'unknown';
}

export interface UpdateFacts {
  readonly actual: UpdateActualVersions | null;
  readonly embedded: TerminalUpdateArtifact | null;
  readonly selectedPublicationId: string | null;
  readonly previousPublicationId: string | null;
  readonly candidatePublicationId: string | null;
  readonly installerActionId: string | null;
  readonly installerState: 'none' | 'created' | 'staged' | 'committing' | 'pending-user' | 'unknown';
  readonly selectionResetReason: 'APK_CHANGED_SELECTION_RESET' | null;
}

export interface UpdateSource {
  readonly sourceRef: string;
  readonly expectedSha256: string;
  readonly artifact: TerminalUpdateArtifact;
}

export interface PrepareUpdateArtifactInput extends UpdateCall, UpdateSource {
  /** Relative path resolved by the trusted composition provider for this opaque sourceRef. */
  readonly sourcePath: string;
  readonly network: UpdateNetworkSnapshot;
  readonly kind: 'full' | 'hot';
}

export interface UpdatePreparedArtifact {
  readonly preparedId: string;
  readonly artifact: TerminalUpdateArtifact;
}

export interface UpdateActionInput extends UpdateCall {
  readonly taskId: string;
  readonly actionId: string;
  readonly preparedId: string;
  readonly kind: 'full' | 'hot';
}

export interface UpdateAction {
  readonly actionId: string;
  readonly taskId: string;
  readonly state: 'accepted' | 'waiting-user' | 'unknown' | 'succeeded' | 'failed' | 'user-cancelled';
  readonly reason: string | null;
  readonly publicationId: string;
  readonly bootId: string | null;
}

export interface UpdatePort {
  readFacts(input: UpdateCall): Promise<PortResult<UpdateFacts>>;
  prepareArtifact(input: PrepareUpdateArtifactInput): Promise<PortResult<UpdatePreparedArtifact>>;
  applyPrepared(input: UpdateActionInput): Promise<PortResult<UpdateAction>>;
  readAction(input: UpdateCall & Readonly<{taskId: string; actionId: string}>): Promise<PortResult<UpdateAction | null>>;
  confirmBoot(
    input: UpdateCall & Readonly<{bootToken: string; publicationId: string}>,
  ): Promise<PortResult<UpdateAction>>;
  releasePrepared(input: UpdateCall & Readonly<{preparedId: string}>): Promise<PortResult<Readonly<{released: boolean}>>>;
}
