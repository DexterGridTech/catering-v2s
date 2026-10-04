import {describe, expect, it} from 'vitest';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {releaseRuntimeForTestAsync, runtimeStateSyncForTest} from '@catering-v2s/kernel-base-runtime/testing';
import {
  bootstrapSessionCommand,
  createSampleStaffSessionModule,
  loginCommand,
  loginFailedCommand,
  loginSucceededCommand,
  logoutCommand,
  logoutSucceededCommand,
  selectSessionState,
  selectHostStaffQualification,
  sessionRestoredAnonymousCommand,
  sessionRestoredAuthenticatedCommand,
} from '../src/index';
import {createEventRecorderModule, createMemoryStorageForTest, createTestRuntime, type RecordedEvent} from './support';

describe('sample staff session owner module', () => {
  it('describes the owner commands, actors, slice, and host-to-slave qualification projection', () => {
    const module = createSampleStaffSessionModule();
    expect(module.moduleName).toBe('kernel.feature.sample-staff-session');
    expect(module.kind).toBe('owner');
    expect(module.dependencies?.map(dependency => dependency.moduleName)).toEqual(['kernel.base.runtime']);
    expect(module.commands?.map(command => [command.name, command.visibility])).toEqual([
      ['kernel.feature.sample-staff-session.bootstrap-session', 'internal'],
      ['kernel.feature.sample-staff-session.login', 'public'],
      ['kernel.feature.sample-staff-session.logout', 'public'],
      ['kernel.feature.sample-staff-session.login-succeeded', 'public'],
      ['kernel.feature.sample-staff-session.login-failed', 'public'],
      ['kernel.feature.sample-staff-session.logout-succeeded', 'public'],
      ['kernel.feature.sample-staff-session.session-restored-authenticated', 'public'],
      ['kernel.feature.sample-staff-session.session-restored-anonymous', 'public'],
    ]);
    expect(module.actors?.map(actor => actor.name)).toEqual(['bootstrap', 'login', 'logout']);
    expect(module.slices).toEqual([
      {
        name: 'kernel.feature.sample-staff-session.session',
        persistIntent: 'owner-only',
      },
    ]);
    expect(module.stateSlices).toHaveLength(1);
    expect(module.stateSlices?.[0]?.syncIntent).toBe('master-to-slave');
    expect(module.stateSlices?.[0]?.hasPersistence).toBe(true);
  });

  it('projects only the host staff qualification needed by the paired read-only surfaces', async () => {
    const host = createTestRuntime([createSampleStaffSessionModule()]);
    const slave = createTestRuntime([createSampleStaffSessionModule()]);
    try {
      await host.start();
      await slave.start();
      await host.dispatchCommand(
        loginCommand,
        {operatorName: 'A001', passcode: '1111'},
        {requestId: createRequestId()},
      );

      const payload = runtimeStateSyncForTest(host).createFullSyncPayload(
        'kernel.feature.sample-staff-session.session',
      );
      expect(payload.status).toBe('ready');
      if (payload.status !== 'ready') return;
      expect(payload.payload.entries).toEqual([
        expect.objectContaining({
          key: 'state',
          value: expect.objectContaining({value: {status: 'authenticated', operatorName: 'A001'}}),
        }),
      ]);

      expect(
        runtimeStateSyncForTest(slave).applyAuthoritativeSync(
          'kernel.feature.sample-staff-session.session',
          payload.payload,
        ),
      ).toMatchObject({status: 'applied'});
      expect(selectSessionState(slave.getState())).toMatchObject({status: 'anonymous', operatorName: null});
      const slaveState = {
        ...slave.getState(),
        'kernel.base.runtime.instance-mode': {instanceMode: 'SLAVE'},
      } as StateRoot;
      expect(selectHostStaffQualification(slaveState)).toEqual({status: 'authenticated', operatorName: 'A001'});
      expect(JSON.stringify(payload.payload)).not.toContain('1111');
    } finally {
      await releaseRuntimeForTestAsync(host);
      await releaseRuntimeForTestAsync(slave);
    }
  });

  it('bootstraps anonymous state and emits the explicit anonymous result event with a request id', async () => {
    const events: RecordedEvent[] = [];
    const module = createSampleStaffSessionModule();
    const runtime = createTestRuntime([module, createEventRecorderModule([sessionRestoredAnonymousCommand], events)]);

    await runtime.start();

    expect(runtime.status).toBe('started');
    expect(selectSessionState(runtime.getState())).toEqual({status: 'anonymous', operatorName: null});
    const bootstrapRequestId = runtime.journal
      .list()
      .find(
        event => event.kind === 'command.started' && event.commandName === bootstrapSessionCommand.commandName,
      )?.requestId;
    expect(bootstrapRequestId).toEqual(expect.any(String));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      commandName: sessionRestoredAnonymousCommand.commandName,
      requestId: String(bootstrapRequestId),
    });
  });

  it('logs in with the accepted sample credential, writes state, and emits a result event', async () => {
    const events: RecordedEvent[] = [];
    const module = createSampleStaffSessionModule();
    const runtime = createTestRuntime([module, createEventRecorderModule([loginSucceededCommand], events)]);
    await runtime.start();

    const requestId = createRequestId();
    const result = await runtime.dispatchCommand(
      loginCommand,
      {
        operatorName: 'A001',
        passcode: '1111',
      },
      {requestId},
    );

    expect(result.status).toBe('completed');
    expect(selectSessionState(runtime.getState())).toEqual({
      status: 'authenticated',
      operatorName: 'A001',
    });
    expect(events).toEqual([
      expect.objectContaining({
        commandName: loginSucceededCommand.commandName,
        payload: {operatorName: 'A001'},
        requestId: String(requestId),
      }),
    ]);
  });

  it('rejects invalid credentials without authenticating and emits the explicit failure event', async () => {
    const events: RecordedEvent[] = [];
    const module = createSampleStaffSessionModule();
    const runtime = createTestRuntime([module, createEventRecorderModule([loginFailedCommand], events)]);
    await runtime.start();

    const requestId = createRequestId();
    const result = await runtime.dispatchCommand(
      loginCommand,
      {
        operatorName: 'A001',
        passcode: 'bad',
      },
      {requestId},
    );

    expect(result.status).toBe('error');
    expect(selectSessionState(runtime.getState())).toEqual({status: 'anonymous', operatorName: null});
    expect(result.actorResults[0]?.error).toMatchObject({
      code: 'ERR_TER_SAMPLE_STAFF_INVALID_CREDENTIALS',
    });
    expect(result.actorResults[0]?.error?.message).toBe('Sample staff credentials are invalid');
    expect(events).toEqual([
      expect.objectContaining({
        commandName: loginFailedCommand.commandName,
        payload: {reasonCode: 'invalid-credentials'},
        requestId: String(requestId),
      }),
    ]);
  });

  it('clears the session and emits logout-succeeded', async () => {
    const events: RecordedEvent[] = [];
    const module = createSampleStaffSessionModule();
    const runtime = createTestRuntime([
      module,
      createEventRecorderModule([loginSucceededCommand, logoutSucceededCommand], events),
    ]);
    await runtime.start();
    await runtime.dispatchCommand(
      loginCommand,
      {
        operatorName: 'A002',
        passcode: '2222',
      },
      {requestId: createRequestId()},
    );

    const requestId = createRequestId();
    const result = await runtime.dispatchCommand(logoutCommand, {}, {requestId});

    expect(result.status).toBe('completed');
    expect(selectSessionState(runtime.getState())).toEqual({status: 'anonymous', operatorName: null});
    expect(events.at(-1)).toEqual(
      expect.objectContaining({
        commandName: logoutSucceededCommand.commandName,
        payload: {},
        requestId: String(requestId),
      }),
    );
  });

  it('restores authenticated state and emits the authenticated result event on a new runtime', async () => {
    const events: RecordedEvent[] = [];
    const storage = createMemoryStorageForTest();
    const first = createTestRuntime([createSampleStaffSessionModule()], storage);
    await first.start();
    await first.dispatchCommand(
      loginCommand,
      {
        operatorName: 'A001',
        passcode: '1111',
      },
      {requestId: createRequestId()},
    );
    await first.dispatchCommand(logoutCommand, {}, {requestId: createRequestId()});
    await first.dispatchCommand(
      loginCommand,
      {
        operatorName: 'A002',
        passcode: '2222',
      },
      {requestId: createRequestId()},
    );
    await new Promise<void>(resolve => setTimeout(resolve, 0));

    const second = createTestRuntime(
      [createSampleStaffSessionModule(), createEventRecorderModule([sessionRestoredAuthenticatedCommand], events)],
      storage,
      'sample-staff-session-second',
    );
    await second.start();

    expect(selectSessionState(second.getState())).toEqual({
      status: 'authenticated',
      operatorName: 'A002',
    });
    const bootstrapRequestId = second.journal
      .list()
      .find(
        event => event.kind === 'command.started' && event.commandName === bootstrapSessionCommand.commandName,
      )?.requestId;
    expect(bootstrapRequestId).toEqual(expect.any(String));
    expect(events).toEqual([
      expect.objectContaining({
        commandName: sessionRestoredAuthenticatedCommand.commandName,
        payload: {operatorName: 'A002'},
        requestId: String(bootstrapRequestId),
      }),
    ]);
  });

  it('requires a request id for every externally dispatched public command', async () => {
    const runtime = createTestRuntime([createSampleStaffSessionModule()]);
    await runtime.start();

    await expect(
      runtime.dispatchCommand(loginCommand, {
        operatorName: 'A001',
        passcode: '1111',
      }),
    ).rejects.toMatchObject({code: 'ERR_TER_RUNTIME_REQUEST_ID_REQUIRED'});
    await expect(runtime.dispatchCommand(logoutCommand, {})).rejects.toMatchObject({
      code: 'ERR_TER_RUNTIME_REQUEST_ID_REQUIRED',
    });
    expect(bootstrapSessionCommand.visibility).toBe('internal');
  });

  it('does not allow a direct business login when the integration qualification guard is closed', async () => {
    const runtime = createTestRuntime([createSampleStaffSessionModule({canLogin: () => false})]);
    try {
      await runtime.start();
      const result = await runtime.dispatchCommand(
        loginCommand,
        {operatorName: 'A001', passcode: '1111'},
        {requestId: createRequestId()},
      );
      expect(result.status).toBe('error');
      expect(selectSessionState(runtime.getState())).toEqual({status: 'anonymous', operatorName: null});
    } finally {
      await releaseRuntimeForTestAsync(runtime);
    }
  });
});
