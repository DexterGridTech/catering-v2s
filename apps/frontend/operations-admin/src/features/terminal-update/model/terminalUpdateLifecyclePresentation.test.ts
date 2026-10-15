import {describe, expect, it} from 'vitest';
import {LIFECYCLE_COLORS, LIFECYCLE_LABELS} from '@catering-v2s/admin-ui-foundation';
import {
  terminalUpdateRuleDetailLabel,
  terminalUpdateRuleStoreLabel,
  terminalUpdateRuleTablePresentation,
} from './terminalUpdateLifecyclePresentation';

describe('terminal update lifecycle presentation', () => {
  it('uses foundation labels and colors for known rule statuses and preserves the list fallback', () => {
    expect(terminalUpdateRuleTablePresentation('ENABLED')).toEqual({
      label: LIFECYCLE_LABELS.ENABLED,
      color: LIFECYCLE_COLORS.ENABLED,
    });
    expect(terminalUpdateRuleTablePresentation('DISABLED')).toEqual({
      label: LIFECYCLE_LABELS.DISABLED,
      color: LIFECYCLE_COLORS.DISABLED,
    });
    expect(terminalUpdateRuleTablePresentation('FUTURE_STATUS')).toEqual({
      label: LIFECYCLE_LABELS.DISABLED,
      color: LIFECYCLE_COLORS.DISABLED,
    });
  });

  it('keeps the rule detail unknown fallback distinct from the list fallback', () => {
    expect(terminalUpdateRuleDetailLabel('ENABLED')).toBe(LIFECYCLE_LABELS.ENABLED);
    expect(terminalUpdateRuleDetailLabel('DISABLED')).toBe(LIFECYCLE_LABELS.DISABLED);
    expect(terminalUpdateRuleDetailLabel('FUTURE_STATUS')).toBe('状态未知');
  });

  it('preserves the rule-store aliases and fallback without treating them as owner state', () => {
    expect(terminalUpdateRuleStoreLabel('ENABLED')).toBe(LIFECYCLE_LABELS.ENABLED);
    expect(terminalUpdateRuleStoreLabel('DISABLED')).toBe(LIFECYCLE_LABELS.DISABLED);
    expect(terminalUpdateRuleStoreLabel('VOIDED')).toBe('已作废');
    expect(terminalUpdateRuleStoreLabel('UNKNOWN')).toBe('未知');
    expect(terminalUpdateRuleStoreLabel('FUTURE_STATUS')).toBe(LIFECYCLE_LABELS.ENABLED);
  });
});
