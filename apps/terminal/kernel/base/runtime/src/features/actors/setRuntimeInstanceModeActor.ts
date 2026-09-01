import {onCommand, defineActor} from '../../foundations/defineActor'
import {setRuntimeInstanceModeCommand} from '../commands/setRuntimeInstanceMode'
import {
  createSetRuntimeInstanceModeAction,
} from '../slices/runtimeInstanceMode'
import {selectRuntimeInstanceMode} from '../../selectors/selectRuntimeInstanceMode'
import {moduleName} from '../../moduleName'
import type {ActorDefinition} from '../../types/actor'
import type {
  RuntimeRoleChangeEffect,
  RuntimeRoleChangeSignal,
} from '../../types/module'
import {isRuntimeInstanceMode} from '../../types/role'

export const createSetRuntimeInstanceModeActor = (
  roleEffects: readonly RuntimeRoleChangeEffect[] = [],
  onRoleChange?: (signal: RuntimeRoleChangeSignal) => void,
): ActorDefinition => defineActor(moduleName, 'instance-mode', [
  onCommand(setRuntimeInstanceModeCommand, async context => {
    const payload = context.command.payload
    if (!isRuntimeInstanceMode(payload.instanceMode)) {
      throw new Error('Runtime instance mode must be MASTER or SLAVE')
    }
    const current = selectRuntimeInstanceMode(context.getState())
    if (payload.instanceMode === current) {
      return {
        changed: false,
        previousMode: current,
        currentMode: current,
      }
    }
    onRoleChange?.({
      kind: 'role.change-requested',
      previousMode: current,
      nextMode: payload.instanceMode,
      context,
      visibility: 'internal',
      allowNoActor: false,
    })
    for (const effect of roleEffects) {
      await effect({
        previousMode: current,
        nextMode: payload.instanceMode,
        context,
      })
    }
    context.dispatchAction(createSetRuntimeInstanceModeAction(payload.instanceMode))
    onRoleChange?.({
      kind: 'role.changed',
      previousMode: current,
      nextMode: payload.instanceMode,
      context,
      visibility: 'internal',
      allowNoActor: false,
    })
    return {
      changed: true,
      previousMode: current,
      currentMode: payload.instanceMode,
    }
  }),
])
