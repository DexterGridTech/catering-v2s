import {describe, expect, it} from 'vitest';
import {EDGE_PROBLEM_CODES as OPERATIONS_EDGE_PROBLEM_CODES} from './generated/operations-edge';
import {EDGE_PROBLEM_CODES as PUBLIC_EDGE_PROBLEM_CODES} from './generated/public-edge';
import {operationsProblemOf} from './OperationsTransport';
import {OPERATIONS_PROBLEM_FEEDBACK} from './operationsProblemFeedback';

describe('operations/public Problem feedback contract', () => {
  it('has business copy for every generated operations and public error code', () => {
    const expected = [...new Set([...OPERATIONS_EDGE_PROBLEM_CODES, ...PUBLIC_EDGE_PROBLEM_CODES])].sort();
    expect(Object.keys(OPERATIONS_PROBLEM_FEEDBACK).sort()).toEqual(expected);
    for (const feedback of Object.values(OPERATIONS_PROBLEM_FEEDBACK)) {
      expect(feedback.title).not.toMatch(/errorCode|Problem|异常码|请求失败/);
      expect(feedback.detail).not.toMatch(/errorCode|\bdetail\b|请根据错误码/);
    }
    expect(OPERATIONS_PROBLEM_FEEDBACK.TERMINAL_BINDING_CHANGED).toEqual({
      title: '终端绑定已变化',
      detail: '请重新读取后再操作。',
    });
    expect(OPERATIONS_PROBLEM_FEEDBACK.TERMINAL_BINDING_NOT_ACTIVE).toEqual({
      title: '终端当前未激活',
      detail: '请刷新终端详情后再操作。',
    });
  });

  it('normalizes structured and network failures without exposing contract diagnostics', () => {
    const limited = operationsProblemOf({
      data: {
        title: 'WORKSPACE_IAM_RATE_LIMITED',
        status: 429,
        detail: 'technical detail',
        errorCode: 'WORKSPACE_IAM_RATE_LIMITED',
        correlationId: 'c-2',
      },
    });
    expect(limited.errorCode).toBe('WORKSPACE_IAM_RATE_LIMITED');
    expect(limited.title).toBe('操作暂时受限');
    expect(limited.detail).toBe('验证码请求过于频繁，请稍后再试。');
    expect(limited.detail).not.toContain('technical detail');
    const unknown = operationsProblemOf({data: {title: 'SOME_NEW_CODE', status: 500, detail: 'internal stack'}});
    expect(unknown.errorCode).toBe('PLATFORM_COMMON_RESULT_UNKNOWN');
    expect(unknown.detail).not.toContain('internal stack');
    expect(
      operationsProblemOf({status: 'PARSING_ERROR', originalStatus: 502, data: '<html>gateway failure</html>'})
        .errorCode,
    ).toBe('PLATFORM_COMMON_RESULT_UNKNOWN');
    expect(
      operationsProblemOf({status: 'PARSING_ERROR', originalStatus: 502, data: '<html>gateway failure</html>'}).status,
    ).toBe(502);
    expect(operationsProblemOf({status: 503, data: null}).errorCode).toBe('PLATFORM_COMMON_RESULT_UNKNOWN');
    expect(operationsProblemOf(new Error('socket closed')).errorCode).toBe('NETWORK_ERROR');
  });

  it('retains the server definition revision needed to bound stale recovery', () => {
    expect(
      operationsProblemOf({
        data: {
          errorCode: 'EXTENSION_DEFINITION_REVISION_STALE',
          details: {currentDefinitionRevision: 7},
        },
      }).currentDefinitionRevision,
    ).toBe(7);
    expect(
      operationsProblemOf({
        data: {
          errorCode: 'EXTENSION_DEFINITION_REVISION_STALE',
          details: {currentDefinitionRevision: '7'},
        },
      }).currentDefinitionRevision,
    ).toBeUndefined();
  });

  it('retains sanitized field-level details for invalid extension filters', () => {
    const problem = operationsProblemOf({
      data: {
        errorCode: 'EXTENSION_FILTER_INVALID',
        details: {
          invalidFields: [{fieldKey: 'contractFilter', reason: 'TYPE_MISMATCH', expectedType: 'NUMBER'}],
        },
      },
    });
    expect(problem.invalidFields).toEqual([
      {fieldKey: 'contractFilter', reason: 'TYPE_MISMATCH', expectedType: 'NUMBER'},
    ]);
  });
});
