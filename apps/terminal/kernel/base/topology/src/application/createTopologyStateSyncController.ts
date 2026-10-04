import {
  createEnvelopeId,
  type TopologyJsonValue,
  type TopologyPayloadFailureCode,
  type TopologyStateFullMessage,
} from '@catering-v2s/kernel-base-contracts';
import {selectRuntimeInstanceMode, type RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import type {TopologySession} from '@catering-v2s/kernel-base-transport';
import type {StateRoot, SyncStateDiff} from '@catering-v2s/kernel-base-state';
import {topologySliceName} from '../selectors/selectTopologyState';
import type {TopologyPeerLog} from './topologyModuleTypes';

type TopologySyncDirection = TopologyStateFullMessage['direction'];

const payloadFailureCodes = new Set<TopologyPayloadFailureCode>([
  'TOPOLOGY_CODEC_FAILED',
  'TOPOLOGY_CHECKSUM_FAILED',
  'TOPOLOGY_DECODED_PAYLOAD_INVALID',
  'TOPOLOGY_REASSEMBLY_OVERFLOW',
  'TOPOLOGY_REASSEMBLY_TIMEOUT',
  'TOPOLOGY_PROTOCOL_REJECTED',
]);

type SyncSliceDeclaration = Readonly<{
  readonly name: string;
  readonly syncIntent: TopologySyncDirection;
}>;

type SliceSendState = {
  revision: number;
  lastReference?: object;
  lastFailureReference?: object;
  inFlight: boolean;
  inFlightReference?: object;
  queued: boolean;
  queuedForce: boolean;
};

type ContentSyncSummary = Readonly<{
  readonly syncEntryCount: number;
  readonly primaryContainerCount: number;
  readonly secondaryContainerCount: number;
  readonly primaryPartKey: string | null;
  readonly secondaryPartKey: string | null;
}>;

const readObject = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

const readContainerPartKey = (value: unknown): string | null => {
  const container = readObject(value);
  const partKey = container?.partKey;
  return typeof partKey === 'string' && partKey.length > 0 ? partKey : null;
};

const summarizeContentSync = (sliceName: string, value: TopologyJsonValue): Partial<ContentSyncSummary> => {
  if (!sliceName.endsWith('.content.MAIN') && !sliceName.endsWith('.content.BRANCH')) return {};
  const diff = readObject(value);
  const entries = Array.isArray(diff?.entries) ? diff.entries : [];
  const entryByKey = new Map<string, unknown>();
  for (const rawEntry of entries) {
    const entry = readObject(rawEntry);
    const key = entry?.key;
    if (typeof key === 'string') entryByKey.set(key, entry?.value);
  }
  const readContainers = (displayMode: 'PRIMARY' | 'SECONDARY') => {
    const envelope = readObject(entryByKey.get(`containers.${displayMode}`));
    const containers = envelope?.tombstone === true ? undefined : envelope?.value;
    const record = readObject(containers);
    const mainPlacement = record?.main;
    return Object.freeze({
      count: record === undefined ? 0 : Object.keys(record).length,
      partKey: readContainerPartKey(mainPlacement),
    });
  };
  const primary = readContainers('PRIMARY');
  const secondary = readContainers('SECONDARY');
  return Object.freeze({
    syncEntryCount: entries.length,
    primaryContainerCount: primary.count,
    secondaryContainerCount: secondary.count,
    primaryPartKey: primary.partKey,
    secondaryPartKey: secondary.partKey,
  });
};

export type TopologyStateSyncController = Readonly<{
  readonly sendStateSnapshots: (context: RuntimeModuleContext, force?: boolean) => void;
  readonly acceptStateFull: (
    input: Readonly<{
      readonly context: RuntimeModuleContext;
      readonly message: TopologyStateFullMessage;
      readonly readDiff: (value: TopologyJsonValue) => SyncStateDiff | undefined;
      readonly sourceConnectionId?: string;
    }>,
  ) => void;
  readonly resetReceived: () => void;
}>;

export type CreateTopologyStateSyncControllerInput = Readonly<{
  readonly stateSyncSlices?: readonly SyncSliceDeclaration[];
  readonly getSession: () => TopologySession | undefined;
  readonly isPeerAccepted: () => boolean;
  readonly getConnectionId: () => string | undefined;
  readonly onStateSliceApplied: (
    input: Readonly<{
      readonly context: RuntimeModuleContext;
      readonly connectionId: string;
      readonly sliceName: string;
      readonly revision: number;
    }>,
  ) => void;
  readonly onStateSliceApplyFailed: (
    input: Readonly<{
      readonly context: RuntimeModuleContext;
      readonly connectionId: string;
      readonly sliceName: string;
      readonly revision: number;
    }>,
  ) => void;
  readonly dispatchPayloadFailure: (
    context: RuntimeModuleContext,
    failure: Readonly<{
      readonly code: TopologyPayloadFailureCode;
      readonly sliceName?: string;
      readonly revision?: number;
      readonly transferId?: string;
      readonly deterministic: boolean;
    }>,
  ) => void;
  readonly clearPayloadFailure: (context: RuntimeModuleContext) => void;
  readonly log: TopologyPeerLog;
}>;

const stateAt = (context: RuntimeModuleContext): StateRoot => context.getState();

const outgoingDirectionFor = (state: StateRoot): TopologySyncDirection =>
  selectRuntimeInstanceMode(state) === 'MASTER' ? 'master-to-slave' : 'slave-to-master';

const incomingDirectionFor = (state: StateRoot): TopologySyncDirection =>
  selectRuntimeInstanceMode(state) === 'MASTER' ? 'slave-to-master' : 'master-to-slave';

const declarationKey = (declaration: SyncSliceDeclaration): string => `${declaration.name}:${declaration.syncIntent}`;

export const createTopologyStateSyncController = (
  input: CreateTopologyStateSyncControllerInput,
): TopologyStateSyncController => {
  const declarations: readonly SyncSliceDeclaration[] = Object.freeze(
    [...(input.stateSyncSlices ?? [])].filter(
      (candidate, index, all) => all.findIndex(other => declarationKey(other) === declarationKey(candidate)) === index,
    ),
  );
  const declarationByName = new Map<string, SyncSliceDeclaration>();
  for (const declaration of declarations) {
    const existing = declarationByName.get(declaration.name);
    if (existing !== undefined && existing.syncIntent !== declaration.syncIntent) {
      throw new Error(`Conflicting topology sync directions for ${declaration.name}`);
    }
    declarationByName.set(declaration.name, declaration);
  }

  const sendStates = new Map<string, SliceSendState>();
  const receivedRevisions = new Map<string, number>();
  let lastReceivedPayloadFailureKey: string | undefined;

  const sendSnapshot = (context: RuntimeModuleContext, declaration: SyncSliceDeclaration, force: boolean): void => {
    const state = stateAt(context);
    const topology = state[topologySliceName];
    if (topology === undefined || !input.isPeerAccepted() || input.getSession() === undefined) return;
    if (declaration.syncIntent !== outgoingDirectionFor(state)) return;
    const sliceState = state[declaration.name];
    if (sliceState === undefined || typeof sliceState !== 'object' || sliceState === null) return;
    const reference = sliceState as object;
    const sendState = sendStates.get(declaration.name) ?? {
      revision: 0,
      inFlight: false,
      queued: false,
      queuedForce: false,
    };
    sendStates.set(declaration.name, sendState);
    if (!force && reference === sendState.lastFailureReference) return;
    if (!force && reference === sendState.lastReference) return;
    if (sendState.inFlight) {
      if (sendState.inFlightReference !== reference) {
        sendState.queued = true;
        sendState.queuedForce = sendState.queuedForce || force;
      }
      return;
    }
    const payload = context.createFullSyncPayload(declaration.name);
    if (payload.status !== 'ready') return;
    const session = input.getSession();
    if (session === undefined) return;
    const value = payload.payload as unknown as TopologyJsonValue;
    const syncSummary = summarizeContentSync(declaration.name, value);
    const nextRevision = sendState.revision + 1;
    sendState.inFlight = true;
    sendState.inFlightReference = reference;
    void session
      .sendStateFull({
        sliceName: declaration.name,
        direction: declaration.syncIntent,
        revision: nextRevision,
        value,
        createWireId: () => String(createEnvelopeId()),
      })
      .then(result => {
        if (result.status === 'ready') {
          sendState.lastReference = reference;
          sendState.lastFailureReference = undefined;
          sendState.revision = nextRevision;
          input.clearPayloadFailure(context);
          input.log(
            context,
            'state-full-transfer-planned',
            {
              sliceName: declaration.name,
              direction: declaration.syncIntent,
              revision: nextRevision,
              encodedBytes: result.encodedBytes,
              codec: result.codec,
              frameCount: result.frames.length,
              ...syncSummary,
            },
            input.getConnectionId(),
          );
        } else {
          if (result.deterministic && payloadFailureCodes.has(result.code as TopologyPayloadFailureCode)) {
            sendState.lastFailureReference = reference;
            input.dispatchPayloadFailure(context, {
              code: result.code as TopologyPayloadFailureCode,
              sliceName: declaration.name,
              revision: nextRevision,
              deterministic: true,
            });
          }
          input.log(
            context,
            'state-full-transfer-failed',
            {
              sliceName: declaration.name,
              direction: declaration.syncIntent,
              revision: nextRevision,
              reason: result.code,
              deterministic: result.deterministic,
            },
            input.getConnectionId(),
          );
        }
      })
      .finally(() => {
        sendState.inFlight = false;
        sendState.inFlightReference = undefined;
        if (sendState.queued) {
          const queuedForce = sendState.queuedForce;
          sendState.queued = false;
          sendState.queuedForce = false;
          sendSnapshot(context, declaration, queuedForce);
        }
      });
  };

  const sendStateSnapshots = (context: RuntimeModuleContext, force = false): void => {
    for (const declaration of declarations) sendSnapshot(context, declaration, force);
  };

  const resetReceived = (): void => {
    receivedRevisions.clear();
    lastReceivedPayloadFailureKey = undefined;
  };

  const acceptStateFull = ({
    context,
    message,
    readDiff,
    sourceConnectionId,
  }: Parameters<TopologyStateSyncController['acceptStateFull']>[0]): void => {
    const currentConnectionId = input.getConnectionId();
    if (
      sourceConnectionId === undefined ||
      currentConnectionId === undefined ||
      sourceConnectionId !== currentConnectionId ||
      !input.isPeerAccepted()
    ) {
      input.log(context, 'state-full-ignored', {reason: 'stale-peer-connection'}, sourceConnectionId);
      return;
    }
    const state = stateAt(context);
    const declaration = declarationByName.get(message.sliceName);
    const expectedDirection = incomingDirectionFor(state);
    if (
      declaration === undefined ||
      declaration.syncIntent !== message.direction ||
      message.direction !== expectedDirection
    ) {
      input.log(
        context,
        'state-full-ignored',
        {
          reason: 'direction-or-role-mismatch',
          sliceName: message.sliceName,
          direction: message.direction,
          revision: message.revision,
        },
        input.getConnectionId(),
      );
      return;
    }
    const lastRevision = receivedRevisions.get(message.sliceName) ?? 0;
    if (message.revision <= lastRevision) {
      input.log(
        context,
        'state-full-ignored',
        {
          reason: 'stale-revision',
          sliceName: message.sliceName,
          revision: message.revision,
          lastReceivedRevision: lastRevision,
        },
        input.getConnectionId(),
      );
      return;
    }
    const diff = readDiff(message.value);
    if (diff === undefined) {
      const failureKey = `${message.sliceName}:${message.revision}:TOPOLOGY_DECODED_PAYLOAD_INVALID`;
      if (lastReceivedPayloadFailureKey === failureKey) return;
      input.log(
        context,
        'state-full-rejected',
        {
          reason: 'invalid-payload',
          sliceName: message.sliceName,
          revision: message.revision,
        },
        input.getConnectionId(),
      );
      lastReceivedPayloadFailureKey = failureKey;
      input.onStateSliceApplyFailed({
        context,
        connectionId: sourceConnectionId,
        sliceName: message.sliceName,
        revision: message.revision,
      });
      input.dispatchPayloadFailure(context, {
        code: 'TOPOLOGY_DECODED_PAYLOAD_INVALID',
        sliceName: message.sliceName,
        revision: message.revision,
        deterministic: true,
      });
      return;
    }
    const applied = context.applyAuthoritativeSync(message.sliceName, diff);
    if (applied.status === 'skipped') {
      const failureKey = `${message.sliceName}:${message.revision}:TOPOLOGY_PROTOCOL_REJECTED`;
      if (lastReceivedPayloadFailureKey === failureKey) return;
      input.log(
        context,
        'state-full-rejected',
        {
          reason: applied.reason,
          sliceName: message.sliceName,
          revision: message.revision,
        },
        input.getConnectionId(),
      );
      lastReceivedPayloadFailureKey = failureKey;
      input.onStateSliceApplyFailed({
        context,
        connectionId: sourceConnectionId,
        sliceName: message.sliceName,
        revision: message.revision,
      });
      input.dispatchPayloadFailure(context, {
        code: 'TOPOLOGY_PROTOCOL_REJECTED',
        sliceName: message.sliceName,
        revision: message.revision,
        deterministic: true,
      });
      return;
    }
    input.log(
      context,
      'state-full-applied',
      {
        sliceName: message.sliceName,
        direction: message.direction,
        revision: message.revision,
        changed: applied.changed,
        ...summarizeContentSync(message.sliceName, message.value),
      },
      input.getConnectionId(),
    );
    receivedRevisions.set(message.sliceName, message.revision);
    input.onStateSliceApplied({
      context,
      connectionId: sourceConnectionId,
      sliceName: message.sliceName,
      revision: message.revision,
    });
    lastReceivedPayloadFailureKey = undefined;
    input.clearPayloadFailure(context);
  };

  return Object.freeze({sendStateSnapshots, acceptStateFull, resetReceived});
};
