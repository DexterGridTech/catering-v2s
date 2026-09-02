import {onCommand, defineActor} from '../../foundations/defineActor'
import {moduleName} from '../../moduleName'
import type {ActorDefinition} from '../../types/actor'
import {runtimeInstanceModeChangedCommand} from '../commands/runtimeInstanceModeChanged'
import {
  requestLedgerActionsForMode,
} from '../slices/requestLedger'
import {isRuntimeInstanceMode} from '../../types/role'

export const createRequestLedgerRoleChangedActor = (): ActorDefinition => defineActor(moduleName, 'request-ledger-role-changed', [
  onCommand(runtimeInstanceModeChangedCommand, context => {
    const payload = context.command.payload
    if (!isRuntimeInstanceMode(payload.previousMode) || !isRuntimeInstanceMode(payload.nextMode)) {
      throw new Error('Runtime role-change payload must contain valid instance modes')
    }
    if (payload.previousMode === payload.nextMode) return Object.freeze({cleared: false})
    context.dispatchAction(requestLedgerActionsForMode(payload.previousMode).clear())
    return Object.freeze({cleared: true, previousMode: payload.previousMode})
  }),
])
