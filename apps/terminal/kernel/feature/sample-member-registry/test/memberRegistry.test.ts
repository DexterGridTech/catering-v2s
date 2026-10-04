import {describe, expect, it} from 'vitest';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import type {PeerDispatchGateway, Runtime, RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import {
  releaseRuntimeForTest,
  releaseRuntimeForTestAsync,
  runtimeStateSyncForTest,
} from '@catering-v2s/kernel-base-runtime/testing';
import {
  confirmMemberCommand,
  createSampleMemberRegistryModule,
  memberConfirmedCommand,
  memberPendingCommand,
  memberRejectedCommand,
  memberWithdrawnCommand,
  rejectMemberCommand,
  selectMembers,
  selectBranchPendingMember,
  selectHostPendingMember,
  selectPendingMember,
  registerBranchConfirmedMemberCommand,
  submitMemberCommand,
  withdrawMemberCommand,
} from '../src/index';
import {createEventRecorderModule, createMemoryStorageForTest, createTestRuntime, type RecordedEvent} from './support';
import {memberSliceName} from '../src/features/slices/slice';
import {setRuntimeInstanceModeAction} from '../../../base/runtime/src/features/slices/runtimeInstanceMode';

const peerGatewayModule = (peer: Runtime): RuntimeModule => {
  const gateway: PeerDispatchGateway = {
    dispatchCommand: (command, options) =>
      peer.dispatchCommand(command.definition, command.payload, {
        requestId: options.requestId ?? undefined,
        commandId: options.commandId,
        parentCommandId: options.parentCommandId ?? undefined,
        routeContext: options.routeContext,
      }),
  };
  return Object.freeze({
    moduleName: 'test.sample-member-registry.peer-gateway',
    kind: 'toolkit' as const,
    dependencies: [{moduleName: 'kernel.base.runtime'}],
    install: (context: Parameters<NonNullable<RuntimeModule['install']>>[0]) =>
      context.installPeerDispatchGateway(gateway),
  });
};

describe('sample member registry owner module', () => {
  it('describes the owner commands, actors, slice, and isolated persistence contract', () => {
    const module = createSampleMemberRegistryModule();
    expect(module.moduleName).toBe('kernel.feature.sample-member-registry');
    expect(module.kind).toBe('owner');
    expect(module.dependencies?.map(dependency => dependency.moduleName)).toEqual(['kernel.base.runtime']);
    expect(module.commands?.map(command => [command.name, command.visibility])).toEqual([
      ['kernel.feature.sample-member-registry.submit-member', 'public'],
      ['kernel.feature.sample-member-registry.confirm-member', 'public'],
      ['kernel.feature.sample-member-registry.reject-member', 'public'],
      ['kernel.feature.sample-member-registry.member-pending', 'public'],
      ['kernel.feature.sample-member-registry.member-confirmed', 'public'],
      ['kernel.feature.sample-member-registry.member-rejected', 'public'],
      ['kernel.feature.sample-member-registry.withdraw-member', 'public'],
      ['kernel.feature.sample-member-registry.member-withdrawn', 'public'],
      ['kernel.feature.sample-member-registry.register-branch-confirmed-member', 'public'],
    ]);
    expect(module.actors?.map(actor => actor.name)).toEqual([
      'submit',
      'confirm',
      'reject',
      'register-branch-confirmed',
    ]);
    expect(module.slices).toEqual([
      {
        name: 'kernel.feature.sample-member-registry.members',
        persistIntent: 'owner-only',
      },
    ]);
    expect(module.stateSlices).toHaveLength(1);
    expect(module.stateSlices?.[0]?.syncIntent).toBe('master-to-slave');
    expect(module.stateSlices?.[0]?.hasPersistence).toBe(true);
  });

  it('does not accept a direct member command when the integration qualification guard is closed', async () => {
    const runtime = createTestRuntime([createSampleMemberRegistryModule({canMutate: () => false})]);
    try {
      await runtime.start();
      const result = await runtime.dispatchCommand(
        submitMemberCommand,
        {name: 'Guarded', phone: '010-1234-5678'},
        {requestId: createRequestId()},
      );
      expect(result.status).toBe('error');
      expect(selectHostPendingMember(runtime.getState())).toBeNull();
    } finally {
      await releaseRuntimeForTestAsync(runtime);
    }
  });

  it('syncs confirmed members while preserving the branch-local pending registration', async () => {
    const source = createTestRuntime([createSampleMemberRegistryModule()]);
    const target = createTestRuntime([createSampleMemberRegistryModule()]);
    try {
      await source.start();
      await target.start();
      target.getStore().dispatch(setRuntimeInstanceModeAction('SLAVE'));
      const branchRequestId = createRequestId();
      await target.dispatchCommand(
        submitMemberCommand,
        {
          name: 'Branch pending',
          phone: '010-9999-0000',
        },
        {requestId: branchRequestId},
      );
      const firstRequestId = createRequestId();
      await source.dispatchCommand(
        submitMemberCommand,
        {
          name: 'Sync me',
          phone: '010-0000-0000',
        },
        {requestId: firstRequestId},
      );
      await source.dispatchCommand(
        confirmMemberCommand,
        {operationId: String(firstRequestId)},
        {requestId: createRequestId()},
      );
      const hostRequestId = createRequestId();
      await source.dispatchCommand(
        submitMemberCommand,
        {
          name: 'Host pending',
          phone: '010-1111-2222',
        },
        {requestId: hostRequestId},
      );

      const payload = runtimeStateSyncForTest(source).createFullSyncPayload(memberSliceName);
      expect(payload.status).toBe('ready');
      if (payload.status !== 'ready') return;
      expect(payload.payload.entries).toEqual([
        expect.objectContaining({
          key: 'state',
          value: expect.objectContaining({
            value: {
              members: [
                expect.objectContaining({name: 'Sync me', phone: '010-0000-0000', operationId: String(firstRequestId)}),
              ],
              hostPending: {operationId: String(hostRequestId), name: 'Host pending', phone: '010-1111-2222'},
            },
          }),
        }),
      ]);
      expect(payload.payload).toMatchObject({
        mode: 'authoritative',
        replaceMissing: true,
        entries: [expect.objectContaining({key: 'state'})],
      });

      const applied = runtimeStateSyncForTest(target).applyAuthoritativeSync(memberSliceName, payload.payload);
      expect(applied).toEqual({
        status: 'applied',
        sliceName: memberSliceName,
        changed: true,
      });
      expect(selectMembers(target.getState())).toEqual([
        expect.objectContaining({name: 'Sync me', phone: '010-0000-0000'}),
      ]);
      expect(selectBranchPendingMember(target.getState())).toEqual({
        operationId: String(branchRequestId),
        name: 'Branch pending',
        phone: '010-9999-0000',
      });
      expect(selectHostPendingMember(target.getState())).toEqual({
        operationId: String(hostRequestId),
        name: 'Host pending',
        phone: '010-1111-2222',
      });
    } finally {
      releaseRuntimeForTest(source);
      releaseRuntimeForTest(target);
    }
  });

  it('reconciles a lost branch confirmation response from the matching authoritative member-list projection', async () => {
    const master = createTestRuntime([createSampleMemberRegistryModule()]);
    const events: RecordedEvent[] = [];
    const slave = createTestRuntime([
      createSampleMemberRegistryModule(),
      createEventRecorderModule([memberConfirmedCommand], events),
    ]);
    try {
      await master.start();
      await slave.start();
      slave.getStore().dispatch(setRuntimeInstanceModeAction('SLAVE'));
      const requestId = createRequestId();
      const operationId = String(requestId);
      await slave.dispatchCommand(submitMemberCommand, {name: 'Branch member', phone: '010-1111-2222'}, {requestId});
      await master.dispatchCommand(
        registerBranchConfirmedMemberCommand,
        {
          operationId,
          name: 'Branch member',
          phone: '010-1111-2222',
        },
        {requestId: createRequestId()},
      );

      const payload = runtimeStateSyncForTest(master).createFullSyncPayload(memberSliceName);
      expect(payload.status).toBe('ready');
      if (payload.status !== 'ready') return;
      expect(runtimeStateSyncForTest(slave).applyAuthoritativeSync(memberSliceName, payload.payload)).toMatchObject({
        status: 'applied',
      });
      expect(selectBranchPendingMember(slave.getState())?.operationId).toBe(operationId);
      await new Promise<void>(resolve => setTimeout(resolve, 0));

      expect(selectBranchPendingMember(slave.getState())).toBeNull();
      expect(events).toEqual([
        expect.objectContaining({
          commandName: memberConfirmedCommand.commandName,
          payload: {memberId: operationId},
        }),
      ]);
    } finally {
      releaseRuntimeForTest(slave);
      releaseRuntimeForTest(master);
    }
  });

  it('routes LSP confirmation to the MASTER list owner and deduplicates by operation identity', async () => {
    const master = createTestRuntime([createSampleMemberRegistryModule()]);
    await master.start();
    const slave = createTestRuntime([createSampleMemberRegistryModule(), peerGatewayModule(master)]);
    try {
      await slave.start();
      slave.getStore().dispatch(setRuntimeInstanceModeAction('SLAVE'));
      const requestId = createRequestId();
      await slave.dispatchCommand(submitMemberCommand, {name: 'Branch member', phone: '010-1111-2222'}, {requestId});
      const result = await slave.dispatchCommand(
        confirmMemberCommand,
        {operationId: String(requestId)},
        {
          requestId: createRequestId(),
        },
      );

      expect(result.status).toBe('completed');
      expect(selectBranchPendingMember(slave.getState())).toBeNull();
      expect(selectMembers(master.getState())).toEqual([
        expect.objectContaining({
          operationId: String(requestId),
          name: 'Branch member',
          phone: '010-1111-2222',
        }),
      ]);
      await slave.dispatchCommand(
        registerBranchConfirmedMemberCommand,
        {
          operationId: String(requestId),
          name: 'Branch member',
          phone: '010-1111-2222',
        },
        {requestId: createRequestId(), target: 'peer'},
      );
      expect(selectMembers(master.getState())).toHaveLength(1);
    } finally {
      releaseRuntimeForTest(slave);
      releaseRuntimeForTest(master);
    }
  });

  it('routes dual-machine LMS decisions to the MASTER host-pending owner', async () => {
    const master = createTestRuntime([createSampleMemberRegistryModule()]);
    const slave = createTestRuntime([createSampleMemberRegistryModule(), peerGatewayModule(master)]);
    try {
      await master.start();
      await slave.start();
      slave.getStore().dispatch(setRuntimeInstanceModeAction('SLAVE'));
      const operationId = createRequestId();
      await master.dispatchCommand(
        submitMemberCommand,
        {name: 'Host member', phone: '010-3333-4444'},
        {requestId: operationId},
      );
      const result = await slave.dispatchCommand(
        confirmMemberCommand,
        {operationId: String(operationId), age: 34},
        {requestId: createRequestId(), target: 'peer'},
      );

      expect(result.status).toBe('completed');
      expect(selectHostPendingMember(master.getState())).toBeNull();
      expect(selectMembers(master.getState())).toEqual([
        expect.objectContaining({operationId: String(operationId), age: 34}),
      ]);
      expect(selectBranchPendingMember(slave.getState())).toBeNull();
    } finally {
      releaseRuntimeForTest(slave);
      releaseRuntimeForTest(master);
    }
  });

  it('submits a pending registration and emits its result event', async () => {
    const events: RecordedEvent[] = [];
    const runtime = createTestRuntime([
      createSampleMemberRegistryModule(),
      createEventRecorderModule([memberPendingCommand], events),
    ]);
    await runtime.start();

    const requestId = createRequestId();
    const result = await runtime.dispatchCommand(
      submitMemberCommand,
      {
        name: 'Alice',
        phone: '010-1234-5678',
      },
      {requestId},
    );

    expect(result.status).toBe('completed');
    expect(selectPendingMember(runtime.getState())).toEqual({
      operationId: String(requestId),
      name: 'Alice',
      phone: '010-1234-5678',
    });
    expect(selectMembers(runtime.getState())).toEqual([]);
    expect(events).toEqual([
      expect.objectContaining({
        commandName: memberPendingCommand.commandName,
        payload: {operationId: String(requestId), name: 'Alice', phone: '010-1234-5678'},
        requestId: String(requestId),
      }),
    ]);
  });

  it('treats confirmation with no pending registration as a late no-op', async () => {
    const runtime = createTestRuntime([createSampleMemberRegistryModule()]);
    await runtime.start();

    const result = await runtime.dispatchCommand(
      confirmMemberCommand,
      {operationId: 'missing'},
      {requestId: createRequestId()},
    );

    expect(result.status).toBe('completed');
    expect(result.actorResults[0]?.error).toBeNull();
    expect(selectMembers(runtime.getState())).toEqual([]);
    expect(selectPendingMember(runtime.getState())).toBeNull();
  });

  it('ignores a late decision for an older operation without consuming the newer host pending member', async () => {
    const runtime = createTestRuntime([createSampleMemberRegistryModule()]);
    await runtime.start();
    try {
      const olderOperationId = createRequestId();
      const currentOperationId = createRequestId();
      await runtime.dispatchCommand(
        submitMemberCommand,
        {name: 'Older registration', phone: '010-0000-0001'},
        {requestId: olderOperationId},
      );
      await runtime.dispatchCommand(
        submitMemberCommand,
        {name: 'Current registration', phone: '010-0000-0002'},
        {requestId: currentOperationId},
      );

      const staleResult = await runtime.dispatchCommand(
        confirmMemberCommand,
        {operationId: String(olderOperationId)},
        {requestId: createRequestId()},
      );
      expect(staleResult.status).toBe('completed');
      expect(selectMembers(runtime.getState())).toEqual([]);
      expect(selectPendingMember(runtime.getState())).toEqual({
        operationId: String(currentOperationId),
        name: 'Current registration',
        phone: '010-0000-0002',
      });

      await runtime.dispatchCommand(
        confirmMemberCommand,
        {operationId: String(currentOperationId)},
        {requestId: createRequestId()},
      );
      expect(selectMembers(runtime.getState())).toEqual([
        expect.objectContaining({operationId: String(currentOperationId), name: 'Current registration'}),
      ]);
      expect(selectPendingMember(runtime.getState())).toBeNull();
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('confirms a pending registration into a member and clears pending state', async () => {
    const events: RecordedEvent[] = [];
    const runtime = createTestRuntime([
      createSampleMemberRegistryModule(),
      createEventRecorderModule([memberPendingCommand, memberConfirmedCommand], events),
    ]);
    await runtime.start();
    const submitRequestId = createRequestId();
    await runtime.dispatchCommand(
      submitMemberCommand,
      {
        name: 'Bob',
        phone: '010-9876-5432',
      },
      {requestId: submitRequestId},
    );

    const requestId = createRequestId();
    const result = await runtime.dispatchCommand(
      confirmMemberCommand,
      {operationId: String(submitRequestId), age: 37},
      {requestId},
    );
    const members = selectMembers(runtime.getState());

    expect(result.status).toBe('completed');
    expect(selectPendingMember(runtime.getState())).toBeNull();
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      memberId: String(submitRequestId),
      operationId: String(submitRequestId),
      name: 'Bob',
      phone: '010-9876-5432',
      age: 37,
    });
    expect(members[0]?.memberId).toEqual(expect.any(String));
    expect(members[0]?.registeredAt).toEqual(expect.any(Number));
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        commandName: memberConfirmedCommand.commandName,
        payload: {memberId: members[0]?.memberId},
        requestId: String(requestId),
      }),
    );
  });

  it('restores committed members but does not restore an unconfirmed pending registration after restart', async () => {
    const storage = createMemoryStorageForTest();
    const first = createTestRuntime([createSampleMemberRegistryModule()], storage);
    await first.start();
    const committedRequestId = createRequestId();
    await first.dispatchCommand(
      submitMemberCommand,
      {
        name: 'Committed',
        phone: '010-2222-3333',
      },
      {requestId: committedRequestId},
    );
    await first.dispatchCommand(
      confirmMemberCommand,
      {operationId: String(committedRequestId)},
      {requestId: createRequestId()},
    );
    await first.dispatchCommand(
      submitMemberCommand,
      {
        name: 'Pending',
        phone: '010-4444-5555',
      },
      {requestId: createRequestId()},
    );
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    const second = createTestRuntime([createSampleMemberRegistryModule()], storage);
    await second.start();

    expect(selectMembers(second.getState())).toEqual([
      expect.objectContaining({
        name: 'Committed',
        phone: '010-2222-3333',
      }),
    ]);
    expect(selectPendingMember(second.getState())).toBeNull();
  });

  it('rejects a pending registration while retaining it for desk retry, and emits the explicit reason', async () => {
    const events: RecordedEvent[] = [];
    const runtime = createTestRuntime([
      createSampleMemberRegistryModule(),
      createEventRecorderModule([memberPendingCommand, memberRejectedCommand], events),
    ]);
    await runtime.start();
    await runtime.dispatchCommand(
      submitMemberCommand,
      {
        name: 'Carol',
        phone: '010-1111-2222',
      },
      {requestId: createRequestId()},
    );

    const pending = selectHostPendingMember(runtime.getState());
    const requestId = createRequestId();
    const result = await runtime.dispatchCommand(rejectMemberCommand, {operationId: pending!.operationId}, {requestId});

    expect(result.status).toBe('completed');
    expect(selectPendingMember(runtime.getState())).toEqual({
      operationId: pending!.operationId,
      name: 'Carol',
      phone: '010-1111-2222',
    });
    expect(selectMembers(runtime.getState())).toEqual([]);
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        commandName: memberRejectedCommand.commandName,
        payload: {operationId: pending!.operationId, reasonCode: 'customer-rejected'},
        requestId: String(requestId),
      }),
    );
  });

  it('withdraws a pending registration without emitting a rejection reason', async () => {
    const events: RecordedEvent[] = [];
    const runtime = createTestRuntime([
      createSampleMemberRegistryModule(),
      createEventRecorderModule([memberPendingCommand, memberRejectedCommand, memberWithdrawnCommand], events),
    ]);
    await runtime.start();
    await runtime.dispatchCommand(
      submitMemberCommand,
      {
        name: 'Dana',
        phone: '010-3333-4444',
      },
      {requestId: createRequestId()},
    );

    const pending = selectHostPendingMember(runtime.getState());
    const requestId = createRequestId();
    const result = await runtime.dispatchCommand(
      withdrawMemberCommand,
      {operationId: pending!.operationId},
      {requestId},
    );

    expect(result.status).toBe('completed');
    expect(selectPendingMember(runtime.getState())).toBeNull();
    expect(selectMembers(runtime.getState())).toEqual([]);
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        commandName: memberWithdrawnCommand.commandName,
        payload: {operationId: pending!.operationId},
        requestId: String(requestId),
      }),
    );
    expect(events.some(event => event.commandName === memberRejectedCommand.commandName)).toBe(false);
  });

  it('makes late reject and withdraw commands no-ops after the first terminal decision', async () => {
    const events: RecordedEvent[] = [];
    const runtime = createTestRuntime([
      createSampleMemberRegistryModule(),
      createEventRecorderModule([memberRejectedCommand, memberWithdrawnCommand], events),
    ]);
    await runtime.start();
    await runtime.dispatchCommand(
      submitMemberCommand,
      {
        name: 'Eve',
        phone: '010-5555-6666',
      },
      {requestId: createRequestId()},
    );
    const pending = selectHostPendingMember(runtime.getState());
    await runtime.dispatchCommand(
      withdrawMemberCommand,
      {operationId: pending!.operationId},
      {requestId: createRequestId()},
    );
    const lateReject = await runtime.dispatchCommand(
      rejectMemberCommand,
      {operationId: pending!.operationId},
      {requestId: createRequestId()},
    );
    const lateWithdraw = await runtime.dispatchCommand(
      withdrawMemberCommand,
      {operationId: pending!.operationId},
      {requestId: createRequestId()},
    );

    expect(lateReject.status).toBe('completed');
    expect(lateWithdraw.status).toBe('completed');
    expect(events).toHaveLength(1);
    expect(events[0]?.commandName).toBe(memberWithdrawnCommand.commandName);
  });

  it('requires request ids for externally dispatched public member request commands', async () => {
    const runtime = createTestRuntime([createSampleMemberRegistryModule()]);
    await runtime.start();

    await expect(
      runtime.dispatchCommand(submitMemberCommand, {
        name: 'Alice',
        phone: '010-1234-5678',
      }),
    ).rejects.toMatchObject({code: 'ERR_TER_RUNTIME_REQUEST_ID_REQUIRED'});
    await expect(runtime.dispatchCommand(confirmMemberCommand, {operationId: 'missing'})).rejects.toMatchObject({
      code: 'ERR_TER_RUNTIME_REQUEST_ID_REQUIRED',
    });
    await expect(runtime.dispatchCommand(rejectMemberCommand, {operationId: 'missing'})).rejects.toMatchObject({
      code: 'ERR_TER_RUNTIME_REQUEST_ID_REQUIRED',
    });
    await expect(runtime.dispatchCommand(withdrawMemberCommand, {operationId: 'missing'})).rejects.toMatchObject({
      code: 'ERR_TER_RUNTIME_REQUEST_ID_REQUIRED',
    });
  });
});
