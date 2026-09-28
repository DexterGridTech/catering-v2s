import {describe, expect, it} from 'vitest';
import {createRuntime, defineActor, defineCommand, onCommand} from '../src/index';
import {createActorRegistry} from '../src/foundations/createActorRegistry';
import {describeRuntimeModule} from '../src/application/moduleManifest';
import {resolveModuleOrder} from '../src/foundations/resolveModuleOrder';
import {createDisplayContextModule} from '@catering-v2s/kernel-base-display-context';
import {createTestRuntimeInput, createTestSlice} from './testSupport';
import type {ActorCommandHandlerDefinition, ActorDefinition, RuntimeModule} from '../src/index';

const moduleWith = (moduleName: string, dependencies: RuntimeModule['dependencies'] = []): RuntimeModule => ({
  moduleName,
  kind: 'owner',
  dependencies,
});

describe('runtime module system', () => {
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
    const commandModule = {
      ...first,
      commands: [{name: command.commandName, visibility: command.visibility}],
      commandDefinitions: [command],
    };
    expect(describeRuntimeModule(commandModule).commandNames).toEqual([command.commandName]);
    expect(() =>
      createRuntime(
        createTestRuntimeInput({
          modules: [
            {
              ...first,
              commands: [{name: 'run', visibility: command.visibility}],
              commandDefinitions: [command],
            },
          ],
        }),
      ),
    ).toThrow('Runtime command definition invalid');
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
              commands: [{name: crossModuleCommand.commandName, visibility: 'public'}],
              commandDefinitions: [crossModuleCommand],
            },
            {
              ...moduleWith('subscriber.module'),
              actors: [{name: 'subscriber'}],
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
              commands: [{name: command.commandName, visibility: 'public'}],
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
              commands: [{name: command.commandName, visibility: 'public'}],
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

  it('M-6 rejects command declarations that have no matching definition', () => {
    let thrown: unknown;
    try {
      createRuntime(
        createTestRuntimeInput({
          modules: [
            {
              ...moduleWith('test.missing-definition'),
              commands: [{name: 'test.missing-definition.run', visibility: 'internal'}],
              commandDefinitions: [],
            },
          ],
        }),
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toMatchObject({
      key: 'kernel.base.runtime.command_definition_invalid',
      details: {message: 'Runtime command declaration has no definition: test.missing-definition.run'},
    });
  });
});
