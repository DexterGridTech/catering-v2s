import {theme, type ThemeConfig} from 'antd';

export const platformAdminThemeProfile = {
  id: 'platform-admin-default',
  consumerFace: 'platform-admin',
  colorScheme: 'dark',
  proLayoutNavTheme: 'realDark',
  theme: {
    algorithm: [theme.darkAlgorithm, theme.compactAlgorithm],
    cssVar: {key: 'platform-admin', prefix: 'platform-admin'},
    token: {
      borderRadius: 6,
      colorPrimary: '#13c2c2',
      colorLink: '#36cfc9',
      colorLinkActive: '#13c2c2',
      colorLinkHover: '#5cdbd3',
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
