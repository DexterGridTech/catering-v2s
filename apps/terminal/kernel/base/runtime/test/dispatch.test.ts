import {describe, expect, it} from 'vitest';
import {
  createRuntime,
  defineActor,
  defineCommand,
  onCommand,
  type CommandDispatchResult,
  type RuntimeModule,
} from '../src/index';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {createTestRuntimeInput, deferred} from './testSupport';

type CommandSpec = NonNullable<RuntimeModule['commandDefinitions']>[number];

const moduleFor = (
  moduleName: string,
  commands: readonly CommandSpec[],
  actors: readonly ReturnType<typeof defineActor>[] = [],
): RuntimeModule =>
  Object.freeze({
    moduleName,
    kind: 'owner' as const,
    dependencies: [{moduleName: 'kernel.base.runtime'}],
    commands: commands.map(command => ({
      name: command.commandName,
      visibility: command.visibility,
    })),
    commandDefinitions: commands,
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
  });

describe('runtime dispatch and aggregation', () => {
  it('D-1 runs actors concurrently but returns records in registration order', async () => {
    const command = defineCommand<Readonly<{}>>('test.dispatch.order', {name: 'run', visibility: 'public'});
    const first = deferred<void>();
    const second = defineActor('test.dispatch.order', 'second', [onCommand(command, () => ({actor: 'second'}))]);
    const firstActor = defineActor('test.dispatch.order', 'first', [
      onCommand(command, async () => {
        await first.promise;
        return {actor: 'first'};
      }),
    ]);
    const runtime = createRuntime(
      createTestRuntimeInput({modules: [moduleFor('test.dispatch.order', [command], [firstActor, second])]}),
    );
    await runtime.start();
    const pending = runtime.dispatchCommand(command, {}, {requestId: createRequestId()});
    await Promise.resolve();
    first.resolve();
    const result = await pending;
    expect(result.status).toBe('completed');
    expect(result.actorResults.map(record => record.actorKey)).toEqual([
      'test.dispatch.order.first',
      'test.dispatch.order.second',
    ]);
    expect(result.actorResults[0]?.result).toEqual({actor: 'first'});
    expect(result.actorResults[1]?.result).toEqual({actor: 'second'});
  });

  it('D-2 keeps other actors running after re-entry and applies the empty-actor rule', async () => {
    const noActor = defineCommand<Readonly<{}>>('test.dispatch.empty', {
      name: 'allowed',
      visibility: 'internal',
      allowNoActor: true,
    });
    const forbidden = defineCommand<Readonly<{}>>('test.dispatch.empty', {
      name: 'forbidden',
      visibility: 'internal',
      allowNoActor: false,
    });
    const reentry = defineCommand<Readonly<{}>>('test.dispatch.reentry', {
      name: 'run',
      visibility: 'internal',
      allowReentry: false,
    });
    let reentryChild: string | undefined;
    let reentryChildResult: CommandDispatchResult | undefined;
    const first = defineActor('test.dispatch.reentry', 'first', [
      onCommand(reentry, async context => {
        const child = await context.dispatchCommand(reentry, {});
        reentryChild = child.status;
        reentryChildResult = child;
        return {continued: true};
      }),
    ]);
    const second = defineActor('test.dispatch.reentry', 'second', [onCommand(reentry, () => ({continued: true}))]);
    const runtime = createRuntime(
      createTestRuntimeInput({
        modules: [
          moduleFor('test.dispatch.empty', [noActor, forbidden]),
          moduleFor('test.dispatch.reentry', [reentry], [first, second]),
        ],
      }),
    );
    await runtime.start();
    expect((await runtime.dispatchCommand(noActor, {})).status).toBe('completed');
    expect((await runtime.dispatchCommand(forbidden, {})).status).toBe('error');
    const result = await runtime.dispatchCommand(reentry, {});
    expect(result.status).toBe('completed');
    expect(result.actorResults.every(record => record.status === 'completed')).toBe(true);
    expect(reentryChild).toBe('partial-failed');
    expect(reentryChildResult?.actorResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({actorKey: 'test.dispatch.reentry.first', status: 'error'}),
        expect.objectContaining({actorKey: 'test.dispatch.reentry.second', status: 'completed'}),
      ]),
    );
    expect(result.actorResults).toHaveLength(2);
  });

  it('R3 allows parallel sibling dispatches of the same child command', async () => {
    const child = defineCommand<Readonly<{}>>('test.dispatch.siblings', {
      name: 'child',
      visibility: 'internal',
      allowReentry: false,
    });
    const parent = defineCommand<Readonly<{}>>('test.dispatch.siblings', {
      name: 'parent',
      visibility: 'internal',
      allowReentry: false,
    });
    const childStarted = deferred<void>();
    const releaseChild = deferred<void>();
    let childRuns = 0;
    const childActor = defineActor('test.dispatch.siblings', 'child', [
      onCommand(child, async () => {
        childRuns += 1;
        if (childRuns === 2) childStarted.resolve();
        await releaseChild.promise;
        return {childRuns};
      }),
    ]);
    const parentActor = defineActor('test.dispatch.siblings', 'parent', [
      onCommand(parent, async context => {
        const first = context.dispatchCommand(child, {});
        const second = context.dispatchCommand(child, {});
        await childStarted.promise;
        releaseChild.resolve();
        const results = await Promise.all([first, second]);
        return {statuses: results.map(result => result.status)};
      }),
    ]);
    const runtime = createRuntime(
      createTestRuntimeInput({
        modules: [moduleFor('test.dispatch.siblings', [parent, child], [parentActor, childActor])],
      }),
    );
    await runtime.start();

    const result = await runtime.dispatchCommand(parent, {});
    expect(result.status).toBe('completed');
    expect(result.actorResults[0]?.status).toBe('completed');
    expect(childRuns).toBe(2);
  });

  it('D-3 rejects depth 33 while retaining a complete command chain diagnostic', async () => {
    const command = defineCommand<{depth: number}>('test.dispatch.depth', {
      name: 'run',
      visibility: 'internal',
      allowReentry: true,
    });
    const actor = defineActor('test.dispatch.depth', 'recursive', [
      onCommand(command, async context => {
        const depth = context.command.payload.depth;
        if (depth >= 4) return {depth, childStatus: null};
        const child = await context.dispatchCommand(command, {depth: depth + 1});
        return {depth, childStatus: child.status};
      }),
    ]);
    const runtime = createRuntime(
      createTestRuntimeInput({
        modules: [moduleFor('test.dispatch.depth', [command], [actor])],
        runtimeName: 'runtime-depth',
      }),
    );
    // The low limit keeps this test fast while exercising the same 32/33 boundary.
    runtime as unknown as {limits?: unknown};
    const bounded = createRuntime({
      ...createTestRuntimeInput({modules: [moduleFor('test.dispatch.depth', [command], [actor])]}),
      limits: {
        maxCommandDepth: 2,
      },
    });
    await bounded.start();
    const result = await bounded.dispatchCommand(command, {depth: 0});
    expect(result.status).toBe('completed');
    expect(bounded.journal.list().some(event => event.kind === 'command.depth-rejected')).toBe(true);
    const rejected = bounded.journal.list().find(event => event.kind === 'command.depth-rejected');
    expect(rejected && rejected.kind === 'command.depth-rejected' ? rejected.commandChain.length : 0).toBe(3);
    await runtime.start();
  });
});
