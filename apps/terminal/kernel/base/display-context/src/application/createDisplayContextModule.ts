import type {RuntimeModule, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime'
import {runtimeModuleDependencyNames} from '../dependencies'
import {moduleKind, moduleName} from '../moduleName'
import {displayRoleSlice, displayRoleSliceName} from '../features/slices/displayRole'
import {
  powerStatusChangedCommand,
  switchDisplayRoleCommand,
  switchInstanceModeCommand,
  validateHydratedDisplayRoleCommand,
} from '../features/commands'
import {createSwitchDisplayRoleActor} from '../features/actors/switchDisplayRoleActor'
import {createSwitchInstanceModeActor} from '../features/actors/switchInstanceModeActor'
import {createPowerStatusActor} from '../features/actors/powerStatusActor'
import {createValidateHydratedDisplayRoleActor} from '../features/actors/validateHydratedDisplayRoleActor'
import {createRuntimeRoleChangedActor} from '../features/actors/runtimeRoleChangedActor'
import {installPowerStatusBridge} from './createPowerStatusBridge'

export const createDisplayContextModule = (): RuntimeModule => {
  const switchDisplayRoleActor = createSwitchDisplayRoleActor()
  const switchInstanceModeActor = createSwitchInstanceModeActor()
  const powerStatusActor = createPowerStatusActor()
  const validateHydratedDisplayRoleActor = createValidateHydratedDisplayRoleActor()
  const runtimeRoleChangedActor = createRuntimeRoleChangedActor()

  return Object.freeze({
    moduleName,
    kind: moduleKind,
    // The package dependency list is the source-import closure.  Only the
    // runtime owner is a runtime-module edge; contracts, ports and state are
    // toolkits and are not fabricated into the runtime graph.
    dependencies: runtimeModuleDependencyNames.map((name) => ({moduleName: name})),
    commands: [
      {name: switchDisplayRoleCommand.commandName, visibility: switchDisplayRoleCommand.visibility},
      {name: switchInstanceModeCommand.commandName, visibility: switchInstanceModeCommand.visibility},
      {name: powerStatusChangedCommand.commandName, visibility: powerStatusChangedCommand.visibility},
      {name: validateHydratedDisplayRoleCommand.commandName, visibility: validateHydratedDisplayRoleCommand.visibility},
    ],
    commandDefinitions: [
      switchDisplayRoleCommand,
      switchInstanceModeCommand,
      powerStatusChangedCommand,
      validateHydratedDisplayRoleCommand,
    ],
    actors: [
      {name: switchDisplayRoleActor.actorName},
      {name: switchInstanceModeActor.actorName},
      {name: powerStatusActor.actorName},
      {name: validateHydratedDisplayRoleActor.actorName},
      {name: runtimeRoleChangedActor.actorName},
    ],
    actorDefinitions: [
      switchDisplayRoleActor,
      switchInstanceModeActor,
      powerStatusActor,
      validateHydratedDisplayRoleActor,
      runtimeRoleChangedActor,
    ],
    slices: [{name: displayRoleSliceName, persistIntent: 'owner-only' as const}],
    stateSlices: [displayRoleSlice],
    install: async (context: RuntimeModuleContext) => {
      const validation = await context.dispatchCommand(validateHydratedDisplayRoleCommand, Object.freeze({}))
      if (validation.status !== 'completed') {
        throw new Error(`Display role startup validation failed: ${validation.status}`)
      }
      await installPowerStatusBridge(context)
    },
  })
}
