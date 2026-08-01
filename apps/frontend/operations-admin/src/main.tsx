import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {ConfigProvider} from 'antd';
import zhCN from 'antd/locale/zh_CN';
import {ProConfigProvider} from '@ant-design/pro-components';
import {OperationsApp} from './app/OperationsApp';
import {operationsStore} from './app/state/OperationsStore';
import {operationsAdminTheme} from './app/theme/operationsAdminTheme';

createRoot(document.querySelector('#app')!).render(
  <ConfigProvider locale={zhCN} theme={operationsAdminTheme}>
    <ProConfigProvider>
      <Provider store={operationsStore}><OperationsApp/></Provider>
    </ProConfigProvider>
  </ConfigProvider>,
);
