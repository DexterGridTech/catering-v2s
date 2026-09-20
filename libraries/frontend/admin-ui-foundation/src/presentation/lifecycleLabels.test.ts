import {describe, expect, it} from 'vitest';
import {LIFECYCLE_COLORS, LIFECYCLE_LABELS, lifecycleColor, lifecycleLabel} from './lifecycleLabels';

describe('lifecycleLabels', () => {
  it('keeps the three cross-domain lifecycle values and presentation together', () => {
    expect(LIFECYCLE_LABELS).toEqual({ENABLED: '启用', DISABLED: '停用', VOIDED: '作废'});
    expect(LIFECYCLE_COLORS).toEqual({ENABLED: 'success', DISABLED: 'warning', VOIDED: 'error'});
  });

  it('does not pretend an unrelated state machine is a lifecycle value', () => {
    expect(lifecycleLabel('ACTIVE')).toBe('ACTIVE');
    expect(lifecycleColor('ACTIVE')).toBe('default');
    expect(lifecycleLabel(undefined)).toBe('—');
  });
});
