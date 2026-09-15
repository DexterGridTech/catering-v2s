import {describe, expect, it} from 'vitest';
import {organizationStoreStatusLabels, toggleOrganizationStoreStatus} from './organizationStatus';

describe('organization store status', () => {
  it('keeps every generated status in the Chinese label set', () => {
    expect(organizationStoreStatusLabels).toEqual({
      ENABLED: '启用',
      DISABLED: '停用',
      VOIDED: '作废',
    });
  });

  it('only toggles statuses that the owner lifecycle permits', () => {
    expect(toggleOrganizationStoreStatus('ENABLED')).toBe('DISABLED');
    expect(toggleOrganizationStoreStatus('DISABLED')).toBe('ENABLED');
    expect(toggleOrganizationStoreStatus('VOIDED')).toBeUndefined();
  });
});
