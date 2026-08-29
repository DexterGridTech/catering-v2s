import {describe, expect, it} from 'vitest';
import {businessChannelActionAvailability, canTransitionBusinessChannelStatus} from './businessChannelActionPolicy';

describe('business-channel lifecycle actions', () => {
  it.each([
    ['ENABLED', {canEdit: true, canMaintainBinding: true, canDisable: true, canEnable: false}],
    ['DISABLED', {canEdit: true, canMaintainBinding: true, canDisable: false, canEnable: true}],
    ['VOIDED', {canEdit: false, canMaintainBinding: false, canDisable: false, canEnable: false}],
  ] as const)('uses self status for %s', (status, expected) => {
    expect(businessChannelActionAvailability(status)).toEqual(expected);
  });

  it.each([
    ['ENABLED', 'DISABLED', true],
    ['ENABLED', 'ENABLED', false],
    ['ENABLED', 'VOIDED', false],
    ['DISABLED', 'ENABLED', true],
    ['DISABLED', 'DISABLED', false],
    ['DISABLED', 'VOIDED', false],
    ['VOIDED', 'ENABLED', false],
    ['VOIDED', 'DISABLED', false],
    ['VOIDED', 'VOIDED', false],
  ] as const)('only permits valid transitions: %s -> %s', (currentStatus, targetStatus, expected) => {
    expect(canTransitionBusinessChannelStatus(currentStatus, targetStatus)).toBe(expected);
  });

  it('fails closed for an unknown lifecycle value received at runtime', () => {
    expect(businessChannelActionAvailability('MYSTERY' as never)).toEqual({
      canEdit: false,
      canMaintainBinding: false,
      canDisable: false,
      canEnable: false,
    });
    expect(canTransitionBusinessChannelStatus('MYSTERY' as never, 'ENABLED')).toBe(false);
    expect(canTransitionBusinessChannelStatus('DISABLED', 'MYSTERY' as never)).toBe(false);
  });
});
