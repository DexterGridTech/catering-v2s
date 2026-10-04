import {describe, expect, it} from 'vitest';
import {createAppError, createRequestId} from '@catering-v2s/kernel-base-contracts';
import {createRuntime, defineActor, defineCommand, onCommand, type RuntimeModule} from '../src/index';
import {releaseRuntimeForTestAsync} from '../src/testing';
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

describe('runtime actor result boundary', () => {
  it('dispatches an installed command by name from a runtime-owned actor receiver', async () => {
    const parentCommand = defineCommand<Readonly<{}>>('test.named-dispatch', {name: 'parent', visibility: 'internal'});
    const childCommand = defineCommand<Readonly<{readonly value: string}>>('test.named-dispatch', {
      name: 'child',
      visibility: 'internal',
    });
    const missingCommand = defineCommand<Readonly<{}>>('test.named-dispatch', {
      name: 'missing',
      visibility: 'internal',
    });
    const childActor = defineActor('test.named-dispatch', 'child', [
      onCommand(childCommand, context => ({value: context.command.payload.value})),
    ]);
    const parentActor = defineActor('test.named-dispatch', 'parent', [
      onCommand(parentCommand, async context => {
        const child = await context.dispatchCommand(childCommand.commandName, {value: 'selected-by-name'});
        return {childStatus: child.status, childValue: child.actorResults[0]?.result ?? null};
      }),
      onCommand(missingCommand, async context => {
        await context.dispatchCommand('test.named-dispatch.not-registered', {});
        return {unreachable: true};
      }),
    ]);
    const runtime = createRuntime(
      createTestRuntimeInput({
        modules: [moduleFor('test.named-dispatch', [parentCommand, childCommand, missingCommand], [parentActor, childActor])],
      }),
    );
    await runtime.start();
    const result = await runtime.dispatchCommand(parentCommand, {});
    expect(result.actorResults[0]?.result).toEqual({
      childStatus: 'completed',
      childValue: {value: 'selected-by-name'},
    });
    const unknown = await runtime.dispatchCommand(missingCommand, {});
    expect(unknown.status).toBe('error');
    expect(unknown.actorResults[0]?.status).toBe('error');
  });

  it('R-1 normalizes void to null and stores a detached frozen result', async () => {
    const voidCommand = defineCommand<Readonly<{}>>('test.actor-result', {name: 'void', visibility: 'internal'});
    const objectCommand = defineCommand<Readonly<{}>>('test.actor-result', {name: 'object', visibility: 'internal'});
    const objectValue = {nested: {value: 1}};
    const voidActor = defineActor('test.actor-result', 'void', [onCommand(voidCommand, () => undefined)]);
    const objectActor = defineActor('test.actor-result', 'object', [onCommand(objectCommand, () => objectValue)]);
    const runtime = createRuntime(
      createTestRuntimeInput({
        modules: [moduleFor('test.actor-result', [voidCommand, objectCommand], [voidActor, objectActor])],
      }),
    );
    await runtime.start();
    const voidResult = await runtime.dispatchCommand(voidCommand, {});
    expect(voidResult.actorResults[0]?.result).toBeNull();
    const objectResult = await runtime.dispatchCommand(objectCommand, {});
    objectValue.nested.value = 99;
    expect(objectResult.actorResults[0]?.result).toEqual({nested: {value: 1}});
    expect(Object.isFrozen(objectResult.actorResults[0]?.result)).toBe(true);
    expect(Object.isFrozen((objectResult.actorResults[0]?.result as {nested: object}).nested)).toBe(true);
  });

  it('R-2 rejects every non-JSON actor result without rejecting dispatch', async () => {
    const values: readonly [string, unknown][] = [
      ['nan', Number.NaN],
      ['infinity', Number.POSITIVE_INFINITY],
      ['function', () => 'bad'],
      ['date', new Date(0)],
      ['bigint', BigInt(1)],
      ['nested-undefined', {value: undefined}],
    ];
    const commands = values.map(([name]) =>
      defineCommand<Readonly<{}>>('test.invalid-result', {name, visibility: 'internal'}),
    );
    const actors = commands.map((command, index) =>
      defineActor('test.invalid-result', values[index]?.[0] ?? `actor-${index}`, [
        onCommand(command, () => values[index]?.[1] as never),
      ]),
    );
    const runtime = createRuntime(
      createTestRuntimeInput({modules: [moduleFor('test.invalid-result', commands, actors)]}),
    );
    await runtime.start();
    for (const command of commands) {
      const result = await runtime.dispatchCommand(command, {});
      expect(result.status).toBe('error');
      expect(result.actorResults[0]?.status).toBe('error');
      expect(result.actorResults[0]?.error?.key).toBe('kernel.base.runtime.actor_result_invalid');
    }
    expect(runtime.status).toBe('started');
  });

  it('R-3 keeps a timeout terminal while recording a late completion and allows later dispatch', async () => {
    const command = defineCommand<Readonly<{}>>('test.late-result', {
      name: 'run',
      visibility: 'internal',
      timeoutMs: 5,
    });
    let gate = deferred<Readonly<{late: boolean}>>();
    const actor = defineActor('test.late-result', 'worker', [onCommand(command, async () => gate.promise)]);
    const runtime = createRuntime(
      createTestRuntimeInput({modules: [moduleFor('test.late-result', [command], [actor])]}),
    );
    await runtime.start();
    const lateOutcomes: unknown[] = [];
    const timedOut = await runtime.dispatchCommand(command, {}, {
      lateResultTtlMs: 1_000,
      lateOutcome: record => lateOutcomes.push(record),
    });
    expect(timedOut.status).toBe('timed-out');
    expect(timedOut.actorResults[0]?.status).toBe('timed-out');
    gate.resolve({late: true});
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(lateOutcomes).toEqual([
      expect.objectContaining({status: 'completed', result: {late: true}, error: null}),
    ]);
    const lateJournalEvent = runtime.journal.list().find(event => event.kind === 'actor.late-completed');
    expect(lateJournalEvent).toBeDefined();
    expect(lateJournalEvent).not.toHaveProperty('result');
    gate = deferred<Readonly<{late: boolean}>>();
    const later = await runtime.dispatchCommand(command, {});
    expect(later.status).toBe('timed-out');
  });

  it('R-3b drops a late-result observer after its finite residence window', async () => {
    const command = defineCommand<Readonly<{}>>('test.late-result-expiry', {
      name: 'run',
      visibility: 'internal',
      timeoutMs: 2,
    });
    const gate = deferred<Readonly<{late: boolean}>>();
    const actor = defineActor('test.late-result-expiry', 'worker', [onCommand(command, () => gate.promise)]);
    const runtime = createRuntime(
      createTestRuntimeInput({modules: [moduleFor('test.late-result-expiry', [command], [actor])]}),
    );
    await runtime.start();
    const lateOutcomes: unknown[] = [];
    const timedOut = await runtime.dispatchCommand(command, {}, {
      lateResultTtlMs: 5,
      lateOutcome: record => lateOutcomes.push(record),
    });
    expect(timedOut.status).toBe('timed-out');
    await new Promise(resolve => setTimeout(resolve, 10));
    gate.resolve({late: true});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(lateOutcomes).toEqual([]);
    await releaseRuntimeForTestAsync(runtime);
  });

  it('R-4 projects AppError fields and wraps ordinary Error at the actor boundary', async () => {
    const appCommand = defineCommand<Readonly<{}>>('test.error-projection', {name: 'app', visibility: 'internal'});
    const ordinaryCommand = defineCommand<Readonly<{}>>('test.error-projection', {
      name: 'ordinary',
      visibility: 'internal',
    });
    const appError = createAppError(
      {
        key: 'test.error.domain',
        name: 'Domain failure',
        defaultTemplate: 'Domain failure',
        category: 'BUSINESS',
        severity: 'HIGH',
        code: 'ERR_DOMAIN',
        moduleName: 'test.error-projection',
      },
      {context: {requestId: createRequestId()}},
    );
    const appActor = defineActor('test.error-projection', 'app', [
      onCommand(appCommand, () => {
        throw appError;
      }),
    ]);
    const ordinaryActor = defineActor('test.error-projection', 'ordinary', [
      onCommand(ordinaryCommand, () => {
        throw new Error('ordinary');
      }),
    ]);
    const runtime = createRuntime(
      createTestRuntimeInput({
        modules: [moduleFor('test.error-projection', [appCommand, ordinaryCommand], [appActor, ordinaryActor])],
      }),
    );
    await runtime.start();
    const appResult = await runtime.dispatchCommand(appCommand, {});
    expect(appResult.actorResults[0]?.error).toMatchObject({
      key: 'test.error.domain',
      code: 'ERR_DOMAIN',
      category: 'BUSINESS',
      severity: 'HIGH',
    });
    const ordinaryResult = await runtime.dispatchCommand(ordinaryCommand, {});
    expect(ordinaryResult.actorResults[0]?.error?.key).toBe('kernel.base.runtime.command_execution_failed');
    expect(ordinaryResult.actorResults[0]?.error?.message).toContain('ordinary');
  });
});
