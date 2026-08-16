import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {ConfigProvider} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import {ProConfigProvider} from '@ant-design/pro-components';
import {OperationsApp} from './app/OperationsApp';
import {operationsStore} from './app/state/OperationsStore';
import {operationsAdminTheme, operationsAdminThemeProfile} from './app/theme/operationsAdminTheme';

document.documentElement.dataset.chromeProfile = operationsAdminThemeProfile.id;
document.documentElement.dataset.consumerFace = operationsAdminThemeProfile.consumerFace;
document.documentElement.style.colorScheme = operationsAdminThemeProfile.colorScheme;

createRoot(document.querySelector('#app')!).render(
  <ConfigProvider locale={zhCN} theme={operationsAdminTheme}>
    <ProConfigProvider>
      <Provider store={operationsStore}>
        <OperationsApp />
      </Provider>
    </ProConfigProvider>
  </ConfigProvider>,
);
