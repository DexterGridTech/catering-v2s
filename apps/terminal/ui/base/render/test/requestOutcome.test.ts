import {describe, expect, it} from 'vitest';
import {createCommandId} from '@catering-v2s/kernel-base-contracts';
import type {CommandAggregateStatus, CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';
import {classifyRequestResult, type RequestOutcome} from '../src/foundations/requestOutcome';

const makeResult = (status: CommandAggregateStatus, categories: readonly string[] = []): CommandDispatchResult => ({
  requestId: null,
  commandId: createCommandId(),
  status,
  actorResults: categories.map((category, index) => ({
    actorKey: `test.actor.${index}`,
    status: 'error' as const,
    startedAt: 1,
    completedAt: 2,
    result: null,
    error: {
      key: `test.error.${index}`,
      code: `ERR_TEST_${index}`,
      message: 'redacted test error',
      category: category as never,
      severity: 'MEDIUM' as const,
    },
  })),
});

describe('classifyRequestResult', () => {
  const cases = [
    ['completed', [], 'completed'],
    ['running', [], 'running'],
    ['partial-failed', ['AUTHENTICATION'], 'business-failure'],
    ['timed-out', ['BUSINESS'], 'business-failure'],
    ['error', ['VALIDATION'], 'business-failure'],
    ['partial-failed', ['AUTHORIZATION'], 'system-failure'],
    ['timed-out', ['NETWORK'], 'system-failure'],
    ['error', ['DATABASE'], 'system-failure'],
    ['error', ['EXTERNAL_API'], 'system-failure'],
    ['error', ['SYSTEM'], 'system-failure'],
    ['error', ['UNKNOWN'], 'system-failure'],
    ['error', [], 'system-failure'],
    ['error', ['BUSINESS', 'SYSTEM'], 'system-failure'],
    ['error', ['NOT_A_KERNEL_CATEGORY'], 'system-failure'],
  ] as const satisfies readonly (readonly [CommandAggregateStatus, readonly string[], RequestOutcome])[];

  for (const [status, categories, expected] of cases) {
    it(`${status} with categories ${categories.join(',') || 'none'} is ${expected}`, () => {
      expect(classifyRequestResult(makeResult(status, categories))).toBe(expected);
    });
  }

  it('filters null actor errors without treating a missing error as business failure', () => {
    const result = makeResult('error', ['BUSINESS']);
    const [actor] = result.actorResults;
    expect(
      classifyRequestResult({
        ...result,
        actorResults: [{...actor, error: null}],
      }),
    ).toBe('system-failure');
  });
});
