import type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';
import type {
  TransportCommandGateway,
  TransportConnection,
  TransportConnectionEvent,
} from '@catering-v2s/kernel-base-transport';
import type {
  TerminalActivationRequest,
  TerminalExecutionResult,
  TerminalOperationResult,
} from '../generated/terminalApi';

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
  readonly groupWorkspaceKey: string;
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

export type TerminalClientState = Readonly<{
  readonly credential: TerminalCredential | null;
  readonly pendingActivations: Readonly<Record<string, PendingTerminalActivation>>;
  readonly activationStatus: TerminalActivationView['status'];
  readonly connection: TerminalConnectionView;
  readonly heartbeatIntervalMs: number | null;
  readonly nextPingSequence: number;
  readonly lastRttMs: number;
  readonly latencySamples: readonly TerminalLatencySample[];
}>;

export type ActivateTerminalPayload = Readonly<{
  readonly operationId: string;
  readonly groupWorkspaceKey: string;
  readonly activationCode: string;
  readonly surfaceForm: TerminalSurfaceForm;
  readonly appVersion: string;
}>;

export type CancelTerminalOnlinePayload = Readonly<{
  readonly groupWorkspaceKey: string;
  readonly terminalRef: string;
}>;

export type TerminalTransportEvent = TransportConnectionEvent;
export type TerminalTransportConnection = TransportConnection;
/** Compatibility alias for the transport owner command facade. */
export type TerminalTransportCommands = TransportCommandGateway;

export type TerminalDataClientDependencies = Readonly<{
  readonly transport: TerminalTransportCommands;
  readonly businessServerName: string;
  readonly createCredentialSecret: () => string;
  readonly now: () => number;
  readonly appVersion: string;
}>;

export type TerminalClientExecution = TerminalExecutionResult | TerminalOperationResult<'activateTerminal'>;
