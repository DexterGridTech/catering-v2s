import {describe, expect, it} from 'vitest';
import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {createStartupReadyActor, createStartupReadyPayload, type StartupReadyPayload} from '../src';

const command = defineCommand<StartupReadyPayload>('test.console-startup', {
  name: 'startup-ready',
  visibility: 'internal',
});

describe('shared startup-ready mechanics', () => {
  it('maps only the startup payload facts and freezes the result', () => {
    const payload = createStartupReadyPayload({
      surfaceKey: 'PRIMARY',
      displayIndex: 0,
      displayMode: 'PRIMARY',
      containerKey: 'main',
      readyPartKey: 'test.part',
      contentFailure: null,
    });
    expect(payload).toEqual({
      surfaceKey: 'PRIMARY',
      displayIndex: 0,
      readyPartKey: 'test.part',
      contentFailure: null,
    });
    expect(Object.isFrozen(payload)).toBe(true);
  });

  it('creates the owner actor with the existing startup-ready identity', () => {
    const actor = createStartupReadyActor({
      moduleName: 'test.console-startup',
      command,
      message: 'startup accepted',
    });
    expect(actor.moduleName).toBe('test.console-startup');
    expect(actor.actorName).toBe('startup-ready');
    expect(actor.handlers).toHaveLength(1);
    expect(actor.handlers[0]?.commandName).toBe(command.commandName);
  });
});
