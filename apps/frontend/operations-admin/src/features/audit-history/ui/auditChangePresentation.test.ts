import {describe, expect, it} from 'vitest';
import type {AuditChange} from '../../../app/api/generated/operations-edge';
import {auditFieldLabel, auditValue} from './auditChangePresentation';

const change = (overrides: Partial<AuditChange> = {}): AuditChange => ({fieldKey: 'customRule', ...overrides});

describe('operations audit change presentation', () => {
  it('prefers the snapshot, then a fixed label, then the stable key', () => {
    expect(auditFieldLabel(change({fieldLabelSnapshot: '当时的名称'}))).toBe('当时的名称');
    expect(auditFieldLabel(change({fieldKey: 'status'}))).toBe('状态');
    expect(auditFieldLabel(change())).toBe('字段（customRule）');
  });

  it('renders all four new states without collapsing them', () => {
    expect(auditValue(change({beforeState: 'MISSING', beforeValue: null}), 'before')).toBe('未填写');
    expect(auditValue(change({beforeState: 'NULL', beforeValue: null}), 'before')).toBe('空值');
    expect(auditValue(change({beforeState: 'CLEARED', beforeValue: null}), 'before')).toBe('已清空');
    expect(auditValue(change({beforeState: 'VALUE', beforeValue: ''}), 'before')).toBe('空字符串');
    expect(auditValue(change({afterState: 'VALUE', afterValue: 'enabled'}), 'after')).toBe('enabled');
  });

  it('does not guess the empty state of legacy rows', () => {
    expect(auditValue(change({beforeValue: null}), 'before')).toBe('历史记录未区分空值状态');
    expect(auditValue(change({afterValue: 'legacy'}), 'after')).toBe('legacy');
  });
});
