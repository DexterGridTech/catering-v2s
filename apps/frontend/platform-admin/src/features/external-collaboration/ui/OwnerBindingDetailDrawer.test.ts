import {describe, expect, it} from 'vitest';
import {
  canEditOwnerBinding,
  canDeleteOwnerBinding,
  formatOwnerBindingTimestamp,
  ownerBindingAuthorizationExplanation,
  retainOwnerBindingOnRefresh,
} from './OwnerBindingDetailDrawer';

describe('owner binding detail/edit presentation rules', () => {
  it('only exposes local edit for non-deleted internal mapping and no mapping bindings', () => {
    expect(
      canEditOwnerBinding({authenticationKind: 'INTERNAL_MAPPING', enablementStatus: 'ENABLED'}, 'EFFECTIVE'),
    ).toBe(true);
    expect(canEditOwnerBinding({authenticationKind: 'NO_MAPPING', enablementStatus: 'ENABLED'}, 'EFFECTIVE')).toBe(
      true,
    );
    expect(
      canEditOwnerBinding({authenticationKind: 'EXTERNAL_GRANT', enablementStatus: 'ENABLED'}, 'PENDING_AUTHORIZATION'),
    ).toBe(false);
    expect(canEditOwnerBinding({authenticationKind: 'INTERNAL_MAPPING', enablementStatus: 'ENABLED'}, 'DELETED')).toBe(
      false,
    );
    expect(
      canEditOwnerBinding({authenticationKind: 'INTERNAL_MAPPING', enablementStatus: 'DISABLED'}, 'EFFECTIVE'),
    ).toBe(false);
    expect(canDeleteOwnerBinding({unbindKind: 'LOCAL_ONLY'}, 'EFFECTIVE')).toBe(true);
    expect(canDeleteOwnerBinding({unbindKind: 'REQUIRES_ADAPTER_UNBIND'}, 'EFFECTIVE')).toBe(true);
    expect(canDeleteOwnerBinding({unbindKind: 'MYSTERY' as never}, 'EFFECTIVE')).toBe(false);
  });

  it('keeps authorization explanations and timestamp display user-facing', () => {
    expect(ownerBindingAuthorizationExplanation('EXTERNAL_GRANT')).toContain('回调管理');
    expect(ownerBindingAuthorizationExplanation('NO_MAPPING')).toContain('无需外部主体映射');
    expect(formatOwnerBindingTimestamp(Date.UTC(2026, 7, 19, 12, 34, 56))).toContain('2026');
  });

  it('retains the same binding during refresh but never leaks it to another identity', () => {
    const current = {bindingRef: 'binding-a'} as never;
    expect(retainOwnerBindingOnRefresh(current, 'binding-a')).toBe(current);
    expect(retainOwnerBindingOnRefresh(current, 'binding-b')).toBeUndefined();
    expect(retainOwnerBindingOnRefresh(undefined, 'binding-a')).toBeUndefined();
  });
});
