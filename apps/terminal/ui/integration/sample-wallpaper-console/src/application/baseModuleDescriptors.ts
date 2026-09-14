import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'

const contractsModuleName = 'kernel.base.contracts' as const
const platformPortsModuleName = 'kernel.base.platform-ports' as const
const stateModuleName = 'kernel.base.state' as const

const descriptor = (moduleName: string, dependencies: readonly string[]): RuntimeModule => Object.freeze({
  moduleName,
  kind: 'toolkit' as const,
  dependencies: Object.freeze(dependencies.map(dependency => Object.freeze({moduleName: dependency}))),
})

export const createBaseModuleDescriptors = (): readonly RuntimeModule[] => Object.freeze([
  descriptor(contractsModuleName, []),
  descriptor(platformPortsModuleName, [contractsModuleName]),
  descriptor(stateModuleName, [contractsModuleName, platformPortsModuleName]),
])
