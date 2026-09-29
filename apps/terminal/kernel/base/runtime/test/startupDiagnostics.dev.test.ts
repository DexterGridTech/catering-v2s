import {describe, expect, it} from 'vitest';
import {releaseRuntimeForTest} from '../src/testing';
import {createRuntime, defineCommand, moduleName as runtimeModuleName} from '../src/index';
import {createCommandModule, createTestRuntimeInput, createTestSlice} from './testSupport';
import type {LogEvent} from '@catering-v2s/kernel-base-platform-ports';

describe('runtime startup diagnostics', () => {
  it('emits module, slice, command and actor facts from the runtime-owned sources', async () => {
    const events: LogEvent[] = [];
    const fixtureModuleName = 'test.startup.facts';
    const fixtureSliceName = 'test.startup.facts.slice';
    const fixtureCommand = defineCommand<Readonly<{}>>(fixtureModuleName, {
      name: 'known',
      visibility: 'internal',
    });
    const runtime = createRuntime(
      createTestRuntimeInput({
        events,
        modules: [
          createCommandModule({
            moduleName: fixtureModuleName,
            command: fixtureCommand,
            stateSlice: createTestSlice(fixtureSliceName),
          }),
        ],
      }),
    );
    try {
      await runtime.start();
      const startup = events.filter(event => event.category.startsWith('startup.'));
      if (!__DEV__) {
        expect(startup).toHaveLength(0);
        return;
      }
      expect(
        startup.map(event => event.category),
        'DEV_STARTUP_RUNTIME_FACTS_MISSING',
      ).toEqual(
        expect.arrayContaining([
          'startup.ports',
          'startup.modules',
          'startup.slices',
          'startup.commands',
          'startup.actors',
        ]),
      );
      expect(new Set(startup.map(event => event.data?.startupRunId)).size).toBe(1);
      const modules = startup.find(event => event.category === 'startup.modules')?.data as {
        count: number;
        moduleNames: readonly string[];
      };
      const slices = startup.find(event => event.category === 'startup.slices')?.data as {
        count: number;
        slices: readonly {moduleName: string; sliceName: string}[];
      };
      const commands = startup.find(event => event.category === 'startup.commands')?.data as {
        count: number;
        commands: readonly {moduleName: string; commandName: string}[];
      };
      const actors = startup.find(event => event.category === 'startup.actors')?.data as {
        count: number;
        actorKeys: readonly string[];
      };
      expect(modules).toEqual(
        expect.objectContaining({
          count: 2,
          moduleNames: [runtimeModuleName, fixtureModuleName],
        }),
      );
      expect(slices).toEqual(
        expect.objectContaining({
          count: 4,
          slices: expect.arrayContaining([{moduleName: fixtureModuleName, sliceName: fixtureSliceName}]),
        }),
      );
      expect(commands).toEqual(
        expect.objectContaining({
          count: 6,
          commands: expect.arrayContaining([
            {moduleName: runtimeModuleName, commandName: `${runtimeModuleName}.reset-runtime-after-system-failure`},
            {moduleName: fixtureModuleName, commandName: `${fixtureModuleName}.known`},
          ]),
        }),
      );
      expect(actors).toEqual(
        expect.objectContaining({
          count: 5,
          actorKeys: expect.arrayContaining([
            `${runtimeModuleName}.reset-runtime-after-system-failure`,
            `${fixtureModuleName}.handler`,
          ]),
        }),
      );
    } finally {
      releaseRuntimeForTest(runtime);
    }
  });

  it('keeps startup failure terminal and visible when a pre-setup owner fails', async () => {
    const events: LogEvent[] = [];
    const runtime = createRuntime(
      createTestRuntimeInput({
        events,
        modules: [
          {
            moduleName: 'test.startup.failure',
            kind: 'owner',
            dependencies: [],
            preSetup: () => {
              throw new Error('startup fixture failure');
            },
          },
        ],
      }),
    );
    await expect(runtime.start()).rejects.toThrow('Runtime lifecycle failed');
    if (!__DEV__) {
      expect(events.some(event => event.category === 'startup.failed')).toBe(false);
      releaseRuntimeForTest(runtime);
      return;
    }
    expect(
      events.some(event => event.category === 'startup.failed'),
      'DEV_STARTUP_FAILURE_FACT_MISSING',
    ).toBe(true);
    expect(events.some(event => event.category === 'startup.complete')).toBe(false);
    releaseRuntimeForTest(runtime);
  });
});
