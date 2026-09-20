import {describe, expect, it} from 'vitest';
import {
  businessEntityLifecycleLabels,
  canManageBusinessEntity,
  canVoidBusinessEntity,
  toggleBusinessEntityStatus,
} from './businessEntityLifecycle';

describe('business entity lifecycle presentation', () => {
  it('covers the three lifecycle labels and terminal action boundary', () => {
    expect(businessEntityLifecycleLabels).toEqual({ENABLED: '启用', DISABLED: '停用', VOIDED: '作废'});
    expect(canManageBusinessEntity('ENABLED')).toBe(true);
    expect(canManageBusinessEntity('DISABLED')).toBe(true);
    expect(canManageBusinessEntity('VOIDED')).toBe(false);
    expect(canVoidBusinessEntity('ENABLED')).toBe(true);
    expect(canVoidBusinessEntity('DISABLED')).toBe(true);
    expect(canVoidBusinessEntity('VOIDED')).toBe(false);
    expect(toggleBusinessEntityStatus('ENABLED')).toBe('DISABLED');
    expect(toggleBusinessEntityStatus('DISABLED')).toBe('ENABLED');
    expect(toggleBusinessEntityStatus('VOIDED')).toBeUndefined();
  });
});
