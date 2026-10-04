import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {createRuntime, helloWorldCommand} from '../src';
import {createTestRuntimeInput} from './testSupport';
import {describe, expect, it} from 'vitest';

describe('helloWorldCommand', () => {
  it('is a registered public runtime command and returns a side-effect-free result', async () => {
    const runtime = createRuntime(createTestRuntimeInput());
    await runtime.start();

    const result = await runtime.dispatchCommand(helloWorldCommand, {}, {requestId: createRequestId()});

    expect(result).toMatchObject({
      status: 'completed',
      actorResults: [{status: 'completed', result: {message: 'helloWorld'}}],
    });
  });
});
