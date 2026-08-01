import {theme, type ThemeConfig} from 'antd';

export const operationsAdminTheme: ThemeConfig = {
  algorithm: [theme.defaultAlgorithm, theme.compactAlgorithm],
  cssVar: {key: 'operations-admin', prefix: 'operations-admin'},
  token: {
    borderRadius: 6,
    colorPrimary: '#1677ff',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,
  },
};
