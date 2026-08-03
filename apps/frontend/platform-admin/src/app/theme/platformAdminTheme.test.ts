import {describe, expect, it} from 'vitest';
import {theme} from 'antd';
import {platformAdminThemeProfile} from './platformAdminTheme';

describe('platform-admin theme profile', () => {
  it('uses the approved soft green light palette without changing operations-admin theme', () => {
    expect(platformAdminThemeProfile.colorScheme).toBe('light');
    expect(platformAdminThemeProfile.theme.algorithm).toEqual([
      theme.defaultAlgorithm,
      theme.compactAlgorithm,
    ]);
    expect(platformAdminThemeProfile.theme.components?.Layout).toMatchObject({
      headerBg: 'var(--platform-admin-color-bg-container)',
      bodyBg: 'var(--platform-admin-color-bg-layout)',
      siderBg: 'var(--platform-admin-color-bg-container)',
    });
    expect(platformAdminThemeProfile.theme.token?.colorPrimary).toBe('#83b198');
    expect(platformAdminThemeProfile.theme.token?.colorBgBase).toBe('#f8f9f7');
    expect(platformAdminThemeProfile.theme.token?.colorTextBase).toBe('#4a5a52');
    expect(platformAdminThemeProfile.theme.token?.borderRadius).toBe(8);
  });
});
