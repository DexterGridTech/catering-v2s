import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime'
import type {ActorDefinition} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from '../../moduleName'
import {validateHydratedDisplayRoleCommand} from '../commands/validateHydratedDisplayRole'
import {setDisplayRoleAction} from '../slices/displayRole'
import {selectDisplayRole} from '../../selectors/selectDisplayRole'
import {createDisplayError, logDisplayDiagnostic} from '../../foundations/displayErrors'
import {readDisplayInfo, toDisplayInfoDiagnostic} from '../../foundations/displayDevice'
import {persistDisplayRole} from '../../foundations/persistDisplayRole'

const toDiagnostic = (
  displayInfo: Awaited<ReturnType<typeof readDisplayInfo>>,
): Readonly<Record<string, string | number | null>> => displayInfo.status === 'unavailable'
  ? toDisplayInfoDiagnostic(displayInfo)
  : displayInfo.status === 'malformed'
    ? {status: displayInfo.portStatus, reason: 'MALFORMED_DISPLAY_COUNT'}
    : {status: displayInfo.status, reason: 'MULTIPLE_PHYSICAL_DISPLAYS'}

export const createValidateHydratedDisplayRoleActor = (): ActorDefinition => defineActor(moduleName, 'validate-hydrated-role', [
  onCommand(validateHydratedDisplayRoleCommand, async context => {
    const currentRole = selectDisplayRole(context.getState())
    if (currentRole === 'CHIEF') {
      return Object.freeze({changed: false, previousRole: 'CHIEF' as const, currentRole: 'CHIEF' as const, reason: 'already-chief'})
    }
    const displayInfo = await readDisplayInfo(context.platformPorts.device)
    if (displayInfo.status === 'valid' && displayInfo.displayCount === 1) {
      return Object.freeze({changed: false, previousRole: 'VICE' as const, currentRole: 'VICE' as const, reason: 'single-display-confirmed'})
    }

    const diagnostic = toDiagnostic(displayInfo)
    logDisplayDiagnostic(context, 'display-role.startup-corrected', 'Hydrated VICE role was corrected to CHIEF', diagnostic)
    context.dispatchAction(setDisplayRoleAction('CHIEF'))
    const persistence = await persistDisplayRole(context)
    return Object.freeze({
      changed: true,
      previousRole: 'VICE' as const,
      currentRole: 'CHIEF' as const,
      reason: displayInfo.status === 'unavailable'
        ? 'display-info-unavailable'
        : displayInfo.status === 'malformed'
          ? 'display-info-malformed'
          : 'multiple-physical-displays',
      diagnostic,
      ...persistence,
    })
  }),
])
