import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime'
import {moduleName as state} from '@catering-v2s/kernel-base-state'
import {moduleName as uiState} from '@catering-v2s/kernel-base-ui-state'
import {moduleName as wallpaper} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {moduleName as primitives} from '@catering-v2s/ui-base-primitives'
import {moduleName as render} from '@catering-v2s/ui-base-render'

export const dependencyModuleNames = [
  state,
  uiState,
  runtime,
  wallpaper,
  render,
  primitives,
] as const

export const devDependencyModuleNames = [] as const
