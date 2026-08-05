import {theme, type ThemeConfig} from 'antd';

export const platformAdminThemeProfile = {
  id: 'platform-admin-default',
  consumerFace: 'platform-admin',
  colorScheme: 'light',
  proLayoutNavTheme: 'light',
  theme: {
    algorithm: [theme.defaultAlgorithm, theme.compactAlgorithm],
    cssVar: {key: 'platform-admin', prefix: 'platform-admin'},
    components: {
      Layout: {
        headerBg: 'var(--platform-admin-color-bg-container)',
        bodyBg: 'var(--platform-admin-color-bg-layout)',
        footerBg: 'var(--platform-admin-color-bg-layout)',
        siderBg: 'var(--platform-admin-color-bg-container)',
        lightSiderBg: 'var(--platform-admin-color-bg-container)',
        lightTriggerBg: 'var(--platform-admin-color-bg-container)',
        headerColor: 'var(--platform-admin-color-text)',
        lightTriggerColor: 'var(--platform-admin-color-text)',
      },
    },
    token: {
      colorPrimary: '#1677ff', colorSuccess: '#52c41a', colorWarning: '#faad14', colorError: '#ff4d4f', colorInfo: '#1677ff',
      colorTextBase: '#262626', colorBgBase: '#ffffff',
      colorPrimaryBg: '#e6f4ff', colorPrimaryBgHover: '#bae0ff', colorPrimaryBorder: '#91caff', colorPrimaryBorderHover: '#69b1ff', colorPrimaryHover: '#4096ff', colorPrimaryActive: '#0958d9', colorPrimaryText: '#1677ff', colorPrimaryTextHover: '#4096ff', colorPrimaryTextActive: '#0958d9',
      colorSuccessBg: '#f6ffed', colorSuccessBgHover: '#d9f7be', colorSuccessBorder: '#b7eb8f', colorSuccessBorderHover: '#95de64', colorSuccessHover: '#73d13d', colorSuccessActive: '#389e0d', colorSuccessText: '#52c41a', colorSuccessTextHover: '#73d13d', colorSuccessTextActive: '#389e0d',
      colorWarningBg: '#fffbe6', colorWarningBgHover: '#fff1b8', colorWarningBorder: '#ffe58f', colorWarningBorderHover: '#ffd666', colorWarningHover: '#ffc53d', colorWarningActive: '#d48806', colorWarningText: '#faad14', colorWarningTextHover: '#ffc53d', colorWarningTextActive: '#d48806',
      colorErrorBg: '#fff2f0', colorErrorBgHover: '#ffccc7', colorErrorBorder: '#ffa39e', colorErrorBorderHover: '#ff7875', colorErrorHover: '#ff7875', colorErrorActive: '#d9363e', colorErrorText: '#ff4d4f', colorErrorTextHover: '#ff7875', colorErrorTextActive: '#d9363e',
      colorInfoBg: '#e6f4ff', colorInfoBgHover: '#bae0ff', colorInfoBorder: '#91caff', colorInfoBorderHover: '#69b1ff', colorInfoHover: '#4096ff', colorInfoActive: '#0958d9', colorInfoText: '#1677ff', colorInfoTextHover: '#4096ff', colorInfoTextActive: '#0958d9',
      colorText: 'rgba(0, 0, 0, 0.88)', colorTextSecondary: 'rgba(0, 0, 0, 0.65)', colorTextTertiary: 'rgba(0, 0, 0, 0.45)', colorTextQuaternary: 'rgba(0, 0, 0, 0.25)', colorTextDisabled: 'rgba(0, 0, 0, 0.25)',
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorBgLayout: '#f5f5f5', colorBgSpotlight: 'rgba(0, 0, 0, 0.85)', colorBgMask: 'rgba(0, 0, 0, 0.45)', colorBorder: '#d9d9d9', colorBorderSecondary: '#f0f0f0', borderRadius: 6,
      borderRadiusXS: 2,
      borderRadiusSM: 4,
      borderRadiusLG: 8,
      padding: 16,
      paddingSM: 12,
      paddingLG: 24,
      margin: 16,
      marginSM: 12,
      marginLG: 24,
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.18)',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: 14,
    },
  } satisfies ThemeConfig,
} as const;

export const platformAdminTheme = platformAdminThemeProfile.theme;
export const platformAdminChromeProps = {
  'data-chrome-profile': platformAdminThemeProfile.id,
  'data-consumer-face': platformAdminThemeProfile.consumerFace,
} as const;
