import {describe, expect, it} from 'vitest';
import {terminalUpdateActualUnknownReasonLabel} from './terminalUpdateActualUnknownReason';

describe('terminal update actual unknown reason labels', () => {
  it('renders each canonical actual readback reason in Chinese', () => {
    expect(terminalUpdateActualUnknownReasonLabel('READBACK_UNAVAILABLE')).toBe('无法读取设备实际版本');
    expect(terminalUpdateActualUnknownReasonLabel('NOT_INSTALLED')).toBe('设备未安装此应用');
    expect(terminalUpdateActualUnknownReasonLabel('MISMATCH')).toBe('读取到的应用身份不匹配');
    expect(terminalUpdateActualUnknownReasonLabel('OTHER')).toBe('设备实际版本无法确认');
  });

  it('does not invent an actual failure reason for null or unknown values', () => {
    expect(terminalUpdateActualUnknownReasonLabel(null)).toBeNull();
    expect(terminalUpdateActualUnknownReasonLabel('FUTURE_REASON')).toBeNull();
  });
});
