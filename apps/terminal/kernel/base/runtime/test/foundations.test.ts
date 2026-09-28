import {describe, expect, it} from 'vitest';
import {
  aggregateCommandStatus,
  createRuntime,
  defineActor,
  defineCommand,
  selectRuntimeInstanceMode,
  setRuntimeInstanceModeCommand,
  type ActorExecutionRecord,
  type CommandExecutionObservation,
  type RuntimeModule,
  type RuntimeModuleContext,
} from '../src/index';
import {cloneStateJsonValue} from '../src/foundations/cloneStateJsonValue';
import {normalizeRuntimeError} from '../src/foundations/normalizeRuntimeError';
import {moduleName} from '../src/moduleName';
import {createSharedMemoryStoragePort, createTestRuntimeInput} from './testSupport';

const command = defineCommand<{value: string}>('test.module', {
  name: 'run',
  visibility: 'public',
});

const record = (status: ActorExecutionRecord['status'], actorKey = 'test.actor'): ActorExecutionRecord =>
  Object.freeze({
    actorKey,
    status,
    startedAt: 1,
    completedAt: status === 'running' ? null : 2,
    result: null,
    error:
      status === 'error'
        ? {key: 'x', code: 'X', message: 'x', category: 'SYSTEM' as const, severity: 'MEDIUM' as const}
        : null,
  });

const observation = (
  actorResults: readonly ActorExecutionRecord[],
  completedAt: number | null = 2,
  allowNoActor = false,
): CommandExecutionObservation => ({
  commandId: 'cmd_test' as never,
  parentCommandId: null,
  commandName: 'test.module.run',
  target: 'local',
  allowNoActor,
  actorResults,
  startedAt: 1,
  completedAt,
  displayMode: null,
});

describe('runtime CP-A1 foundations', () => {
  it('creates an immutable, payload-bound command and actor definition', () => {
    expect(Object.isFrozen(command)).toBe(true);
    const actor = defineActor('test.module', 'actor', []);
    expect(actor.actorKey).toBe('test.module.actor');
    expect(() => defineActor('test.module', 'actor.name', [])).toThrow();
    expect(() => defineCommand('test.module', {name: 'a.b', visibility: 'public'})).toThrow();
  });

  it('clones valid JSON and rejects unsupported values with a reason', () => {
    const input = {nested: ['值', 1]};
    const cloned = cloneStateJsonValue(input, 1000);
    expect(cloned.status).toBe('valid');
    if (cloned.status === 'valid') {
      expect(cloned.value).toEqual(input);
      expect(cloned.value).not.toBe(input);
      expect(Object.isFrozen(cloned.value)).toBe(true);
    }
    expect(cloneStateJsonValue(Number.NaN, 1000).status).toBe('invalid');
    const circular: {self?: unknown} = {};
    circular.self = circular;
    expect(cloneStateJsonValue(circular, 1000)).toMatchObject({status: 'invalid', reason: 'circular-reference'});
    expect(cloneStateJsonValue({value: 'x'.repeat(100)}, 10)).toMatchObject({
      status: 'invalid',
      reason: 'result-too-large',
    });

    const accessor = {};
    Object.defineProperty(accessor, 'value', {enumerable: true, get: () => 1});
    expect(cloneStateJsonValue(accessor, 1000)).toMatchObject({status: 'invalid', reason: 'accessor-property'});
    const symbolKey = {[Symbol('state')]: 1};
    expect(cloneStateJsonValue(symbolKey, 1000)).toMatchObject({status: 'invalid', reason: 'symbol-key'});
  });

  it('preserves JSON __proto__ keys without changing the cloned object prototype', () => {
    const input = Object.create(null) as {__proto__?: {polluted: boolean}; nested?: {__proto__?: string}};
    Object.defineProperty(input, '__proto__', {
      value: {polluted: true},
      enumerable: true,
      configurable: true,
      writable: true,
    });
    input.nested = Object.create(null) as {__proto__?: string};
    Object.defineProperty(input.nested, '__proto__', {
      value: 'literal',
      enumerable: true,
      configurable: true,
      writable: true,
    });

    const cloned = cloneStateJsonValue(input, 1000);
    expect(cloned.status).toBe('valid');
    if (cloned.status === 'valid') {
      const rootValue = cloned.value as {readonly [key: string]: unknown};
      expect(Object.prototype.hasOwnProperty.call(rootValue, '__proto__')).toBe(true);
      expect(Object.getPrototypeOf(rootValue)).toBe(null);
      expect(Object.getPrototypeOf(rootValue)).not.toMatchObject({polluted: true});
      expect(Reflect.get(rootValue, '__proto__')).toEqual({polluted: true});
      const nested = Reflect.get(rootValue, 'nested') as {readonly [key: string]: unknown};
      expect(Object.prototype.hasOwnProperty.call(nested, '__proto__')).toBe(true);
      expect(Object.getPrototypeOf(nested)).toBe(null);
      expect(Reflect.get(nested, '__proto__')).toBe('literal');
      expect(cloned.bytes).toBe(new TextEncoder().encode(JSON.stringify(cloned.value)).byteLength);
    }
  });

  it('aggregates command status using rule zero before terminal rules', () => {
    expect(aggregateCommandStatus(observation([record('completed')], null))).toBe('running');
    expect(aggregateCommandStatus(observation([record('running')]))).toBe('running');
    expect(aggregateCommandStatus(observation([], 2, true))).toBe('completed');
    expect(aggregateCommandStatus(observation([]))).toBe('error');
    expect(aggregateCommandStatus(observation([record('timed-out'), record('timed-out')]))).toBe('timed-out');
    expect(aggregateCommandStatus(observation([record('completed'), record('timed-out')]))).toBe('partial-failed');
    expect(aggregateCommandStatus(observation([record('error'), record('timed-out')]))).toBe('error');
  });

  it('normalizes unknown failures while preserving an existing AppError', () => {
    const context = {
      commandName: 'test.module.run',
      commandId: 'cmd_test' as never,
      requestId: null,
      nodeId: 'node_test' as never,
    };
    const normalized = normalizeRuntimeError(new Error('boom'), context);
    expect(normalized.key).toBe(`${moduleName}.command_execution_failed`);
    expect(normalized.commandName).toBe(context.commandName);
    expect(normalized.templateMissingKeys).toEqual([]);
    const existing = {...normalized, key: 'existing'};
    expect(normalizeRuntimeError(existing, context)).toBe(existing);
  });

  it('recovers runtime instance mode across runtime instances through shared plain storage', async () => {
    const sharedPlain = createSharedMemoryStoragePort();
    let flushFirstRuntime: (() => Promise<unknown>) | undefined;
    const captureFlushModule: RuntimeModule = Object.freeze({
      moduleName: 'test.capture',
      kind: 'toolkit',
      dependencies: [{moduleName, required: true}],
      install: (context: RuntimeModuleContext) => {
        flushFirstRuntime = context.flushPersistence;
      },
    });
    const firstRuntime = createRuntime(
      createTestRuntimeInput({
        modules: [captureFlushModule],
        plainStorage: sharedPlain.storage,
        runtimeName: 'runtime-recovery-first',
      }),
    );
    await firstRuntime.start();
    await firstRuntime.dispatchCommand(setRuntimeInstanceModeCommand, {instanceMode: 'SLAVE'});
    expect(flushFirstRuntime).toBeDefined();
    const flushResult = await flushFirstRuntime?.();
    expect(flushResult).toMatchObject({status: 'succeeded'});

    const secondRuntime = createRuntime(
      createTestRuntimeInput({
        plainStorage: sharedPlain.storage,
        runtimeName: 'runtime-recovery-second',
      }),
    );
    await secondRuntime.start();
    expect(selectRuntimeInstanceMode(secondRuntime.getState())).toBe('SLAVE');
  });
});
