import {
  defineActor,
  onCommand,
  selectRuntimeInstanceMode,
} from '@catering-v2s/kernel-base-runtime'
import type {ActorDefinition} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from '../../moduleName'
import {powerStatusChangedCommand} from '../commands/powerStatusChanged'
import {setDisplayRoleAction} from '../slices/displayRole'
import {selectDisplayRole} from '../../selectors/selectDisplayRole'
import {resolvePowerRoleTarget} from '../../foundations/displayDerivation'
import {createDisplayError, logDisplayDiagnostic} from '../../foundations/displayErrors'
import {readDisplayInfo, toDisplayInfoDiagnostic} from '../../foundations/displayDevice'
import {persistDisplayRole} from '../../foundations/persistDisplayRole'
import {isDisplayRole, isPowerSource, type PowerSource} from '../../types/display'

export const createPowerStatusActor = (): ActorDefinition => defineActor(moduleName, 'power-status', [
  onCommand(powerStatusChangedCommand, async context => {
    const payload = context.command.payload
    const source = typeof payload === 'object' && payload !== null
      ? Reflect.get(payload, 'powerSource')
      : undefined
    if (!isPowerSource(source)) {
      throw createDisplayError(context, 'Power source payload is invalid', {
        reasonCode: 'invalid-power-source',
      })
    }
    const previousRole = selectDisplayRole(context.getState())
    const instanceMode = selectRuntimeInstanceMode(context.getState())
    const displayInfo = await readDisplayInfo(context.platformPorts.device)
    if (displayInfo.status === 'unavailable') {
      logDisplayDiagnostic(context, 'power-status.display-info-unavailable', 'Power event was observed without usable display info', {
        ...toDisplayInfoDiagnostic(displayInfo),
      })
      return Object.freeze({
        changed: false,
        previousRole,
        currentRole: previousRole,
        reason: 'display-info-unavailable',
        diagnostic: Object.freeze(toDisplayInfoDiagnostic(displayInfo)),
      })
    }
    if (displayInfo.status === 'malformed') {
      logDisplayDiagnostic(context, 'power-status.display-info-malformed', 'Power event was observed with malformed display info', {
        reason: 'MALFORMED_DISPLAY_COUNT',
        valueType: displayInfo.valueType,
      })
      return Object.freeze({
        changed: false,
        previousRole,
        currentRole: previousRole,
        reason: 'display-info-malformed',
        diagnostic: Object.freeze({status: 'succeeded', reason: 'MALFORMED_DISPLAY_COUNT'}),
      })
    }

    const targetRole = resolvePowerRoleTarget({
      powerSource: source,
      instanceMode,
      displayRole: previousRole,
      displayCount: displayInfo.displayCount,
    })
    if (targetRole === null || !isDisplayRole(targetRole)) {
      return Object.freeze({
        changed: false,
        previousRole,
        currentRole: previousRole,
        reason: source === 'unknown' ? 'unknown-power-source' : 'not-eligible',
      })
    }

    context.dispatchAction(setDisplayRoleAction(targetRole))
    const persistence = await persistDisplayRole(context)
    return Object.freeze({
      changed: true,
      previousRole,
      currentRole: targetRole,
      ...persistence,
    })
  }),
])
