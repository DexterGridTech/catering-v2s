import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts'
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime'
import {moduleName as state} from '@catering-v2s/kernel-base-state'
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state'
import {moduleName as wallpaper} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives'
import {moduleName as render} from '@catering-v2s/ui-base-render'
import {moduleName as featureAssembly} from '@catering-v2s/ui-base-feature-assembly'
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports'

export const dependencyModuleNames = [
  contracts,
  state,
  uiState,
  runtime,
  wallpaper,
  render,
  primitives,
  featureAssembly,
] as const

export const devDependencyModuleNames = [platformPorts] as const
export const runtimeModuleDependencyNames = [uiState, runtime, wallpaper] as const
