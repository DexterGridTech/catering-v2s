import type {NodeId} from '@catering-v2s/kernel-base-contracts'
import type {PlatformPorts} from '@catering-v2s/kernel-base-platform-ports'
import type {
  PersistenceOperationResult,
  StateRoot,
  StateRuntime,
} from '@catering-v2s/kernel-base-state'
import type {CommandDispatchOptions, CommandDefinition} from '../types/command'
import type {CommandDispatchResult} from '../types/execution'
import type {
  RuntimeModule,
  RuntimeModuleContext,
  RuntimeModuleDescriptor,
  RuntimeModulePreSetupContext,
  RuntimeModuleResetInput,
} from '../types/module'
import type {PeerDispatchGateway} from '../types/peer'
import type {RuntimeUnknownAction} from '../types/runtime'
import {createStateSubscription} from './createStateSubscription'

type DispatchCommand = <TPayload extends import('@catering-v2s/kernel-base-state').StateJsonValue>(
  definition: CommandDefinition<TPayload>,
  payload: TPayload,
  options?: CommandDispatchOptions,
) => Promise<CommandDispatchResult>

type RuntimeLifecycleInput = Readonly<{
  modules: readonly RuntimeModule[]
  descriptors: readonly RuntimeModuleDescriptor[]
  localNodeId: NodeId
  platformPorts: PlatformPorts
  getStateRuntime: () => StateRuntime | undefined
  dispatchCommand: DispatchCommand
  installPeerDispatchGateway: (gateway: PeerDispatchGateway) => void
  dispatchAction: (action: RuntimeUnknownAction) => RuntimeUnknownAction
  registerResource: (cleanup: () => void) => () => void
}> 

const requireStateRuntime = (input: RuntimeLifecycleInput): StateRuntime => {
  const stateRuntime = input.getStateRuntime()
  if (stateRuntime === undefined) {
    throw new Error('State runtime is not available during this lifecycle phase')
  }
  return stateRuntime
}

const createModuleContext = (
  input: RuntimeLifecycleInput,
  module: RuntimeModule,
): RuntimeModuleContext => {
  const stateRuntime = requireStateRuntime(input)
  return Object.freeze({
    moduleName: module.moduleName,
    localNodeId: input.localNodeId,
    platformPorts: input.platformPorts,
    descriptors: input.descriptors,
    getState: (): StateRoot => stateRuntime.getState(),
    flushPersistence: (): Promise<PersistenceOperationResult> => stateRuntime.flushPersistence(),
    subscribeState: (listener: () => void): (() => void) => createStateSubscription(
      stateRuntime.getStore(),
      listener,
      input.registerResource,
    ),
    registerResource: input.registerResource,
    dispatchCommand: input.dispatchCommand,
    installPeerDispatchGateway: input.installPeerDispatchGateway,
  })
}

export const createRuntimeLifecycle = (input: RuntimeLifecycleInput) => {
  const runPreSetup = async (): Promise<void> => {
    for (const module of input.modules) {
      const context: RuntimeModulePreSetupContext = Object.freeze({
        moduleName: module.moduleName,
        localNodeId: input.localNodeId,
        platformPorts: input.platformPorts,
        descriptors: input.descriptors,
      })
      await module.preSetup?.(context)
    }
  }

  const runInstall = async (): Promise<void> => {
    for (const module of input.modules) {
      await module.install?.(createModuleContext(input, module))
    }
  }

  const runResetHooks = async (resetInput: RuntimeModuleResetInput): Promise<void> => {
    for (const module of input.modules) {
      await module.onApplicationReset?.(createModuleContext(input, module), resetInput)
    }
  }

  return Object.freeze({
    runPreSetup,
    runInstall,
    runResetHooks,
  })
}
