import {describe, expect, it} from 'vitest';
import {theme} from 'antd';
import {platformAdminThemeProfile} from './platformAdminTheme';

describe('platform-admin theme profile', () => {
  it('uses Dexter-approved standard Ant Design blue palette without changing operations-admin', () => {
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
    expect(platformAdminThemeProfile.theme.token).toMatchObject({
      colorPrimary: '#1677ff', colorSuccess: '#52c41a', colorWarning: '#faad14', colorError: '#ff4d4f', colorInfo: '#1677ff',
      colorBgBase: '#ffffff', colorBgLayout: '#f5f5f5', colorTextBase: '#262626', colorBgMask: 'rgba(0, 0, 0, 0.45)',
      colorBorder: '#d9d9d9', borderRadius: 6, borderRadiusLG: 8, paddingLG: 24, marginLG: 24,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)', boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.18)',
    });
  });
});
