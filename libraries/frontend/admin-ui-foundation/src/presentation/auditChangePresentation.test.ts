import {describe, expect, it} from 'vitest';
import {auditActionLabel, auditFieldLabel, auditValue} from './auditChangePresentation';

const change = (overrides: Record<string, unknown> = {}) => ({fieldKey: 'name', ...overrides});

describe('auditChangePresentation', () => {
  it('uses the historical label snapshot before current registries', () => {
    expect(auditFieldLabel(change({fieldLabelSnapshot: '当时的项目名称'}))).toBe('当时的项目名称');
    expect(auditFieldLabel(change({fieldKey: 'name'}))).toBe('名称');
    expect(auditFieldLabel(change({fieldKey: 'removedExtension'}))).toBe('字段（removedExtension）');
  });

  it('keeps four explicit empty states and legacy unknown-state fallback distinct', () => {
    expect(auditValue(change({beforeState: 'MISSING', beforeValue: null}), 'before')).toBe('未填写');
    expect(auditValue(change({beforeState: 'NULL', beforeValue: null}), 'before')).toBe('空值');
    expect(auditValue(change({beforeState: 'CLEARED', beforeValue: null}), 'before')).toBe('已清空');
    expect(auditValue(change({beforeState: 'VALUE', beforeValue: ''}), 'before')).toBe('空字符串');
    expect(auditValue(change({beforeValue: null}), 'before')).toBe('历史记录未区分空值状态');
  });

  it('uses the shared action registry and a stable unknown fallback', () => {
    expect(auditActionLabel('WORKSPACE_INVITATION_CREATED')).toBe('已创建邀请');
    expect(auditActionLabel('UNKNOWN_ACTION')).toBe('已记录操作');
  });
});
