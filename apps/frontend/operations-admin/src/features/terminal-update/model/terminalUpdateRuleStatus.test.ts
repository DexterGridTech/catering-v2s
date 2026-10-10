import {describe, expect, it} from 'vitest';
import {
  isTerminalUpdateVersionConflict,
  terminalUpdateStatusActionLabel,
  terminalUpdateStatusAlreadyApplied,
  terminalUpdateStatusConfirmTitle,
} from './terminalUpdateRuleStatus';

describe('terminal update rule status conflict', () => {
  it('treats only the version conflict as CAS and keeps confirmation copy bound to the user intent', () => {
    expect(isTerminalUpdateVersionConflict({status: 409, errorCode: 'PLATFORM_COMMON_VERSION_CONFLICT'})).toBe(true);
    expect(isTerminalUpdateVersionConflict({status: 409, errorCode: 'PLATFORM_COMMON_IDEMPOTENCY_CONFLICT'})).toBe(false);
    expect(isTerminalUpdateVersionConflict({status: 409, errorCode: 'TERMINAL_UPDATE_REPORT_IDENTITY_CONFLICT'})).toBe(false);
    expect(terminalUpdateStatusActionLabel('ENABLED')).toBe('启用');
    expect(terminalUpdateStatusConfirmTitle('ENABLED', '测试规则')).toBe('启用“测试规则”？');
    expect(terminalUpdateStatusConfirmTitle('DISABLED', '测试规则')).toBe('停用“测试规则”？');
    expect(terminalUpdateStatusAlreadyApplied('ENABLED', 'ENABLED')).toBe(true);
    expect(terminalUpdateStatusAlreadyApplied('DISABLED', 'ENABLED')).toBe(false);
  });
});
