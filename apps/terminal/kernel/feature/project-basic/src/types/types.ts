import type {TerminalStoreOrganizationPathRead} from '@catering-v2s/kernel-base-terminal-data-client';
import type {StoreBasicBinding, StoreFact} from '@catering-v2s/kernel-feature-store-basic';

export type StoredTerminalUpdateArtifactSummary = Readonly<{
  artifactRef: string;
  kind: 'FULL' | 'HOT';
  applicationId: string;
  runtimeVersion: string;
  nativeBuildNumber: number;
  apkVersion: string;
  jsVersion: string;
  publicationId: string;
  apkSha256: string | null;
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
  hotStrategy: 'IMMEDIATE' | 'IDLE' | null;
  mSeconds: number | null;
  description: string | null;
}>;

export type ProjectBasicState = Readonly<{
  binding: StoreBasicBinding | null;
  organizationPath: StoreFact<TerminalStoreOrganizationPathRead> | null;
  ruleSnapshot: Readonly<{
    contextIdentity: string | null;
    selectedSpace: string | null;
    projectRef: string | null;
    collectionHash: string | null;
    items: readonly StoredTerminalUpdateRule[];
  }>;
  ruleSnapshotStatus: Readonly<{status: 'empty' | 'loading' | 'ready' | 'failed'; errorCode: string | null}>;
  loadReadiness: Readonly<{
    runtimeId: string | null;
    binding: StoreBasicBinding | null;
    status: 'idle' | 'loading' | 'flushed' | 'failed';
    projectRef: string | null;
  }>;
  readStates: Readonly<Partial<Record<'PROJECT' | 'REGION' | 'COMMERCIAL_GROUP' | 'TERMINAL_UPDATE_RULES', 'idle' | 'loading' | 'loaded' | 'failed'>>>;
  failures: Readonly<Partial<Record<'PROJECT' | 'REGION' | 'COMMERCIAL_GROUP' | 'TERMINAL_UPDATE_RULES', string>>>;
}>;

export type ProjectTerminalUpdateCandidate = Readonly<{
  collectionHash: string;
  contextIdentity: string;
  selectedSpace: string;
  projectRef: string;
  storeRef: string;
  rule: StoredTerminalUpdateRule;
}>;


