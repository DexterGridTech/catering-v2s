declare const runtimeIdBrand: unique symbol;

type RuntimeId<TName extends string> = string & {
  readonly [runtimeIdBrand]: TName;
};

export type TimestampMs = number;

export type RuntimeInstanceId = RuntimeId<'RuntimeInstanceId'>;
export type RequestId = RuntimeId<'RequestId'>;
export type CommandId = RuntimeId<'CommandId'>;
export type SessionId = RuntimeId<'SessionId'>;
export type NodeId = RuntimeId<'NodeId'>;
export type ConnectionId = RuntimeId<'ConnectionId'>;
export type EnvelopeId = RuntimeId<'EnvelopeId'>;
export type DispatchId = RuntimeId<'DispatchId'>;
export type ProjectionId = RuntimeId<'ProjectionId'>;

export type RuntimeIdKind =
  'runtime' | 'request' | 'command' | 'session' | 'node' | 'connection' | 'envelope' | 'dispatch' | 'projection';
