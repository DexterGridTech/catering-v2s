import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts'
import {moduleName as runtime} from '@catering-v2s/kernel-base-runtime'
import {moduleName as state} from '@catering-v2s/kernel-base-state'
import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports'

export const dependencyModuleNames = [contracts, runtime, state] as const
export const devDependencyModuleNames = [platformPorts] as const
export const runtimeModuleDependencyNames = [runtime] as const
