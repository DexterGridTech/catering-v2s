import {describe, expect, it} from 'vitest';
import {createRuntime, createRuntimeModule, defineActor, defineCommand, onCommand} from '../src/index';
import {createActorRegistry} from '../src/foundations/createActorRegistry';
import {describeRuntimeModule} from '../src/application/moduleManifest';
import {resolveModuleOrder} from '../src/foundations/resolveModuleOrder';
import {createDisplayContextModule} from '@catering-v2s/kernel-base-display-context';
import {createTestRuntimeInput, createTestSlice} from './testSupport';
import type {ActorCommandHandlerDefinition, ActorDefinition, RuntimeModule} from '../src/index';
import {runtimeParameters} from '../src/declarations/parameters';

const moduleWith = (moduleName: string, dependencies: RuntimeModule['dependencies'] = []): RuntimeModule => ({
  moduleName,
  kind: 'owner',
  dependencies,
});

describe('runtime module system', () => {
  it('keeps existing runtime policy defaults in the owning parameter definitions', () => {
    expect(Object.fromEntries(Object.entries(runtimeParameters).map(([key, value]) => [key, value.defaultValue]))).toEqual({
      maxCommandDepth: 32,
      maxCommandsPerRequest: 256,
      maxActorResultBytes: 262_144,
      requestRetentionMs: 1_800_000,
      requestMaxResidenceMs: 10_000_000,
      maxJournalRecords: 1_000,
      commandTimeoutMs: 60_000,
      postCommitConsumerTimeoutMs: 5_000,
    });
    expect(runtimeParameters.maxCommandDepth.validate?.(0)).toBe(false);
    expect(runtimeParameters.maxCommandDepth.validate?.(32)).toBe(true);
  });

  it('M-1 validates required, optional, duplicate, and cyclic dependency shapes', () => {
    const realDisplayContext = createDisplayContextModule();
    const registeredPrerequisites = (realDisplayContext.dependencies ?? [])
      .filter(dependency => dependency.moduleName !== 'kernel.base.runtime')
      .map(dependency => moduleWith(dependency.moduleName));
    expect(() => resolveModuleOrder([...registeredPrerequisites, realDisplayContext])).toThrow(
      /Missing required runtime module dependency.*kernel\.base\.runtime/,
    );
    expect(() => resolveModuleOrder([moduleWith('a', [{moduleName: 'missing'}])])).toThrow(
      'Missing required runtime module dependency',
    );
    expect(resolveModuleOrder([moduleWith('a', [{moduleName: 'missing', optional: true}])])).toHaveLength(1);
    expect(
      resolveModuleOrder([moduleWith('a'), moduleWith('b', [{moduleName: 'a'}])]).map(module => module.moduleName),
    ).toEqual(['a', 'b']);
    expect(() =>
      resolveModuleOrder([moduleWith('a', [{moduleName: 'b'}]), moduleWith('b', [{moduleName: 'a'}])]),
    ).toThrow('Circular runtime module dependency');
    expect(() => resolveModuleOrder([moduleWith('a'), moduleWith('a')])).toThrow('Duplicate runtime module');
  });

  it('M-2 keeps stable dependency order and immutable descriptors', () => {
    const first = moduleWith('first');
    const second = moduleWith('second');
    const ordered = resolveModuleOrder([second, first]);
    expect(ordered.map(module => module.moduleName)).toEqual(['second', 'first']);
    expect(Object.isFrozen(ordered)).toBe(true);
    const descriptor = describeRuntimeModule(first);
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(descriptor).toMatchObject({
      moduleName: 'first',
      kind: 'owner',
      dependencies: [],
      stateSliceNames: [],
      commandNames: [],
      actorKeys: [],
      hasPreSetup: false,
      hasInstall: false,
      hasReset: false,
    });

    const command = defineCommand<Readonly<{}>>('first', {name: 'run', visibility: 'internal'});
    const commandModule = createRuntimeModule({...first, commandDefinitions: [command]});
    expect(describeRuntimeModule(commandModule).commandNames).toEqual([command.commandName]);
  });

  it('M-3 rejects duplicate actors and handlers while retaining owner definition identity', () => {
    const command = defineCommand<{value: string}>('owner.module', {name: 'run', visibility: 'public'});
    const handler = onCommand(command, () => ({ok: true}));
    const actor = defineActor('owner.module', 'actor', [handler]);
    const registry = createActorRegistry([{moduleName: 'owner.module', actorDefinitions: [actor]}]);
    expect(registry.actorCount).toBe(1);
    expect(registry.handlersByCommand.get(command.commandName)?.[0].handle).toBe(handler.handle);
    expect(() => createActorRegistry([{moduleName: 'owner.module', actorDefinitions: [actor, actor]}])).toThrow(
      'Duplicate runtime actor',
    );
    const duplicateHandlerActor = defineActor('owner.module', 'other', [handler, handler]);
    expect(() =>
      createActorRegistry([{moduleName: 'owner.module', actorDefinitions: [duplicateHandlerActor]}]),
    ).toThrow('Duplicate runtime actor handler');

    expect(() => createActorRegistry([{moduleName: 'different.module', actorDefinitions: [actor]}])).toThrow(
      'Actor definition does not belong to owning module',
    );

    const crossModuleCommand = defineCommand<Readonly<{}>>('owner.module', {
      name: 'broadcast',
      visibility: 'public',
    });
    const crossModuleActor = defineActor('subscriber.module', 'subscriber', [
      onCommand(crossModuleCommand, () => ({ok: true})),
    ]);
    expect(() =>
      createRuntime(
        createTestRuntimeInput({
          modules: [
            {
              ...moduleWith('owner.module'),
              commandDefinitions: [crossModuleCommand],
            },
            {
              ...moduleWith('subscriber.module'),
              actorDefinitions: [crossModuleActor],
            },
          ],
        }),
      ),
    ).not.toThrow();

    const mismatchedActor = defineActor('different.module', 'actor', [handler]);
    expect(() =>
      createRuntime(
        createTestRuntimeInput({
          modules: [
            {
              ...moduleWith('owner.module'),
              commandDefinitions: [command],
              actorDefinitions: [mismatchedActor],
            },
          ],
        }),
      ),
    ).toThrow('Actor definition does not belong to owning module');
  });

  it('M-4 rejects forged actors and forged handlers before runtime registration', async () => {
    const command = defineCommand<{value: string}>('owner.module', {name: 'run', visibility: 'public'});
    const forgedHandler = {
      commandName: command.commandName,
      definition: command,
      handle: () => ({ok: true}),
    } as unknown as ActorCommandHandlerDefinition<{value: string}>;
    const forgedHandlerActor = defineActor('owner.module', 'actor', [forgedHandler]);
    expect(() => createActorRegistry([{moduleName: 'owner.module', actorDefinitions: [forgedHandlerActor]}])).toThrow(
      'Runtime actor handler must be created by onCommand',
    );

    const validHandler = onCommand(command, () => ({ok: true}));
    const forgedActor = {
      moduleName: 'owner.module',
      actorName: 'actor',
      actorKey: 'owner.module.actor',
      handlers: [validHandler],
    } as unknown as ActorDefinition;
    expect(() =>
      createRuntime(
        createTestRuntimeInput({
          modules: [
            {
              ...moduleWith('owner.module'),
              commandDefinitions: [command],
              actorDefinitions: [forgedActor],
            },
          ],
        }),
      ),
    ).toThrow('Actor was not created by defineActor');
  });

  it('M-5 rejects duplicate state slice names at the state runtime boundary', async () => {
    const duplicateName = 'duplicate.runtime.slice';
    const runtime = (await import('../src/index')).createRuntime(
      createTestRuntimeInput({
        modules: [
          {...moduleWith('first'), stateSlices: [createTestSlice(duplicateName)]},
          {...moduleWith('second'), stateSlices: [createTestSlice(duplicateName)]},
        ],
      }),
    );
    await expect(runtime.start()).rejects.toThrow('Runtime lifecycle failed');
    expect(runtime.status).toBe('failed');
    expect(runtime.failure?.cause).toMatchObject({message: expect.stringContaining('duplicate slice name')});
  });

  it('M-6 derives command names from concrete definitions and freezes module arrays', () => {
    const command = defineCommand<Readonly<{}>>('derived.module', {name: 'run', visibility: 'internal'});
    const commands = [command];
    const module = createRuntimeModule({
      moduleName: 'derived.module',
      kind: 'owner',
      commandDefinitions: commands,
    });

    expect(describeRuntimeModule(module).commandNames).toEqual([command.commandName]);
    expect('commands' in module).toBe(false);
    expect(Object.isFrozen(module)).toBe(true);
    expect(Object.isFrozen(module.commandDefinitions)).toBe(true);
    expect(module.commandDefinitions).not.toBe(commands);
  });

  it('M-7 rejects actual duplicate command definitions without a second declaration list', () => {
    const first = defineCommand<Readonly<{}>>('duplicate.module', {name: 'run', visibility: 'public'});
    const duplicate = defineCommand<Readonly<{}>>('duplicate.module', {name: 'run', visibility: 'public'});
    const module = createRuntimeModule({
      moduleName: 'duplicate.module',
      kind: 'owner',
      commandDefinitions: [first, duplicate],
    });
    expect(() => createRuntime(createTestRuntimeInput({modules: [module]}))).toThrow(
      'Runtime command definition invalid',
    );
  });

  it('rejects a legacy parallel descriptor at the runtime boundary', () => {
    const legacyModule = {
      moduleName: 'legacy.module',
      kind: 'owner' as const,
      commandDefinitions: [],
      commands: [{name: 'legacy.module.run', visibility: 'public' as const}],
    } as unknown as RuntimeModule;

    expect(() => createRuntime(createTestRuntimeInput({modules: [legacyModule]}))).toThrow(
      'Runtime command definition invalid',
    );
  });
});
