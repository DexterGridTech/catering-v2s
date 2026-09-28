import {describe, expect, it} from 'vitest';
import {
  ADMIN_PASSWORD_FALLBACK,
  deriveAdminPassword,
  normalizeDeviceIdentity,
  verifyAdminPassword,
} from '../src/foundations/adminPassword';
import {
  AdminNavigationRejectedError,
  createAdminSectionCommandBoundary,
} from '../src/foundations/adminSectionSelection';
import {openLayerCommand} from '@catering-v2s/kernel-base-ui-state';

const localDate = (hour: number): Date => new Date(2026, 8, 10, hour, 0, 0, 0);

describe('admin password identity boundary', () => {
  it('normalizes one resolved device identity and preserves an unavailable result as unknown', () => {
    expect(
      normalizeDeviceIdentity({
        status: 'succeeded',
        value: {
          deviceId: ' DEVICE-001 ',
          systemName: 'Android',
          systemVersion: '15',
          logicalProcessorCount: 8,
        },
        completedAt: 1,
      }),
    ).toEqual({available: true, deviceId: 'DEVICE-001'});
    expect(
      normalizeDeviceIdentity({
        status: 'unavailable',
        port: 'device',
        capability: 'getDeviceInfo',
        reason: 'PLATFORM_UNSUPPORTED',
        message: 'unavailable',
      }),
    ).toEqual({available: false, deviceId: null});
  });

  it('matches the frozen local-time vectors', () => {
    expect(
      [9, 10, 11, 12].map(hour => deriveAdminPassword({deviceId: 'DEVICE-001', localDate: localDate(hour)})),
    ).toEqual(['211940', '431940', '441940', '451940']);
    expect(deriveAdminPassword({deviceId: 'DEVICE-002', localDate: localDate(10)})).toBe('201940');
  });

  it('uses parsed identity, accepts only unknown fallback, and honors the three-hour window', () => {
    const identity = {available: true, deviceId: 'DEVICE-001'} as const;
    expect(
      verifyAdminPassword({
        identity,
        attempt: deriveAdminPassword({deviceId: identity.deviceId, localDate: localDate(10)}),
        localDate: localDate(10),
      }),
    ).toBe(true);
    expect(
      verifyAdminPassword({
        identity,
        attempt: deriveAdminPassword({deviceId: identity.deviceId, localDate: localDate(9)}),
        localDate: localDate(10),
      }),
    ).toBe(true);
    expect(
      verifyAdminPassword({
        identity,
        attempt: deriveAdminPassword({deviceId: identity.deviceId, localDate: localDate(12)}),
        localDate: localDate(11),
      }),
    ).toBe(true);
    expect(verifyAdminPassword({identity, attempt: ADMIN_PASSWORD_FALLBACK, localDate: localDate(10)})).toBe(false);
    expect(verifyAdminPassword({identity, attempt: '000000', localDate: localDate(10)})).toBe(false);
    expect(verifyAdminPassword({identity, attempt: ADMIN_PASSWORD_FALLBACK, localDate: null})).toBe(false);
    expect(
      verifyAdminPassword({
        identity: {available: false, deviceId: null},
        attempt: ADMIN_PASSWORD_FALLBACK,
        localDate: null,
      }),
    ).toBe(true);
    expect(
      verifyAdminPassword({identity: {available: false, deviceId: null}, attempt: '000000', localDate: null}),
    ).toBe(false);
  });
});

describe('admin section command boundary', () => {
  it('rejects navigation commands before they can reach business state', async () => {
    const boundary = createAdminSectionCommandBoundary();
    await expect(
      boundary.dispatch({
        definition: openLayerCommand,
        payload: {
          displayMode: 'PRIMARY',
          layerId: 'business-layer',
          partKey: 'business.part',
        },
      }),
    ).rejects.toBeInstanceOf(AdminNavigationRejectedError);
  });
});
