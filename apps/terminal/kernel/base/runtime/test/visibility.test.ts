import {describe, expect, it} from 'vitest';
import {createRequestId, createCommandId} from '@catering-v2s/kernel-base-contracts';
import {
  createRuntimeModule,
  createCommand,
  createRuntime,
  defineActor,
  defineCommand,
  type ActorCommandHandler,
  type CommandDefinition,
  onCommand,
  type RuntimeModule,
} from '../src/index';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {createTestRuntimeInput, createTestSlice} from './testSupport';

const publicCommand = defineCommand<{value: number}>('test.visibility', {
  name: 'public-command',
  visibility: 'public',
});
const internalCommand = defineCommand<Readonly<{}>>('test.visibility', {
  name: 'internal-command',
  visibility: 'internal',
  allowNoActor: true,
});

const createModule = <TPayload extends StateJsonValue>(
  input: Readonly<{
    command: CommandDefinition<TPayload>;
    handler?: ActorCommandHandler<TPayload>;
  }>,
): RuntimeModule => {
  const command = input.command;
  const actorName = 'handler';
  const actor = defineActor('test.visibility', actorName, [onCommand(command, input.handler ?? (() => ({ok: true})))]);
  return createRuntimeModule({
    moduleName: 'test.visibility',
    kind: 'owner' as const,
    dependencies: [{moduleName: 'kernel.base.runtime'}],
    commandDefinitions: [command],
    actorDefinitions: [actor],
    stateSlices: [createTestSlice('test.visibility.state')],
  });
};

describe('runtime command visibility and identity', () => {
  it('V-1 rejects a public command without requestId and accepts one with identity', async () => {
    const runtime = createRuntime(createTestRuntimeInput({modules: [createModule({command: publicCommand})]}));
    await runtime.start();
    await expect(runtime.dispatchCommand(publicCommand, {value: 1})).rejects.toMatchObject({
      key: 'kernel.base.runtime.request_id_required',
    });
    const requestId = createRequestId();
    const result = await runtime.dispatchCommand(publicCommand, {value: 2}, {requestId});
    expect(result.requestId).toBe(requestId);
    expect(result.status).toBe('completed');
    expect(result.actorResults[0]?.result).toEqual({ok: true});
  });

  it('V-2 permits internal commands with and without request identity', async () => {
    const runtime = createRuntime(createTestRuntimeInput({modules: [createModule({command: internalCommand})]}));
    await runtime.start();
    const noRequest = await runtime.dispatchCommand(internalCommand, {});
    expect(noRequest.requestId).toBeNull();
    expect(noRequest.status).toBe('completed');
    const requestId = createRequestId();
    const withRequest = await runtime.dispatchCommand(internalCommand, {}, {requestId});
    expect(withRequest.requestId).toBe(requestId);
    expect(withRequest.status).toBe('completed');
  });

  it('V-3 leaves lifecycle initialize internal and unassociated', async () => {
    const runtime = createRuntime(createTestRuntimeInput());
    await runtime.start();
    const initialize = runtime.journal
      .list()
      .find(event => event.kind === 'command.started' && event.commandName === 'kernel.base.runtime.initialize');
    expect(initialize?.requestId).toBeNull();
    expect(initialize?.visibility).toBe('internal');
    expect(
      runtime.journal
        .list()
        .some(event => event.commandName === 'kernel.base.runtime.initialize' && event.requestId !== null),
    ).toBe(false);
  });

  it('V-4 preserves all identity and route options through both facade overloads', async () => {
    const observed: Array<{requestId: unknown; commandId: unknown; parentCommandId: unknown; routeContext: unknown}> =
      [];
    const runtime = createRuntime(
      createTestRuntimeInput({
        modules: [
          createModule({
            command: publicCommand,
            handler: context => {
              observed.push({
                requestId: context.command.requestId,
                commandId: context.command.commandId,
                parentCommandId: context.command.parentCommandId,
                routeContext: context.command.routeContext,
              });
              return {ok: true};
            },
          }),
        ],
      }),
    );
    await runtime.start();
    const requestId = createRequestId();
    const commandId = createCommandId();
    const parentCommandId = createCommandId();
    const routeContext = Object.freeze({workspace: 'BRANCH', instanceMode: 'MASTER'});
    await runtime.dispatchCommand(publicCommand, {value: 1}, {requestId, commandId, parentCommandId, routeContext});
    await runtime.dispatchCommand(publicCommand.commandName, {value: 2}, {requestId, routeContext});
    expect(observed[0]).toEqual({requestId, commandId, parentCommandId, routeContext});
    expect(observed[1]?.requestId).toBe(requestId);
    expect(observed[1]?.parentCommandId).toBeNull();
    expect(observed[1]?.routeContext).toBe(routeContext);
    await expect(runtime.dispatchCommand('test.visibility.unknown', {value: 3}, {requestId})).rejects.toMatchObject({
      key: 'kernel.base.runtime.lifecycle_failed',
      message: 'Runtime lifecycle failed',
    });
    expect(createCommand(publicCommand, {value: 3}).definition).toBe(publicCommand);
  });
});
