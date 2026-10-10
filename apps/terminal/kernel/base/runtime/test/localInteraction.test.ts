import {describe, expect, it} from 'vitest';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {createRuntime, recordLocalInteractionCommand} from '../src/index';
import {createTestRuntimeInput} from './testSupport';

const selectorName = 'kernel.base.runtime.selectLastLocalInteraction';
type LocalInteraction = Readonly<{lastClickAt: number; revision: number}>;

describe('Runtime local interaction', () => {
  it('seeds the current boot, records local clicks, and ignores another Runtime identity', async () => {
    const first = createRuntime(createTestRuntimeInput({runtimeName: 'local-interaction-first'}));
    const second = createRuntime(createTestRuntimeInput({runtimeName: 'local-interaction-second'}));
    await first.start();
    await second.start();

    const baseline = first.evaluateSelector(selectorName, []) as LocalInteraction;
    expect(baseline.lastClickAt).toBeGreaterThan(0);
    expect(baseline.revision).toBe(0);

    const accepted = await first.dispatchCommand(recordLocalInteractionCommand, {
      runtimeIdentity: first.runtimeId,
    }, {requestId: createRequestId()});
    expect(accepted.status).toBe('completed');
    expect(first.evaluateSelector(selectorName, [])).toMatchObject({revision: 1});
    expect(second.evaluateSelector(selectorName, [])).toMatchObject({revision: 0});

    const stale = await first.dispatchCommand(recordLocalInteractionCommand, {
      runtimeIdentity: second.runtimeId,
    }, {requestId: createRequestId()});
    expect(stale.status).toBe('completed');
    expect(first.evaluateSelector(selectorName, [])).toMatchObject({revision: 1});
  });
});
