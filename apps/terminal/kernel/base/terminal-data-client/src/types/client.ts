import type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import type {
  TransportCommandGateway,
  TransportConnection,
  TransportConnectionEvent,
} from '@catering-v2s/kernel-base-transport';
import type {
  TerminalActivationRequest,
  TerminalExecutionResult,
  TerminalOperationId,
  TerminalOperationResult,
  TerminalRequestMap,
} from '../generated/terminalApi';
import type {TerminalTopicKey} from '../generated/terminalConnectionProtocol';

type IsSameType<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type AssertTrue<Value extends true> = Value;
type SurfaceFormContractMatchesGeneratedRequest = AssertTrue<
  IsSameType<SurfaceForm, TerminalActivationRequest['surfaceForm']>
>;
type TerminalSurfaceForm = SurfaceFormContractMatchesGeneratedRequest extends true ? SurfaceForm : never;

export type TerminalCredential = Readonly<{
  readonly groupWorkspaceKey: string;
  readonly terminalRef: string;
  readonly storeRef: string;
  readonly deviceId: string;
  readonly bindingGeneration: number;
  readonly credentialSecret: string;
}>;

/** Current-JS-runtime retry context only; the activation operation ends on runtime restart. */
export type PendingTerminalActivation = Readonly<{
  readonly operationId: string;
  readonly activationCode: string;
  readonly deviceId: string;
  readonly surfaceForm: TerminalSurfaceForm;
  readonly appVersion: string;
  readonly credentialSecret: string;
}>;

export type TerminalActivationView = Readonly<{
  readonly status: 'inactive' | 'activating' | 'active' | 'cancelling';
  readonly terminalRef: string | null;
  readonly storeRef: string | null;
  readonly groupWorkspaceKey: string | null;
  readonly bindingGeneration: number | null;
}>;

export type TerminalConnectionCloseReason =
  | 'ACTIVATION_CANCELLED'
  | 'CREDENTIAL_INVALID'
  | 'GROUP_WORKSPACE_DISABLED'
  | 'TERMINAL_DISABLED'
  | 'SESSION_REPLACED'
  | 'REDIRECT_TO_NEXT_NODE'
  | 'NODE_BUSY'
  | 'AUTHENTICATION_TIMEOUT'
  | 'HEARTBEAT_TIMEOUT'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export type TerminalConnectionView = Readonly<{
  readonly status: 'stopped' | 'disconnected' | 'connecting' | 'awaiting-ready' | 'connected' | 'backoff';
  readonly addressName: string | null;
  readonly nodeId: string | null;
  readonly lastCloseReason: TerminalConnectionCloseReason | null;
}>;

export type TerminalLatencySample = Readonly<{readonly rttMs: number; readonly observedAt: number}>;

/** Persisted only until the TDS has durably accepted the current report. */
export type RemoteOperationFact = Readonly<{
  readonly remoteOperationId: string;
  readonly requestId: string;
  readonly localRequestId: string;
  readonly groupWorkspaceKey: string;
  readonly terminalRef: string;
  readonly bindingGeneration: number;
  readonly addressName: string | null;
  readonly configRevision: number | null;
  readonly commandName: string;
  readonly phase: 'RECEIVED' | 'STARTED' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';
  readonly reportId: string;
  readonly occurredAt: string;
  readonly resultJson?: string;
  readonly errorCode?: string;
}>;

export type TerminalTopicSubscription = Readonly<{
  readonly subscriptionId: string;
  readonly identityKey: string;
  readonly subscriberKey: string;
  readonly topicKey: TerminalTopicKey;
  readonly ownerRef: string;
  readonly acceptedTimeEpochMillis: number;
  readonly pendingNotification: TerminalTopicNotification | null;
}>;

export type TerminalTopicNotification = Readonly<{
  readonly notificationId: string;
  readonly subscriptionId: string;
  readonly topicKey: TerminalTopicKey;
  readonly ownerRef: string;
  readonly topicTimeEpochMillis: number;
}>;

export type TerminalClientState = Readonly<{
  readonly credential: TerminalCredential | null;
  readonly pendingActivations: Readonly<Record<string, PendingTerminalActivation>>;
  readonly activationStatus: TerminalActivationView['status'];
  readonly connection: TerminalConnectionView;
  readonly heartbeatIntervalMs: number | null;
  readonly nextPingSequence: number;
  readonly lastRttMs: number;
  readonly latencySamples: readonly TerminalLatencySample[];
  readonly topicSubscriptions: Readonly<Record<string, TerminalTopicSubscription>>;
  readonly acceptedTopicTimes: Readonly<Record<string, number>>;
  readonly remoteOperations: Readonly<Record<string, RemoteOperationFact>>;
}>;

export type SubscribeTerminalTopicPayload = Readonly<{
  readonly subscriberKey: string;
  readonly topicKey: TerminalTopicKey;
  readonly ownerRef: string;
  readonly initialTimeEpochMillis: number;
}>;

export type UnsubscribeTerminalTopicPayload = Readonly<{
  readonly subscriberKey: string;
  readonly topicKey: TerminalTopicKey;
  readonly ownerRef: string;
}>;

export type AcceptTerminalTopicNotificationPayload = Readonly<{
  readonly subscriberKey: string;
  readonly subscriptionId: string;
  readonly notificationId: string;
}>;

export type TerminalReadOperationId = Exclude<TerminalOperationId, 'activateTerminal' | 'cancelTerminalActivation'>;
/** Read operation plus path only; TDC constructs all credential headers itself. */
export type TerminalDataReadPayload = {
  readonly [OperationId in TerminalReadOperationId]: Readonly<{
    readonly operationId: OperationId;
    readonly pathParameters: TerminalRequestMap[OperationId]['pathParameters'];
  }>;
}[TerminalReadOperationId];

/** Shared Runtime command fanned out to feature actors; each consumer matches its own subscription. */
export type TerminalTopicChangedPayload = Readonly<{
  readonly subscriberKey: string;
  readonly terminalRef: string;
  readonly bindingGeneration: number;
  readonly notification: TerminalTopicNotification;
}>;

/** Secret-free, current-host status shared read-only with a paired slave runtime. */
export type TerminalClientStatusProjection = Readonly<{
  readonly available: boolean;
  readonly sourceNodeId: string | null;
  readonly activation: TerminalActivationView | null;
  readonly connection: TerminalConnectionView | null;
  readonly lastRttMs: number | null;
  readonly updatedAt: number;
}>;

export type TerminalClientStatusProjectionState = Readonly<{
  readonly projection: TerminalClientStatusProjection;
}>;

export type ActivateTerminalPayload = Readonly<{
  readonly activationCode: string;
}>;

export type TerminalActivationSucceededPayload = Readonly<{
  readonly terminalRef: string;
  readonly storeRef: string;
  readonly groupWorkspaceKey: string;
  readonly bindingGeneration: number;
}>;

export type CancelTerminaActivationPayload = Readonly<{}>;

export type TerminalTransportEvent = TransportConnectionEvent;
export type TerminalTransportConnection = TransportConnection;
/** Compatibility alias for the transport owner command facade. */
export type TerminalTransportCommands = TransportCommandGateway;

export type TerminalDataClientDependencies = Readonly<{
  readonly transport: TerminalTransportCommands;
  readonly businessServerName: string;
  readonly createCredentialSecret: () => string | Promise<string>;
  /** Platform-provided RFC 4122 UUID generator for wire subscription identities. */
  readonly createProtocolUuid?: () => string;
  readonly now: () => number;
  readonly surfaceForm: TerminalSurfaceForm;
  readonly appVersion: string;
  readonly canActivate?: (state: StateRoot) => boolean;
}>;

export type TerminalClientExecution = TerminalExecutionResult | TerminalOperationResult<'activateTerminal'>;
