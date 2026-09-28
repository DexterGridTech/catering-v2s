import {definePart} from '@catering-v2s/ui-base-render';
import type {ComponentType} from 'react';
import {AdminLayerLaptop} from '../components/AdminLayerLaptop';
import {AdminLayerMobile} from '../components/AdminLayerMobile';
import {PlatformPortsSectionLaptop} from '../components/sections/PlatformPortsSectionLaptop';
import {PlatformPortsSectionMobile} from '../components/sections/PlatformPortsSectionMobile';
import {DisplayContextSectionLaptop} from '../components/sections/DisplayContextSectionLaptop';
import {DisplayContextSectionMobile} from '../components/sections/DisplayContextSectionMobile';
import {RuntimeSectionLaptop} from '../components/sections/RuntimeSectionLaptop';
import {RuntimeSectionMobile} from '../components/sections/RuntimeSectionMobile';
import {TopologySectionLaptop} from '../components/sections/TopologySectionLaptop';
import {TopologySectionMobile} from '../components/sections/TopologySectionMobile';
import {PowerRoleConfirmationLaptop} from '../components/PowerRoleConfirmationLaptop';
import {PowerRoleConfirmationMobile} from '../components/PowerRoleConfirmationMobile';
import {ADMIN_CONSOLE_PART_KEY, ADMIN_SECTION_CONTAINER_KEY} from '../foundations/adminIdentity';

const bothDisplayModes = ['PRIMARY', 'SECONDARY'] as const;
const bothWorkspaces = ['MAIN', 'BRANCH'] as const;
const bothInstanceModes = ['MASTER', 'SLAVE'] as const;
const layerContainer = [] as const;
const sectionContainer = [ADMIN_SECTION_CONTAINER_KEY] as const;

type AdminPartSpec = Readonly<{
  readonly partKey: string;
  readonly containerKeys: readonly [] | readonly [typeof ADMIN_SECTION_CONTAINER_KEY];
  readonly title: string;
  readonly description: string;
  readonly component: ComponentType<any>;
  readonly layerTier?: 'standard' | 'alert';
  readonly layerGuard?: 'decisive';
}>;

const createAdminPart = (spec: AdminPartSpec, surfaceForm: 'laptop' | 'mobile') =>
  definePart({
    ...spec,
    rendererKey: `${spec.partKey}.${surfaceForm}`,
    displayModes: bothDisplayModes,
    workspaces: bothWorkspaces,
    instanceModes: bothInstanceModes,
    surfaceForm: [surfaceForm] as const,
  });

const adminConsolePart = (surfaceForm: 'laptop' | 'mobile') =>
  createAdminPart(
    {
      partKey: ADMIN_CONSOLE_PART_KEY,
      containerKeys: layerContainer,
      title: '终端管理',
      description: '终端本地诊断与拓扑管理外壳',
      component: surfaceForm === 'laptop' ? AdminLayerLaptop : AdminLayerMobile,
      layerGuard: 'decisive',
    },
    surfaceForm,
  );

const topologyPart = (surfaceForm: 'laptop' | 'mobile') =>
  createAdminPart(
    {
      partKey: 'admin.console.topology',
      containerKeys: sectionContainer,
      title: '双机拓扑',
      description: '查看并操作主机、副机连接状态',
      component: surfaceForm === 'laptop' ? TopologySectionLaptop : TopologySectionMobile,
    },
    surfaceForm,
  );

const powerConfirmationPart = (surfaceForm: 'laptop' | 'mobile') =>
  createAdminPart(
    {
      partKey: 'admin.console.power-confirmation',
      containerKeys: layerContainer,
      title: '显示角色切换确认',
      description: '确认电源状态触发的显示角色切换',
      component: surfaceForm === 'laptop' ? PowerRoleConfirmationLaptop : PowerRoleConfirmationMobile,
      layerTier: 'alert',
      layerGuard: 'decisive',
    },
    surfaceForm,
  );

const platformPortsPart = (surfaceForm: 'laptop' | 'mobile') =>
  createAdminPart(
    {
      partKey: 'admin.console.platform-ports',
      containerKeys: sectionContainer,
      title: '平台端口',
      description: '按方法显示平台端口能力状态与来源',
      component: surfaceForm === 'laptop' ? PlatformPortsSectionLaptop : PlatformPortsSectionMobile,
    },
    surfaceForm,
  );

const runtimePart = (surfaceForm: 'laptop' | 'mobile') =>
  createAdminPart(
    {
      partKey: 'admin.console.runtime',
      containerKeys: sectionContainer,
      title: '运行状态',
      description: '显示不可变运行时、调试态与设备标识可用性',
      component: surfaceForm === 'laptop' ? RuntimeSectionLaptop : RuntimeSectionMobile,
    },
    surfaceForm,
  );

const displayContextPart = (surfaceForm: 'laptop' | 'mobile') =>
  createAdminPart(
    {
      partKey: 'admin.console.display-context',
      containerKeys: sectionContainer,
      title: '运行状态（显示上下文）',
      description: '显示运行时状态与设备显示事实的 raw catalog part',
      component: surfaceForm === 'laptop' ? DisplayContextSectionLaptop : DisplayContextSectionMobile,
    },
    surfaceForm,
  );

export const adminConsoleLaptopPart = adminConsolePart('laptop');
export const adminConsoleMobilePart = adminConsolePart('mobile');
export const platformPortsLaptopPart = platformPortsPart('laptop');
export const platformPortsMobilePart = platformPortsPart('mobile');
export const runtimeLaptopPart = runtimePart('laptop');
export const runtimeMobilePart = runtimePart('mobile');
export const displayContextLaptopPart = displayContextPart('laptop');
export const displayContextMobilePart = displayContextPart('mobile');
export const topologyLaptopPart = topologyPart('laptop');
export const topologyMobilePart = topologyPart('mobile');
export const powerConfirmationLaptopPart = powerConfirmationPart('laptop');
export const powerConfirmationMobilePart = powerConfirmationPart('mobile');

export const parts = Object.freeze([
  adminConsoleLaptopPart,
  adminConsoleMobilePart,
  platformPortsLaptopPart,
  platformPortsMobilePart,
  runtimeLaptopPart,
  runtimeMobilePart,
  displayContextLaptopPart,
  displayContextMobilePart,
  topologyLaptopPart,
  topologyMobilePart,
  powerConfirmationLaptopPart,
  powerConfirmationMobilePart,
]);

export type AdminShellAssembly = Readonly<{readonly parts: typeof parts}>;

export const adminShellAssembly: AdminShellAssembly = Object.freeze({parts});
