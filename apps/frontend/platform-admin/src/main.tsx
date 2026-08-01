import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {ConfigProvider} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import {ProConfigProvider} from '@ant-design/pro-components';
import {PlatformApp} from './app/PlatformApp';
import {platformStore} from './app/state/PlatformStore';
import {platformAdminTheme, platformAdminThemeProfile} from './app/theme/platformAdminTheme';

document.documentElement.dataset.chromeProfile = platformAdminThemeProfile.id;
document.documentElement.dataset.consumerFace = platformAdminThemeProfile.consumerFace;
document.documentElement.style.colorScheme = platformAdminThemeProfile.colorScheme;

createRoot(document.querySelector('#app')!).render(
  <ConfigProvider locale={zhCN} theme={platformAdminTheme}>
    <ProConfigProvider>
      <Provider store={platformStore}><PlatformApp/></Provider>
    </ProConfigProvider>
  </ConfigProvider>,
);
