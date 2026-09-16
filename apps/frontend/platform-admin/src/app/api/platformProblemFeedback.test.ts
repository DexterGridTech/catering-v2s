import {describe, expect, it} from 'vitest';
import {EDGE_PROBLEM_CODES} from './generated/platform-edge';
import {PLATFORM_PROBLEM_FEEDBACK} from './platformProblemFeedback';
import {platformProblemOf} from './PlatformTransport';

describe('platform Problem feedback contract', () => {
  it('has business copy for every generated platform error code', () => {
    expect(Object.keys(PLATFORM_PROBLEM_FEEDBACK).sort()).toEqual([...EDGE_PROBLEM_CODES].sort());
    for (const feedback of Object.values(PLATFORM_PROBLEM_FEEDBACK)) {
      expect(feedback.title).not.toMatch(/errorCode|Problem|异常码|请求失败/);
      expect(feedback.detail).not.toMatch(/errorCode|\bdetail\b|请根据错误码/);
    }
  });

  it('normalizes structured and network failures without exposing contract diagnostics', () => {
    const limited = platformProblemOf({
      data: {
        type: 'about:blank',
        title: 'PLATFORM_IAM_RATE_LIMITED',
        status: 429,
        detail: '尝试次数过多，请稍后再试',
        errorCode: 'PLATFORM_IAM_RATE_LIMITED',
        correlationId: 'c-1',
      },
    });
    expect(limited.errorCode).toBe('PLATFORM_IAM_RATE_LIMITED');
    expect(limited.title).toBe('操作暂时受限');
    expect(limited.detail).toBe('验证码请求过于频繁，请稍后再试。');
    expect(limited.contractDetail).toBe('尝试次数过多，请稍后再试');
    const unknown = platformProblemOf({data: {title: 'SOME_NEW_CODE', status: 500, detail: 'internal stack'}});
    expect(unknown.errorCode).toBe('PLATFORM_COMMON_RESULT_UNKNOWN');
    expect(unknown.detail).not.toContain('internal stack');
    expect(
      platformProblemOf({status: 'PARSING_ERROR', originalStatus: 502, data: '<html>gateway failure</html>'}).errorCode,
    ).toBe('PLATFORM_COMMON_RESULT_UNKNOWN');
    expect(
      platformProblemOf({status: 'PARSING_ERROR', originalStatus: 502, data: '<html>gateway failure</html>'}).status,
    ).toBe(502);
    expect(platformProblemOf({status: 503, data: null}).errorCode).toBe('PLATFORM_COMMON_RESULT_UNKNOWN');
    expect(platformProblemOf(new Error('socket closed')).errorCode).toBe('NETWORK_ERROR');
  });

  it('retains the server definition revision needed to bound stale recovery', () => {
    expect(
      platformProblemOf({
        data: {
          errorCode: 'EXTENSION_DEFINITION_REVISION_STALE',
          details: {currentDefinitionRevision: 7},
        },
      }).currentDefinitionRevision,
    ).toBe(7);
    expect(
      platformProblemOf({
        data: {
          errorCode: 'EXTENSION_DEFINITION_REVISION_STALE',
          details: {currentDefinitionRevision: '7'},
        },
      }).currentDefinitionRevision,
    ).toBeUndefined();
  });

  it('retains sanitized field-level details for invalid extension filters', () => {
    const problem = platformProblemOf({
      data: {
        errorCode: 'EXTENSION_FILTER_INVALID',
        details: {
          invalidFields: [{fieldKey: 'brandLevel', reason: 'TYPE_MISMATCH', expectedType: 'NUMBER'}],
        },
      },
    });
    expect(problem.invalidFields).toEqual([{fieldKey: 'brandLevel', reason: 'TYPE_MISMATCH', expectedType: 'NUMBER'}]);
  });
});
