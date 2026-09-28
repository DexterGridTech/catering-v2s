import {describe, expect, it, vi} from 'vitest';
import {createCommandId, createRequestId, type RequestId} from '@catering-v2s/kernel-base-contracts';
import {
  createRuntime,
  defineActor,
  defineCommand,
  onCommand,
  selectRequestExecutionView,
  type CommandDispatchResult,
  type RuntimeModule,
} from '../src/index';
import type {CommandExecutionObservation, ActorExecutionRecord} from '../src/types/execution';
import type {RequestExecutionRecord} from '../src/types/requestLedger';
import {runtimeRequestLedgerMasterSliceName} from '../src/features/slices/requestLedger';
import {requestLedgerActionsForMode} from '../src/features/slices/requestLedger';
import {createTestRuntimeInput, deferred} from './testSupport';

type CommandSpec = NonNullable<RuntimeModule['commandDefinitions']>[number];

const moduleFor = (
  moduleName: string,
  commands: readonly CommandSpec[],
  actors: readonly ReturnType<typeof defineActor>[],
): RuntimeModule =>
  Object.freeze({
    moduleName,
    kind: 'owner' as const,
    dependencies: [{moduleName: 'kernel.base.runtime'}],
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
  });

const completedActor = (actorKey: string, result: Record<string, boolean> = {ok: true}): ActorExecutionRecord =>
  Object.freeze({
    actorKey,
    status: 'completed',
    startedAt: 1,
    completedAt: 2,
    result,
    error: null,
  });

const completedObservation = (
  commandId: ReturnType<typeof createCommandId>,
  commandName: string,
): CommandExecutionObservation =>
  Object.freeze({
    commandId,
    parentCommandId: null,
    commandName,
    target: 'local',
    allowNoActor: false,
    actorResults: Object.freeze([completedActor(`${commandName}.actor`)]),
    startedAt: 1,
    completedAt: 2,
    displayMode: null,
  });

const ledgerRecord = (requestId: RequestId, commands: readonly CommandExecutionObservation[]): RequestExecutionRecord =>
  Object.freeze({
    requestId,
    workspace: 'MAIN',
    startedAt: 1,
    commands: Object.freeze([...commands]),
  });

describe('runtime request ledger lifecycle integration', () => {
  it('writes local and child command observations from one lifecycle fact and preserves route display', async () => {
    const parent = defineCommand<Readonly<{}>>('test.ledger.lifecycle', {
      name: 'parent',
      visibility: 'public',
    });
    const child = defineCommand<Readonly<{}>>('test.ledger.lifecycle', {
      name: 'child',
      visibility: 'internal',
    });
    const childActor = defineActor('test.ledger.lifecycle', 'child', [onCommand(child, () => ({child: true}))]);
    const parentActor = defineActor('test.ledger.lifecycle', 'parent', [
      onCommand(parent, async context => {
        await context.dispatchCommand(child, {});
        return {parent: true};
      }),
    ]);
    const runtime = createRuntime(
      createTestRuntimeInput({
        modules: [moduleFor('test.ledger.lifecycle', [parent, child], [parentActor, childActor])],
      }),
    );
    await runtime.start();

    const requestId = createRequestId();
    const result = await runtime.dispatchCommand(
      parent,
      {},
      {
        requestId,
        routeContext: {workspace: 'MAIN', instanceMode: 'MASTER', displayMode: 'PRIMARY'},
      },
    );

    expect(result.status).toBe('completed');
    const view = selectRequestExecutionView(runtime.getState(), requestId);
    expect(view).toMatchObject({requestId, status: 'completed', workspace: 'MAIN', timeSource: 'local'});
    expect(view?.commands).toHaveLength(2);
    expect(view?.commands.every(command => command.displayMode === 'PRIMARY')).toBe(true);
    const resultByCommand = new Map(view?.commands.map(command => [command.commandName, command.results[0]]));
    expect(resultByCommand.get(parent.commandName)).toEqual({parent: true});
    expect(resultByCommand.get(child.commandName)).toEqual({child: true});
  });

  it('keeps the real ledger payload out of the StateRuntime full-sync seam', async () => {
    const command = defineCommand<Readonly<{}>>('test.ledger.sync', {
      name: 'run',
      visibility: 'public',
    });
    const actor = defineActor('test.ledger.sync', 'worker', [onCommand(command, () => ({synced: true}))]);
    const module = moduleFor('test.ledger.sync', [command], [actor]);
    const source = createRuntime(createTestRuntimeInput({modules: [module], runtimeName: 'ledger-sync-source'}));
    const target = createRuntime(createTestRuntimeInput({modules: [module], runtimeName: 'ledger-sync-target'}));
    await source.start();
    await target.start();
    const requestId = createRequestId();
    await source.dispatchCommand(command, {}, {requestId});

    expect(selectRequestExecutionView(source.getState(), requestId)).toMatchObject({
      requestId,
      status: 'completed',
      timeSource: 'local',
    });
    expect(target.getState()[runtimeRequestLedgerMasterSliceName]).toEqual({});
  });

  it('writes a peer-targeted observation through the same lifecycle writer', async () => {
    const command = defineCommand<Readonly<{}>>('test.ledger.peer', {
      name: 'run',
      visibility: 'public',
      defaultTarget: 'peer',
    });
    const module = Object.freeze({
      ...moduleFor('test.ledger.peer', [command], []),
      install: (context: Parameters<NonNullable<RuntimeModule['install']>>[0]) => {
        context.installPeerDispatchGateway({
          dispatchCommand: async (_intent, options) => ({
            requestId: options.requestId,
            commandId: options.commandId,
            status: 'completed',
            actorResults: [],
          }),
        });
      },
    });
    const runtime = createRuntime(createTestRuntimeInput({modules: [module], runtimeName: 'ledger-peer'}));
    await runtime.start();
    const requestId = createRequestId();
    const result = await runtime.dispatchCommand(command, {}, {requestId});
    expect(result.status).toBe('completed');
    const view = selectRequestExecutionView(runtime.getState(), requestId);
    expect(view?.commands[0]?.status).toBe('completed');
    expect(view?.commands[0]?.observations[0]?.target).toBe('peer');
  });

  it('records the peer command lifecycle locally for every real status branch', async () => {
    const startedCommand = defineCommand<Readonly<{}>>('test.ledger.peer-status', {
      name: 'started',
      visibility: 'public',
      defaultTarget: 'peer',
      timeoutMs: 500,
    });
    const completedCommand = defineCommand<Readonly<{}>>('test.ledger.peer-status', {
      name: 'completed',
      visibility: 'public',
      defaultTarget: 'peer',
      timeoutMs: 500,
    });
    const partialFailedCommand = defineCommand<Readonly<{}>>('test.ledger.peer-status', {
      name: 'partial-failed',
      visibility: 'public',
      defaultTarget: 'peer',
      timeoutMs: 500,
    });
    const timedOutCommand = defineCommand<Readonly<{}>>('test.ledger.peer-status', {
      name: 'timed-out',
      visibility: 'public',
      defaultTarget: 'peer',
      timeoutMs: 500,
    });
    const errorCommand = defineCommand<Readonly<{}>>('test.ledger.peer-status', {
      name: 'error',
      visibility: 'public',
      defaultTarget: 'peer',
      timeoutMs: 500,
    });
    const commands = [startedCommand, completedCommand, partialFailedCommand, timedOutCommand, errorCommand];
    const startedResult = deferred<CommandDispatchResult>();
    const module = Object.freeze({
      ...moduleFor('test.ledger.peer-status', commands, []),
      install: (context: Parameters<NonNullable<RuntimeModule['install']>>[0]) => {
        context.installPeerDispatchGateway({
          dispatchCommand: async (intent, options) => {
            const name = intent.definition.commandName;
            if (name.endsWith('.started')) return startedResult.promise;
            const status = name.endsWith('.completed')
              ? 'completed'
              : name.endsWith('.partial-failed')
                ? 'partial-failed'
                : name.endsWith('.timed-out')
                  ? 'timed-out'
                  : 'error';
            return {
              requestId: options.requestId,
              commandId: options.commandId,
              status,
              actorResults: [],
            };
          },
        });
      },
    });
    const runtime = createRuntime(
      createTestRuntimeInput({
        modules: [module],
        runtimeName: 'ledger-peer-status',
      }),
    );
    await runtime.start();

    const startedRequestId = createRequestId();
    const startedPromise = runtime.dispatchCommand(startedCommand, {}, {requestId: startedRequestId});
    await Promise.resolve();
    expect(selectRequestExecutionView(runtime.getState(), startedRequestId)).toMatchObject({
      status: 'started',
      commands: [
        expect.objectContaining({status: 'running', observations: [expect.objectContaining({target: 'peer'})]}),
      ],
    });
    startedResult.resolve({
      requestId: startedRequestId,
      commandId: createCommandId(),
      status: 'completed',
      actorResults: [],
    });
    await expect(startedPromise).resolves.toMatchObject({status: 'completed'});

    const terminalCases = [
      {command: completedCommand, expected: 'completed' as const},
      {command: partialFailedCommand, expected: 'error' as const},
      {command: timedOutCommand, expected: 'timed-out' as const},
      {command: errorCommand, expected: 'error' as const},
    ];
    for (const currentCase of terminalCases) {
      const requestId = createRequestId();
      const result = await runtime.dispatchCommand(currentCase.command, {}, {requestId});
      expect(result.status).toBe(currentCase.expected);
      expect(selectRequestExecutionView(runtime.getState(), requestId)).toMatchObject({
        status: currentCase.expected,
        commands: [
          expect.objectContaining({
            status: currentCase.expected,
            observations: [expect.objectContaining({target: 'peer'})],
          }),
        ],
      });
    }
  });

  it('uses merged ledger command count for a typed budget rejection and records it once', async () => {
    const command = defineCommand<Readonly<{}>>('test.ledger.budget', {
      name: 'run',
      visibility: 'public',
    });
    const actor = defineActor('test.ledger.budget', 'worker', [onCommand(command, () => ({ran: true}))]);
    const runtime = createRuntime({
      ...createTestRuntimeInput({
        modules: [moduleFor('test.ledger.budget', [command], [actor])],
        runtimeName: 'ledger-budget',
      }),
      limits: {maxCommandsPerRequest: 1},
    });
    await runtime.start();
    const requestId = createRequestId();
    const preseed = ledgerRecord(requestId, [completedObservation(createCommandId(), command.commandName)]);
    runtime.getStore().dispatch(
      requestLedgerActionsForMode('MASTER').upsert({
        record: preseed,
        updatedAt: 2,
      }),
    );

    await expect(runtime.dispatchCommand(command, {}, {requestId})).rejects.toMatchObject({
      key: 'kernel.base.runtime.request_budget_exceeded',
    });
    const first = selectRequestExecutionView(runtime.getState(), requestId);
    expect(
      first?.commands.filter(item =>
        item.errors.some(error => error.key === 'kernel.base.runtime.request_budget_exceeded'),
      ),
    ).toHaveLength(1);
    const commandCount = first?.commands.length;

    await expect(runtime.dispatchCommand(command, {}, {requestId})).rejects.toMatchObject({
      key: 'kernel.base.runtime.request_budget_exceeded',
    });
    const second = selectRequestExecutionView(runtime.getState(), requestId);
    expect(second?.commands.length).toBe(commandCount);
    expect(
      second?.commands.filter(item =>
        item.errors.some(error => error.key === 'kernel.base.runtime.request_budget_exceeded'),
      ),
    ).toHaveLength(1);
  });

  it('does not let one actor ledger write failure escape the command boundary', async () => {
    const events: import('@catering-v2s/kernel-base-platform-ports').LogEvent[] = [];
    const command = defineCommand<Readonly<{}>>('test.ledger.failure', {
      name: 'run',
      visibility: 'public',
    });
    const failedActor = defineActor('test.ledger.failure', 'failed', [onCommand(command, () => ({failed: true}))]);
    const completedActor = defineActor('test.ledger.failure', 'completed', [
      onCommand(command, () => ({completed: true})),
    ]);
    const runtime = createRuntime(
      createTestRuntimeInput({
        modules: [moduleFor('test.ledger.failure', [command], [failedActor, completedActor])],
        events,
        runtimeName: 'ledger-failure',
      }),
    );
    await runtime.start();
    const originalDispatch = runtime.getStore().dispatch;
    let dispatchCount = 0;
    const dispatch = vi.spyOn(runtime.getStore(), 'dispatch').mockImplementation(action => {
      dispatchCount += 1;
      // command.started and both actor.running transitions must succeed; the
      // first terminal actor transition is the injected ledger failure.
      if (dispatchCount === 4) throw new Error('synthetic store failure');
      return originalDispatch(action);
    });
    try {
      const result = await runtime.dispatchCommand(command, {}, {requestId: createRequestId()});

      expect(result.status).toBe('partial-failed');
      expect(result.actorResults).toHaveLength(2);
      expect(result.actorResults[0]).toMatchObject({
        actorKey: 'test.ledger.failure.failed',
        status: 'error',
        error: {key: 'kernel.base.runtime.ledger_write_failed'},
      });
      expect(result.actorResults[1]).toMatchObject({
        actorKey: 'test.ledger.failure.completed',
        status: 'completed',
        result: {completed: true},
      });
      expect(events.some(event => event.event === 'runtime.ledger.write-failed')).toBe(true);
    } finally {
      dispatch.mockRestore();
    }
  });

  it('does not report command completion when the final ledger write fails', async () => {
    const events: import('@catering-v2s/kernel-base-platform-ports').LogEvent[] = [];
    const command = defineCommand<Readonly<{}>>('test.ledger.completion-failure', {
      name: 'run',
      visibility: 'public',
    });
    const actor = defineActor('test.ledger.completion-failure', 'worker', [
      onCommand(command, () => ({completed: true})),
    ]);
    const runtime = createRuntime(
      createTestRuntimeInput({
        modules: [moduleFor('test.ledger.completion-failure', [command], [actor])],
        events,
        runtimeName: 'ledger-completion-failure',
      }),
    );
    await runtime.start();
    const originalDispatch = runtime.getStore().dispatch;
    let dispatchCount = 0;
    const dispatch = vi.spyOn(runtime.getStore(), 'dispatch').mockImplementation(action => {
      dispatchCount += 1;
      // command.started, actor.running, and actor.completed succeed; the
      // command.completed ledger write is the injected failure.
      if (dispatchCount === 4) throw new Error('synthetic completion ledger failure');
      return originalDispatch(action);
    });
    try {
      await expect(runtime.dispatchCommand(command, {}, {requestId: createRequestId()})).rejects.toMatchObject({
        key: 'kernel.base.runtime.ledger_write_failed',
      });
      expect(events.some(event => event.event === 'runtime.ledger.write-failed')).toBe(true);
    } finally {
      dispatch.mockRestore();
    }
  });

  it('rejects before actor execution when the command start ledger write fails', async () => {
    const events: import('@catering-v2s/kernel-base-platform-ports').LogEvent[] = [];
    let actorCalled = false;
    const command = defineCommand<Readonly<{}>>('test.ledger.start-failure', {
      name: 'run',
      visibility: 'public',
    });
    const actor = defineActor('test.ledger.start-failure', 'worker', [
      onCommand(command, () => {
        actorCalled = true;
        return {completed: true};
      }),
    ]);
    const runtime = createRuntime(
      createTestRuntimeInput({
        modules: [moduleFor('test.ledger.start-failure', [command], [actor])],
        events,
        runtimeName: 'ledger-start-failure',
      }),
    );
    await runtime.start();
    const dispatch = vi.spyOn(runtime.getStore(), 'dispatch').mockImplementation(_action => {
      throw new Error('synthetic start ledger failure');
    });
    try {
      await expect(runtime.dispatchCommand(command, {}, {requestId: createRequestId()})).rejects.toMatchObject({
        key: 'kernel.base.runtime.ledger_write_failed',
      });
      expect(actorCalled).toBe(false);
      expect(events.some(event => event.event === 'runtime.ledger.write-failed')).toBe(true);
    } finally {
      dispatch.mockRestore();
    }
  });
});
