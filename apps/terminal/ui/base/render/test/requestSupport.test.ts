import {describe, expect, it} from 'vitest';
import {createCommandId, createRequestId, type RequestId} from '@catering-v2s/kernel-base-contracts';
import {defineCommand, type CommandDispatchResult, type CommandIntent} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {dispatchWithRequestId} from '../src/index';
import type {RenderProviderProps} from '../src/types/props';

type Payload = Readonly<{value: string}>;

const definition = defineCommand<Payload>('render.request-support-test', {
  name: 'submit',
  visibility: 'public',
});

const result: CommandDispatchResult = {
  requestId: null,
  commandId: createCommandId(),
  status: 'completed',
  actorResults: [],
};

type CapturedCall = Readonly<{
  commandName: string;
  payload: StateJsonValue;
  requestId: RequestId;
}>;

const createDispatchSpy = (): Readonly<{
  dispatchCommand: RenderProviderProps['dispatchCommand'];
  calls: CapturedCall[];
}> => {
  const calls: CapturedCall[] = [];
  const dispatchCommand: RenderProviderProps['dispatchCommand'] = async <TPayload extends StateJsonValue>(
    command: CommandIntent<TPayload>,
    options: Readonly<{readonly requestId: RequestId}>,
  ): Promise<CommandDispatchResult> => {
    calls.push({
      commandName: command.definition.commandName,
      payload: command.payload,
      requestId: options.requestId,
    });
    return result;
  };
  return {dispatchCommand, calls};
};

describe('render request helpers', () => {
  it('creates a request id and dispatches the typed command payload', async () => {
    const spy = createDispatchSpy();

    await expect(
      dispatchWithRequestId({
        dispatchCommand: spy.dispatchCommand,
        definition,
        payload: {value: 'created'},
      }),
    ).resolves.toBe(result);

    expect(spy.calls).toHaveLength(1);
    expect(spy.calls[0]?.commandName).toBe(definition.commandName);
    expect(spy.calls[0]?.payload).toEqual({value: 'created'});
    expect(spy.calls[0]?.requestId).toMatch(/^req_/);
  });

  it('preserves an explicitly supplied request id', async () => {
    const spy = createDispatchSpy();
    const requestId = createRequestId();

    await dispatchWithRequestId({
      dispatchCommand: spy.dispatchCommand,
      definition,
      payload: {value: 'explicit'},
      requestId,
    });

    expect(spy.calls[0]?.requestId).toBe(requestId);
  });
});
