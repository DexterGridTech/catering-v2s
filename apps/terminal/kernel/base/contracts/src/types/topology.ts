import type {SurfaceForm} from './display';

export type TopologyInstanceMode = 'MASTER' | 'SLAVE';
export type TopologyDisplayRole = 'CHIEF' | 'VICE';
export type TopologySyncDirection = 'master-to-slave' | 'slave-to-master';

export type TopologyOperation = 'query-host' | 'pair' | 'unpair' | 'enable-host' | 'switch-role';

export type TopologyFailureReasonCode =
  | 'allowed'
  | 'TOPOLOGY_UNSUPPORTED_FORM'
  | 'TOPOLOGY_REQUIRES_SINGLE_SCREEN'
  | 'TOPOLOGY_REQUIRES_MASTER'
  | 'TOPOLOGY_ALREADY_PAIRED'
  | 'TOPOLOGY_NOT_PAIRED'
  | 'TOPOLOGY_PEER_UNREACHABLE'
  | 'TOPOLOGY_IDENTITY_FAILED'
  | 'TOPOLOGY_HOST_FAILED'
  | 'TOPOLOGY_HOST_PORT_OCCUPIED'
  | 'TOPOLOGY_STALE_LOCATOR'
  | 'TOPOLOGY_INVALID_LOCATOR'
  | 'TOPOLOGY_ROLE_OCCUPIED'
  | 'TOPOLOGY_PROTOCOL_REJECTED'
  | 'TOPOLOGY_TIMEOUT'
  | 'TOPOLOGY_UNAVAILABLE'
  | 'TOPOLOGY_CODEC_FAILED'
  | 'TOPOLOGY_CHECKSUM_FAILED'
  | 'TOPOLOGY_DECODED_PAYLOAD_INVALID'
  | 'TOPOLOGY_REASSEMBLY_OVERFLOW'
  | 'TOPOLOGY_REASSEMBLY_TIMEOUT';

export type TopologyPayloadFailureCode =
  | 'TOPOLOGY_CODEC_FAILED'
  | 'TOPOLOGY_CHECKSUM_FAILED'
  | 'TOPOLOGY_DECODED_PAYLOAD_INVALID'
  | 'TOPOLOGY_REASSEMBLY_OVERFLOW'
  | 'TOPOLOGY_REASSEMBLY_TIMEOUT'
  | 'TOPOLOGY_PROTOCOL_REJECTED';

export type TopologyPayloadFailure = Readonly<{
  readonly code: TopologyPayloadFailureCode;
  readonly sliceName: string;
  readonly revision: number | null;
  readonly transferId: string | null;
  readonly deterministic: boolean;
}>;

export type TopologyLocator = Readonly<{
  readonly host: string;
  readonly port: number;
  readonly basePath: string;
  readonly identity: TopologyIdentity;
}>;

export type TopologyIdentity = Readonly<{
  readonly protocolVersion: 1;
  readonly moduleName: string;
  readonly nodeId: string;
  readonly displayName: string;
  readonly instanceMode: TopologyInstanceMode;
  readonly displayRole: TopologyDisplayRole;
}>;

export type TopologyIdentityResponse = Readonly<{
  readonly type: 'identity';
  readonly protocolVersion: 1;
  readonly moduleName: string;
  readonly nodeId: string;
  readonly displayName: string;
  readonly instanceMode: TopologyInstanceMode;
  readonly displayRole: TopologyDisplayRole;
}>;

export type TopologyLocalAddress = Readonly<{
  readonly host: string;
  readonly port: number;
  readonly basePath: string;
}>;

export type TopologyFacts = Readonly<{
  readonly surfaceForm: SurfaceForm;
  readonly displayCount: number | null;
  readonly instanceMode: TopologyInstanceMode;
  readonly displayRole: TopologyDisplayRole;
  readonly paired: boolean;
  readonly peerReachable: boolean;
  readonly hasTopologySecondarySurface: boolean;
  readonly masterLocator: TopologyLocator | null;
  readonly peerIdentity: TopologyIdentity | null;
  readonly hostAddress: TopologyLocalAddress | null;
  readonly hostDesired: boolean;
  readonly hostActual: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  readonly hostErrorCode: string | null;
  readonly payloadFailure: TopologyPayloadFailure | null;
}>;

export type TopologyOperationEligibility = Readonly<{
  readonly operation: TopologyOperation;
  readonly allowed: boolean;
  readonly reasonCode: TopologyFailureReasonCode;
}>;

export type TopologyPageAvailability = Readonly<{
  readonly available: boolean;
  readonly reasonCode: TopologyFailureReasonCode;
}>;

export type TopologyAdminCommandStatus = 'completed' | 'partial-failed' | 'timed-out' | 'error';

export type TopologyAdminCommandResult = Readonly<{
  readonly status: TopologyAdminCommandStatus;
  readonly identity?: TopologyIdentity;
  readonly reasonCode?: TopologyFailureReasonCode;
}>;

/**
 * The only topology surface an admin section may receive.  It deliberately
 * contains no runtime, state source, platform port, storage, or native
 * lifecycle handle.
 */
export type TopologyAdminCapability = Readonly<{
  readonly getSnapshot: () => TopologyFacts | undefined;
  readonly getPageAvailability: () => TopologyPageAvailability;
  readonly getOperationEligibility: (operation: TopologyOperation) => TopologyOperationEligibility;
  readonly pairByHost: (input: Readonly<{readonly host: string}>) => Promise<TopologyAdminCommandResult>;
  readonly unpair: () => Promise<TopologyAdminCommandResult>;
  readonly setHostEnabled: (enabled: boolean) => Promise<TopologyAdminCommandResult>;
}>;

export type TopologyJsonPrimitive = string | number | boolean | null;
export type TopologyJsonValue =
  TopologyJsonPrimitive | readonly TopologyJsonValue[] | Readonly<{readonly [key: string]: TopologyJsonValue}>;

/**
 * Wire-only lifecycle signal.  It is deliberately not an operation eligibility
 * reason: a peer uses it to distinguish an explicit unpair from a transient
 * transport loss before closing the channel.
 */
export type TopologyWireErrorCode = Exclude<TopologyFailureReasonCode, 'allowed'> | 'TOPOLOGY_UNPAIRED';

export type TopologyWireError = Readonly<{
  readonly code: TopologyWireErrorCode;
  readonly retryable: boolean;
}>;

export type TopologyStateFullMessage = Readonly<{
  readonly type: 'state-full';
  readonly protocolVersion: 1;
  readonly wireId: string;
  readonly sliceName: string;
  readonly direction: TopologySyncDirection;
  readonly revision: number;
  readonly value: TopologyJsonValue;
}>;

export type TopologyWireMessage =
  | Readonly<{
      readonly type: 'hello';
      readonly protocolVersion: 1;
      readonly wireId: string;
      readonly moduleName: string;
      readonly nodeId: string;
      readonly displayName: string;
      readonly instanceMode: TopologyInstanceMode;
      readonly displayRole: TopologyDisplayRole;
    }>
  | Readonly<{
      readonly type: 'hello-accepted';
      readonly protocolVersion: 1;
      readonly wireId: string;
      readonly moduleName: string;
      readonly nodeId: string;
    }>
  | Readonly<{
      readonly type: 'hello-rejected';
      readonly protocolVersion: 1;
      readonly wireId: string;
      readonly error: TopologyWireError;
    }>
  | Readonly<{
      readonly type: 'command-request';
      readonly protocolVersion: 1;
      readonly wireId: string;
      readonly requestId: string | null;
      readonly commandId: string;
      readonly parentCommandId: string | null;
      readonly commandName: string;
      readonly payload: TopologyJsonValue;
    }>
  | Readonly<{
      readonly type: 'command-result';
      readonly protocolVersion: 1;
      readonly wireId: string;
      readonly requestId: string | null;
      readonly commandId: string;
      readonly status: 'completed' | 'partial-failed' | 'timed-out' | 'error';
      readonly result: TopologyJsonValue | null;
      readonly error: TopologyWireError | null;
    }>
  | Readonly<{
      readonly type: 'command-cancel';
      readonly protocolVersion: 1;
      readonly wireId: string;
      readonly requestId: string | null;
      readonly commandId: string;
    }>
  | Readonly<{
      readonly type: 'state-full-chunk';
      readonly protocolVersion: 1;
      readonly wireId: string;
      readonly sliceName: string;
      readonly direction: TopologySyncDirection;
      readonly revision: number;
      readonly transferId: string;
      readonly index: number;
      readonly total: number;
      readonly codec: 'zlib-base64' | 'raw-base64';
      readonly rawBytes: number;
      readonly encodedBytes: number;
      readonly checksum: string;
      readonly payload: string;
    }>
  | Readonly<{
      readonly type: 'ping' | 'pong';
      readonly protocolVersion: 1;
      readonly wireId: string;
      readonly sequence: number;
    }>
  | Readonly<{
      readonly type: 'closed-error';
      readonly protocolVersion: 1;
      readonly wireId: string;
      readonly error: TopologyWireError;
    }>;
