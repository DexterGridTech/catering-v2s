import type {RuntimeModule, RuntimeModuleDescriptor} from '../types/module'
import {freezeList} from '../foundations/freezeList'

export const describeRuntimeModule = (module: RuntimeModule): RuntimeModuleDescriptor =>
  Object.freeze({
    moduleName: module.moduleName,
    kind: module.kind,
    packageVersion: module.packageVersion,
    protocolVersion: module.protocolVersion,
    dependencies: freezeList(module.dependencies ?? []),
    stateSliceNames: freezeList((module.stateSlices ?? []).map(slice => slice.name)),
    commandNames: freezeList((module.commands ?? []).map(command => command.name)),
    actorKeys: freezeList((module.actorDefinitions ?? []).map(actor => `${actor.moduleName}.${actor.actorName}`)),
    hasPreSetup: typeof module.preSetup === 'function',
    hasInstall: typeof module.install === 'function',
    hasReset: typeof module.onApplicationReset === 'function',
  })
