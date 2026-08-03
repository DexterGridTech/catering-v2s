import {describe, expect, it} from 'vitest';
import {theme} from 'antd';
import {operationsAdminThemeProfile} from './operationsAdminTheme';

describe('operations-admin theme profile', () => {
  it('uses the approved compact Ant Design light palette from one app-owned profile', () => {
    expect(operationsAdminThemeProfile.colorScheme).toBe('light');
    expect(operationsAdminThemeProfile.proLayoutNavTheme).toBe('light');
    expect(operationsAdminThemeProfile.theme.algorithm).toEqual([
      theme.defaultAlgorithm,
      theme.compactAlgorithm,
    ]);
    expect(operationsAdminThemeProfile.theme.components?.Layout).toMatchObject({
      headerBg: 'var(--operations-admin-color-bg-container)',
      bodyBg: 'var(--operations-admin-color-bg-layout)',
      siderBg: 'var(--operations-admin-color-bg-container)',
      lightSiderBg: 'var(--operations-admin-color-bg-container)',
      lightTriggerBg: 'var(--operations-admin-color-bg-container)',
      lightTriggerColor: 'var(--operations-admin-color-text)',
    });
    expect(operationsAdminThemeProfile.theme.token).toMatchObject({
      colorPrimary: '#1677ff',
      colorBgBase: '#ffffff',
      colorBgLayout: '#f5f5f5',
      colorTextBase: '#262626',
      borderRadius: 6,
      borderRadiusLG: 8,
    });
  });
});
