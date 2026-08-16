import {describe, expect, it} from 'vitest';
import {theme} from 'antd';
import {operationsAdminThemeProfile} from './operationsAdminTheme';

describe('operations-admin theme profile', () => {
  it('uses the requested operations-admin light palette from one app-owned profile', () => {
    expect(operationsAdminThemeProfile.colorScheme).toBe('light');
    expect(operationsAdminThemeProfile.proLayoutNavTheme).toBe('light');
    expect(operationsAdminThemeProfile.theme.algorithm).toEqual([theme.defaultAlgorithm, theme.compactAlgorithm]);
    expect(operationsAdminThemeProfile.theme.components?.Layout).toMatchObject({
      headerBg: 'var(--operations-admin-color-bg-container)',
      bodyBg: 'var(--operations-admin-color-bg-layout)',
      siderBg: 'var(--operations-admin-color-bg-container)',
      lightSiderBg: 'var(--operations-admin-color-bg-container)',
      lightTriggerBg: 'var(--operations-admin-color-bg-container)',
      lightTriggerColor: 'var(--operations-admin-color-text)',
    });
    expect(operationsAdminThemeProfile.theme.token).toMatchObject({
      colorPrimary: '#1E40AF',
      colorSuccess: '#0EA5E9',
      colorWarning: '#F59E0B',
      colorError: '#EF4444',
      colorInfo: '#3B82F6',
      colorTextBase: '#334155',
      colorBgBase: '#F1F5F9',
      colorPrimaryBg: '#EFF6FF',
      colorPrimaryBorder: '#93C5FD',
      colorPrimaryActive: '#1E3A8A',
      colorSuccessBg: '#F0F9FF',
      colorWarningBg: '#FFFBEB',
      colorErrorBg: '#FEF2F2',
      colorInfoBg: '#EFF6FF',
      colorText: 'rgba(51, 65, 85, 0.90)',
      colorTextSecondary: 'rgba(51, 65, 85, 0.70)',
      colorBgContainer: '#FFFFFF',
      colorBgLayout: '#F1F5F9',
      colorBgMask: 'rgba(51, 65, 85, 0.40)',
      colorBorder: '#E2E8F0',
      borderRadius: 6,
      borderRadiusLG: 8,
      padding: 16,
      paddingSM: 12,
      paddingLG: 24,
      margin: 16,
      marginSM: 12,
      marginLG: 24,
      boxShadow: '0 1px 3px 0 rgba(148, 163, 184, 0.1), 0 1px 2px -1px rgba(148, 163, 184, 0.1)',
      boxShadowSecondary: '0 4px 6px -1px rgba(148, 163, 184, 0.1), 0 2px 4px -2px rgba(148, 163, 184, 0.1)',
    });
  });
});
