import {describe, expect, it} from 'vitest';
import {canCreateOwnerBinding} from './ownerBindingPresentation';

describe('owner binding create presentation rules', () => {
  it('allows creation only for enabled non-external-mapping profiles', () => {
    expect(canCreateOwnerBinding({authenticationKind: 'INTERNAL_MAPPING', enablementStatus: 'ENABLED'})).toBe(true);
    expect(canCreateOwnerBinding({authenticationKind: 'NO_MAPPING', enablementStatus: 'ENABLED'})).toBe(true);
    expect(canCreateOwnerBinding({authenticationKind: 'EXTERNAL_GRANT', enablementStatus: 'ENABLED'})).toBe(false);
    expect(canCreateOwnerBinding({authenticationKind: 'INTERNAL_MAPPING', enablementStatus: 'DISABLED'})).toBe(false);
  });
});
