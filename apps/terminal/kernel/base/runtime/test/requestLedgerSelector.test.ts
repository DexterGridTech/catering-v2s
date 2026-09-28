import {describe, expect, it} from 'vitest';
import {
  createCommandId,
  createRequestId,
  type CommandId,
  type RequestId,
  type TimestampMs,
} from '@catering-v2s/kernel-base-contracts';
import {
  createStateRuntime,
  createSyncTombstone,
  type StateJsonValue,
  type StateRoot,
} from '@catering-v2s/kernel-base-state';
import {
  setRuntimeInstanceModeAction,
  runtimeInstanceModeSlice,
  runtimeInstanceModeSliceName,
} from '../src/features/slices/runtimeInstanceMode';
import {
  requestLedgerActionsForMode,
  readLiveRequestEnvelope,
  runtimeRequestLedgerMasterSlice,
  runtimeRequestLedgerMasterSliceName,
  runtimeRequestLedgerSlaveSlice,
  runtimeRequestLedgerSlaveSliceName,
  type RuntimeRequestLedgerState,
} from '../src/features/slices/requestLedger';
import {selectRequestExecutionCommands, selectRequestExecutionView, selectRequestExecutionViews} from '../src/index';
import type {ActorExecutionRecord, CommandExecutionObservation, LedgerError} from '../src/types/execution';
import type {RequestExecutionRecord} from '../src/types/requestLedger';
import {createTestPlatformPorts} from './testSupport';

const error: LedgerError = Object.freeze({
  key: 'test.error',
  code: 'TEST_ERROR',
  message: 'failed',
  category: 'SYSTEM',
  severity: 'MEDIUM',
});

const actor = (
  actorKey: string,
  status: ActorExecutionRecord['status'],
  result: StateJsonValue = null,
  failure: LedgerError | null = null,
): ActorExecutionRecord =>
  Object.freeze({
    actorKey,
    status,
    startedAt: 1,
    completedAt: status === 'running' ? null : 2,
    result,
    error: failure,
  });

const observation = (
  input: Readonly<{
    commandId?: CommandId;
    parentCommandId?: CommandId | null;
    name?: string;
    startedAt?: TimestampMs;
    completedAt?: TimestampMs | null;
    displayMode?: 'PRIMARY' | 'SECONDARY' | null;
    actors?: readonly ActorExecutionRecord[];
  }> = {},
): CommandExecutionObservation =>
  Object.freeze({
    commandId: input.commandId ?? createCommandId(),
    parentCommandId: input.parentCommandId ?? null,
    commandName: input.name ?? 'test.command',
    target: 'local',
    allowNoActor: false,
    actorResults: Object.freeze([...(input.actors ?? [actor('test.actor', 'completed', {ok: true})])]),
    startedAt: input.startedAt ?? 1,
    completedAt: input.completedAt === undefined ? 2 : input.completedAt,
    displayMode: input.displayMode ?? null,
  });

const record = (
  requestId: RequestId,
  input: Readonly<{
    workspace?: 'MAIN' | 'BRANCH' | null;
    startedAt?: TimestampMs;
    commands: readonly CommandExecutionObservation[];
  }>,
): RequestExecutionRecord =>
  Object.freeze({
    requestId,
    workspace: input.workspace ?? null,
    startedAt: input.startedAt ?? 1,
    commands: Object.freeze([...input.commands]),
  });

const stateWith = (
  input: Readonly<{
    mode?: 'MASTER' | 'SLAVE';
    master?: RuntimeRequestLedgerState;
    slave?: RuntimeRequestLedgerState;
  }>,
): StateRoot => ({
  [runtimeInstanceModeSliceName]: {instanceMode: input.mode ?? 'MASTER'},
  [runtimeRequestLedgerMasterSliceName]: input.master ?? {},
  [runtimeRequestLedgerSlaveSliceName]: input.slave ?? {},
});

const envelope = (request: RequestExecutionRecord, updatedAt: TimestampMs) =>
  Object.freeze({value: request, updatedAt});

describe('runtime request ledger selectors', () => {
  it('A-1 keeps both mode registrations isolated from topology sync', () => {
    const masterRegistration = runtimeRequestLedgerMasterSlice;
    const slaveRegistration = runtimeRequestLedgerSlaveSlice;

    expect(masterRegistration).not.toBe(slaveRegistration);
    expect(masterRegistration.syncIntent).toBe('isolated');
    expect(slaveRegistration.syncIntent).toBe('isolated');
  });

  it('L-3 calculates local-only and peer-only views from the only existing half', () => {
    const localRequestId = createRequestId();
    const peerRequestId = createRequestId();
    const localCommand = observation({
      actors: [actor('test.local', 'completed', {local: true})],
      displayMode: 'PRIMARY',
    });
    const peerCommand = observation({actors: [actor('test.peer', 'error', null, error)], displayMode: 'SECONDARY'});
    const state = stateWith({
      master: {[localRequestId]: envelope(record(localRequestId, {workspace: 'MAIN', commands: [localCommand]}), 10)},
      slave: {[peerRequestId]: envelope(record(peerRequestId, {workspace: 'BRANCH', commands: [peerCommand]}), 20)},
    });

    const local = selectRequestExecutionView(state, localRequestId);
    const peer = selectRequestExecutionView(state, peerRequestId);

    expect(local).toMatchObject({status: 'completed', workspace: 'MAIN', timeSource: 'local'});
    expect(local?.commands[0]?.results).toEqual([{local: true}]);
    expect(peer).toMatchObject({status: 'error', workspace: 'BRANCH', timeSource: 'peer'});
    expect(peer?.commands[0]?.errors).toEqual([error]);
    expect(selectRequestExecutionView(stateWith({}), localRequestId)).toBeNull();
  });

  it('L-4 keeps both same-command observations but lets local status win', () => {
    const requestId = createRequestId();
    const commandId = createCommandId();
    const local = observation({
      commandId,
      actors: [actor('test.local', 'timed-out')],
      completedAt: 20,
    });
    const peer = observation({
      commandId,
      actors: [actor('test.peer', 'completed', {peer: true})],
      completedAt: 30,
    });
    const state = stateWith({
      master: {[requestId]: envelope(record(requestId, {commands: [local]}), 20)},
      slave: {[requestId]: envelope(record(requestId, {commands: [peer]}), 30)},
    });

    const view = selectRequestExecutionView(state, requestId);

    expect(view?.status).toBe('timed-out');
    expect(view?.commands[0]?.status).toBe('timed-out');
    expect(view?.commands[0]?.observations.map(item => item.source)).toEqual(['local', 'peer']);
    expect(view?.commands[0]?.results).toEqual([null, {peer: true}]);
  });

  it('L-4c preserves ordered actor result slots including failed actors', () => {
    const requestId = createRequestId();
    const command = observation({
      actors: [
        actor('test.first', 'completed', {first: true}),
        actor('test.failed', 'error', null, error),
        actor('test.second', 'completed', {second: true}),
      ],
    });
    const state = stateWith({
      master: {[requestId]: envelope(record(requestId, {commands: [command]}), 10)},
    });

    const view = selectRequestExecutionView(state, requestId);

    expect(view?.commands[0]?.results).toEqual([{first: true}, null, {second: true}]);
    expect(view?.commands[0]?.errors).toEqual([error]);
  });

  it('L-4b derives all root command ids without inventing a root', () => {
    const requestId = createRequestId();
    const parentA = createCommandId();
    const parentB = createCommandId();
    const child = createCommandId();
    const peerOnly = stateWith({
      slave: {
        [requestId]: envelope(
          record(requestId, {commands: [observation({commandId: child, parentCommandId: parentA, startedAt: 3})]}),
          10,
        ),
      },
    });
    const merged = stateWith({
      master: {
        [requestId]: envelope(
          record(requestId, {
            commands: [
              observation({commandId: parentA, startedAt: 1}),
              observation({commandId: parentB, startedAt: 2}),
            ],
          }),
          11,
        ),
      },
      slave: peerOnly[runtimeRequestLedgerSlaveSliceName] as RuntimeRequestLedgerState,
    });

    expect(selectRequestExecutionView(peerOnly, requestId)?.rootCommandIds).toEqual([]);
    expect(selectRequestExecutionView(merged, requestId)?.rootCommandIds).toEqual([parentA, parentB]);
  });

  it('L-5 separates request workspace filtering from command display filtering', () => {
    const requestId = createRequestId();
    const primary = observation({displayMode: 'PRIMARY', startedAt: 1});
    const device = observation({displayMode: null, startedAt: 2});
    const branch = stateWith({
      master: {[requestId]: envelope(record(requestId, {workspace: null, commands: [primary, device]}), 10)},
    });

    expect(selectRequestExecutionViews(branch, 'MAIN').map(view => view.requestId)).toEqual([requestId]);
    expect(selectRequestExecutionViews(branch, 'BRANCH').map(view => view.requestId)).toEqual([requestId]);
    expect(selectRequestExecutionCommands(branch, requestId, 'SECONDARY').map(command => command.commandId)).toEqual([
      device.commandId,
    ]);
    expect(selectRequestExecutionCommands(branch, requestId, 'PRIMARY').map(command => command.commandId)).toEqual([
      primary.commandId,
      device.commandId,
    ]);
  });

  it('L-6 memoizes by request envelope references, including peer-only requests', () => {
    const requestA = createRequestId();
    const requestB = createRequestId();
    const state = stateWith({
      slave: {
        [requestA]: envelope(record(requestA, {commands: [observation({name: 'test.a'})]}), 10),
        [requestB]: envelope(record(requestB, {commands: [observation({name: 'test.b'})]}), 11),
      },
    });
    const viewA1 = selectRequestExecutionView(state, requestA);
    const viewB1 = selectRequestExecutionView(state, requestB);
    const listA = selectRequestExecutionViews(state);
    const listAById = new Map(listA.map(view => [String(view.requestId), view]));
    const listB = selectRequestExecutionViews(state);
    const listBById = new Map(listB.map(view => [String(view.requestId), view]));
    expect(listBById.get(String(requestA))).toBe(listAById.get(String(requestA)));
    expect(listBById.get(String(requestB))).toBe(listAById.get(String(requestB)));
    const stateAfterA = stateWith({
      slave: {
        [requestA]: envelope(record(requestA, {commands: [observation({name: 'test.a2'})]}), 12),
        [requestB]: (state[runtimeRequestLedgerSlaveSliceName] as RuntimeRequestLedgerState)[requestB],
      },
    });

    expect(selectRequestExecutionView(state, requestA)).toBe(viewA1);
    expect(selectRequestExecutionView(stateAfterA, requestB)).toBe(viewB1);
    expect(
      selectRequestExecutionView(
        stateWith({
          slave: {[requestA]: (stateAfterA[runtimeRequestLedgerSlaveSliceName] as RuntimeRequestLedgerState)[requestA]},
        }),
        requestB,
      ),
    ).toBeNull();
  });

  it('A-1 routes per-mode slice actions and preserves empty clear references', async () => {
    const requestId = createRequestId();
    const ports = createTestPlatformPorts();
    const runtime = await createStateRuntime({
      runtimeName: 'runtime-request-ledger-actions',
      environmentMode: 'TEST',
      slices: [runtimeInstanceModeSlice, runtimeRequestLedgerMasterSlice, runtimeRequestLedgerSlaveSlice],
      logger: ports.logger,
      plainStorage: ports.persistKv,
      protectedStorage: ports.persistSecure,
      persistenceKey: 'runtime-request-ledger-actions',
      persistenceDebounceMs: 0,
    });

    runtime.getStore().dispatch(setRuntimeInstanceModeAction('SLAVE'));
    expect(runtime.getState()[runtimeInstanceModeSliceName]).toEqual({instanceMode: 'SLAVE'});
    runtime.getStore().dispatch(
      requestLedgerActionsForMode('MASTER').upsert({
        record: record(requestId, {commands: [observation({name: 'master'})]}),
        updatedAt: 10,
      }),
    );
    runtime.getStore().dispatch(
      requestLedgerActionsForMode('SLAVE').upsert({
        record: record(requestId, {commands: [observation({name: 'slave'})]}),
        updatedAt: 20,
      }),
    );
    expect(runtime.getState()[runtimeRequestLedgerMasterSliceName]).toHaveProperty(String(requestId));
    expect(runtime.getState()[runtimeRequestLedgerSlaveSliceName]).toHaveProperty(String(requestId));

    runtime.getStore().dispatch(requestLedgerActionsForMode('MASTER').deleteRecords({requestIds: [requestId]}));
    expect(runtime.getState()[runtimeRequestLedgerMasterSliceName]).toEqual({});
    runtime.getStore().dispatch(requestLedgerActionsForMode('SLAVE').deleteRecords({requestIds: [requestId]}));
    expect(runtime.getState()[runtimeRequestLedgerSlaveSliceName]).toEqual({});
    const emptySlave = runtime.getState()[runtimeRequestLedgerSlaveSliceName];
    runtime.getStore().dispatch(requestLedgerActionsForMode('SLAVE').clear());
    expect(runtime.getState()[runtimeRequestLedgerSlaveSliceName]).toBe(emptySlave);
  });

  it('S-2 rejects tombstones through the isolated state-sync boundary', async () => {
    const requestId = createRequestId();
    const ports = createTestPlatformPorts();
    const runtime = await createStateRuntime({
      runtimeName: 'runtime-request-ledger-sync',
      environmentMode: 'TEST',
      slices: [runtimeInstanceModeSlice, runtimeRequestLedgerMasterSlice, runtimeRequestLedgerSlaveSlice],
      logger: ports.logger,
      plainStorage: ports.persistKv,
      protectedStorage: ports.persistSecure,
      persistenceKey: 'runtime-request-ledger-sync',
      persistenceDebounceMs: 0,
    });
    runtime.getStore().dispatch(
      requestLedgerActionsForMode('SLAVE').upsert({
        record: record(requestId, {commands: [observation()]}),
        updatedAt: 10,
      }),
    );
    const applied = runtime.applyAuthoritativeSync(runtimeRequestLedgerSlaveSliceName, {
      mode: 'authoritative',
      replaceMissing: false,
      entries: [{key: requestId, value: createSyncTombstone(20)}],
    });

    expect(applied).toEqual({
      status: 'skipped',
      sliceName: runtimeRequestLedgerSlaveSliceName,
      reason: 'SYNC_NOT_DECLARED',
    });
    expect(selectRequestExecutionView(runtime.getState(), requestId)).not.toBeNull();
    expect(readLiveRequestEnvelope({[requestId]: createSyncTombstone(30)}, requestId)).toBeUndefined();
  });
});
