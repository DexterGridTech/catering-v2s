import {definePart} from '@catering-v2s/ui-base-render'
import {AdminLayer} from '../components/AdminLayer'
import {DisplayContextSection} from '../components/sections/DisplayContextSection'
import {PlatformPortsSection} from '../components/sections/PlatformPortsSection'
import {RuntimeSection} from '../components/sections/RuntimeSection'
import {ADMIN_CONSOLE_PART_KEY, ADMIN_SECTION_CONTAINER_KEY} from '../foundations/adminIdentity'

const allForms = ['laptop', 'mobile'] as const
const bothDisplayModes = ['PRIMARY', 'SECONDARY'] as const
const bothWorkspaces = ['MAIN', 'BRANCH'] as const
const bothInstanceModes = ['MASTER', 'SLAVE'] as const
const layerContainer = [] as const
const sectionContainer = [ADMIN_SECTION_CONTAINER_KEY] as const

export const adminConsolePart = definePart({
  partKey: ADMIN_CONSOLE_PART_KEY,
  rendererKey: ADMIN_CONSOLE_PART_KEY,
  containerKeys: layerContainer,
  displayModes: bothDisplayModes,
  workspaces: bothWorkspaces,
  instanceModes: bothInstanceModes,
  surfaceForm: allForms,
  title: '终端管理',
  description: '终端本地只读诊断外壳',
  component: AdminLayer,
  layerGuard: 'decisive',
})

export const platformPortsPart = definePart({
  partKey: 'admin.console.platform-ports',
  rendererKey: 'admin.console.platform-ports',
  containerKeys: sectionContainer,
  displayModes: bothDisplayModes,
  workspaces: bothWorkspaces,
  instanceModes: bothInstanceModes,
  surfaceForm: allForms,
  title: '平台端口',
  description: '按方法显示平台端口能力状态与来源',
  component: PlatformPortsSection,
})

export const runtimePart = definePart({
  partKey: 'admin.console.runtime',
  rendererKey: 'admin.console.runtime',
  containerKeys: sectionContainer,
  displayModes: bothDisplayModes,
  workspaces: bothWorkspaces,
  instanceModes: bothInstanceModes,
  surfaceForm: allForms,
  title: '运行状态',
  description: '显示不可变运行时、调试态与设备标识可用性',
  component: RuntimeSection,
})

export const displayContextPart = definePart({
  partKey: 'admin.console.display-context',
  rendererKey: 'admin.console.display-context',
  containerKeys: sectionContainer,
  displayModes: bothDisplayModes,
  workspaces: bothWorkspaces,
  instanceModes: bothInstanceModes,
  surfaceForm: allForms,
  title: '显示上下文',
  description: '显示形态、画布、角色、实例与承载状态',
  component: DisplayContextSection,
})

export const parts = Object.freeze([
  adminConsolePart,
  platformPortsPart,
  runtimePart,
  displayContextPart,
])

export type AdminShellAssembly = Readonly<{readonly parts: typeof parts}>

export const adminShellAssembly: AdminShellAssembly = Object.freeze({parts})
