import {describe, expect, it} from 'vitest';
import {theme} from 'antd';
import {platformAdminThemeProfile} from './platformAdminTheme';

describe('platform-admin theme profile', () => {
  it('uses the requested platform-admin light palette from one app-owned profile', () => {
    expect(platformAdminThemeProfile.colorScheme).toBe('light');
    expect(platformAdminThemeProfile.theme.algorithm).toEqual([theme.defaultAlgorithm, theme.compactAlgorithm]);
    expect(platformAdminThemeProfile.theme.components?.Layout).toMatchObject({
      headerBg: 'var(--platform-admin-color-bg-container)',
      bodyBg: 'var(--platform-admin-color-bg-layout)',
      siderBg: 'var(--platform-admin-color-bg-container)',
    });
    expect(platformAdminThemeProfile.theme.token).toMatchObject({
      colorPrimary: '#5c6c85',
      colorSuccess: '#6a9955',
      colorWarning: '#dcb67a',
      colorError: '#c44e52',
      colorInfo: '#5c6c85',
      colorTextBase: '#333842',
      colorBgBase: '#f5f6f8',
      colorPrimaryBg: '#eaecef',
      colorPrimaryBgHover: '#dfe3ea',
      colorPrimaryBorder: '#c9ced6',
      colorPrimaryBorderHover: '#aeb4bf',
      colorPrimaryHover: '#6f7f99',
      colorPrimaryActive: '#4b586e',
      colorPrimaryText: '#5c6c85',
      colorPrimaryTextHover: '#6f7f99',
      colorPrimaryTextActive: '#4b586e',
      colorSuccessBg: '#f2f6ef',
      colorSuccessText: '#6a9955',
      colorWarningBg: '#fbf6ed',
      colorWarningText: '#dcb67a',
      colorErrorBg: '#f9ecec',
      colorErrorText: '#c44e52',
      colorInfoBg: '#eaecef',
      colorInfoText: '#5c6c85',
      colorText: 'rgba(51, 56, 66, 0.85)',
      colorTextSecondary: 'rgba(51, 56, 66, 0.65)',
      colorTextTertiary: 'rgba(51, 56, 66, 0.45)',
      colorTextQuaternary: 'rgba(51, 56, 66, 0.25)',
      colorTextDisabled: 'rgba(51, 56, 66, 0.25)',
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorBgLayout: '#f5f6f8',
      colorBgSpotlight: 'rgba(51, 56, 66, 0.85)',
      colorBgMask: 'rgba(51, 56, 66, 0.35)',
      colorBorder: '#e4e6eb',
      colorBorderSecondary: '#f0f2f5',
      borderRadius: 4,
      borderRadiusXS: 2,
      borderRadiusSM: 3,
      borderRadiusLG: 6,
      padding: 16,
      paddingSM: 12,
      paddingLG: 20,
      margin: 16,
      marginSM: 12,
      marginLG: 20,
      boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
      boxShadowSecondary: '0 2px 6px 0 rgba(0, 0, 0, 0.08)',
    });
  });
});
