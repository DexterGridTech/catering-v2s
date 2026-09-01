import type {
  CommandId,
  ConnectionId,
  DispatchId,
  EnvelopeId,
  NodeId,
  ProjectionId,
  RequestId,
  RuntimeIdKind,
  RuntimeInstanceId,
  SessionId,
} from '../types/ids';

export const runtimeIdPrefixes = {
  runtime: 'run',
  request: 'req',
  command: 'cmd',
  session: 'ses',
  node: 'nod',
  connection: 'con',
  envelope: 'env',
  dispatch: 'dsp',
  projection: 'prj',
} as const satisfies Record<RuntimeIdKind, string>;

type RuntimeIdByKind = {
  runtime: RuntimeInstanceId;
  request: RequestId;
  command: CommandId;
  session: SessionId;
  node: NodeId;
  connection: ConnectionId;
  envelope: EnvelopeId;
  dispatch: DispatchId;
  projection: ProjectionId;
};

const createRandomSuffix = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  }

  return `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
};

export const createRuntimeId = <TKind extends RuntimeIdKind>(kind: TKind): RuntimeIdByKind[TKind] => {
  const payload = `${Date.now().toString(36)}_${createRandomSuffix()}`;
  return `${runtimeIdPrefixes[kind]}_${payload}` as RuntimeIdByKind[TKind];
};

export const createRuntimeInstanceId = (): RuntimeInstanceId => createRuntimeId('runtime');
export const createRequestId = (): RequestId => createRuntimeId('request');
export const createCommandId = (): CommandId => createRuntimeId('command');
export const createSessionId = (): SessionId => createRuntimeId('session');
export const createNodeId = (): NodeId => createRuntimeId('node');
export const createConnectionId = (): ConnectionId => createRuntimeId('connection');
export const createEnvelopeId = (): EnvelopeId => createRuntimeId('envelope');
export const createDispatchId = (): DispatchId => createRuntimeId('dispatch');
export const createProjectionId = (): ProjectionId => createRuntimeId('projection');
