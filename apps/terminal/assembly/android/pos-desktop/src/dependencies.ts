import {moduleName as adapterAndroidPersistKv} from '@catering-v2s/adapter-android-persist-kv';
import {moduleName as adapterAndroidAppControl} from '@catering-v2s/adapter-android-app-control';
import {moduleName as adapterAndroidDevice} from '@catering-v2s/adapter-android-device';
import {moduleName as adapterAndroidDualScreen} from '@catering-v2s/adapter-android-dual-screen';
import {moduleName as adapterAndroidLogger} from '@catering-v2s/adapter-android-logger';
import {moduleName as kernelBaseContracts} from '@catering-v2s/kernel-base-contracts';
import {moduleName as kernelBaseDisplayContext} from '@catering-v2s/kernel-base-display-context';
import {moduleName as kernelBasePlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName as kernelBaseRuntime} from '@catering-v2s/kernel-base-runtime';
import {moduleName as kernelBaseState} from '@catering-v2s/kernel-base-state';
import {moduleName as kernelBaseTestSupport} from '@catering-v2s/kernel-base-test-support';
import {moduleName as kernelBaseTransport} from '@catering-v2s/kernel-base-transport';
import {moduleName as kernelBaseUiState} from '@catering-v2s/kernel-base-ui-state';
import {moduleName as kernelBaseWorkflow} from '@catering-v2s/kernel-base-workflow';
import {moduleName as uiBaseAdminShell} from '@catering-v2s/ui-base-admin-shell';
import {moduleName as uiBaseAutomation} from '@catering-v2s/ui-base-automation';
import {moduleName as uiBaseInput} from '@catering-v2s/ui-base-input';
import {moduleName as uiBasePrimitives} from '@catering-v2s/ui-base-primitives';
import {moduleName as uiBaseRender} from '@catering-v2s/ui-base-render';
import {moduleName as uiBaseTestSupport} from '@catering-v2s/ui-base-test-support';
import {moduleName as uiIntegrationPlatformConsole} from '@catering-v2s/ui-integration-platform-console';

export const dependencyModuleNames = [
  kernelBaseContracts,
  kernelBasePlatformPorts,
  kernelBaseState,
  kernelBaseRuntime,
  kernelBaseTransport,
  kernelBaseDisplayContext,
  kernelBaseWorkflow,
  kernelBaseUiState,
  kernelBaseTestSupport,
  uiBaseRender,
  uiBaseAutomation,
  uiBasePrimitives,
  uiBaseInput,
  uiBaseAdminShell,
  uiBaseTestSupport,
  uiIntegrationPlatformConsole,
  adapterAndroidPersistKv,
  adapterAndroidDevice,
  adapterAndroidAppControl,
  adapterAndroidLogger,
  adapterAndroidDualScreen,
] as const;

export const devDependencyModuleNames = [] as const;
