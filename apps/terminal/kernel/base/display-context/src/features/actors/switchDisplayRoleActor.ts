import {selectRuntimeInstanceMode, onCommand, defineActor} from '@catering-v2s/kernel-base-runtime';
import type {ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import {switchDisplayRoleCommand} from '../commands/switchDisplayRole';
import {setDisplayRoleAction} from '../slices/displayRole';
import {selectDisplayRole} from '../../selectors/selectDisplayRole';
import {getDisplayRoleChangeEligibility} from '../../foundations/displayDerivation';
import {createDisplayError, logDisplayDiagnostic} from '../../foundations/displayErrors';
import {readDisplayInfo, toDisplayInfoDiagnostic} from '../../foundations/displayDevice';
import {persistDisplayRole} from '../../foundations/persistDisplayRole';
import {isDisplayRole, type DisplayRole} from '../../types/display';

const readRole = (value: unknown): DisplayRole | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = Reflect.get(value, 'displayRole');
  return isDisplayRole(candidate) ? candidate : undefined;
};

export const createSwitchDisplayRoleActor = (): ActorDefinition =>
  defineActor(moduleName, 'switch-display-role', [
    onCommand(switchDisplayRoleCommand, async context => {
      const targetRole = readRole(context.command.payload);
      if (targetRole === undefined) {
        throw createDisplayError(context, 'Display role payload must be CHIEF or VICE', {
          reasonCode: 'invalid-display-role',
        });
      }
      const currentRole = selectDisplayRole(context.getState());
      const instanceMode = selectRuntimeInstanceMode(context.getState());
      if (targetRole === currentRole) {
        return Object.freeze({
          changed: false,
          previousRole: currentRole,
          currentRole,
          persistenceStatus: 'succeeded' as const,
          persistenceFailureCount: 0,
        });
      }

      const precheck = getDisplayRoleChangeEligibility({
        currentRole,
        targetRole,
        instanceMode,
        routeDisplayMode: context.command.routeContext?.displayMode,
        displayCount: 1,
      });
      if (!precheck.allowed) {
        throw createDisplayError(context, 'Display role change rejected by route or instance policy', {
          reasonCode: precheck.reasonCode,
        });
      }

      if (targetRole === 'CHIEF') {
        context.dispatchAction(setDisplayRoleAction(targetRole));
        const persistence = await persistDisplayRole(context);
        return Object.freeze({
          changed: true,
          previousRole: currentRole,
          currentRole: targetRole,
          ...persistence,
        });
      }

      const displayInfo = await readDisplayInfo(context.platformPorts.device);
      if (displayInfo.status === 'unavailable') {
        logDisplayDiagnostic({
          context,
          event: 'display-role.display-info-unavailable',
          message: 'Display role change has no usable display info',
          data: {...toDisplayInfoDiagnostic(displayInfo)},
        });
        throw createDisplayError(context, 'Display info was not available', {
          ...toDisplayInfoDiagnostic(displayInfo, 'portStatus'),
        });
      }
      if (displayInfo.status === 'malformed') {
        logDisplayDiagnostic({
          context,
          event: 'display-role.display-info-malformed',
          message: 'Display role change received malformed display info',
          data: {
            reason: 'MALFORMED_DISPLAY_COUNT',
            valueType: displayInfo.valueType,
          },
        });
        throw createDisplayError(context, 'Display info was malformed', {
          reasonCode: 'malformed-display-count',
        });
      }

      const eligibility = getDisplayRoleChangeEligibility({
        currentRole,
        targetRole,
        instanceMode,
        routeDisplayMode: context.command.routeContext?.displayMode,
        displayCount: displayInfo.displayCount,
      });
      if (!eligibility.allowed) {
        throw createDisplayError(context, 'Display role change rejected by display policy', {
          reasonCode: eligibility.reasonCode,
          displayCount: displayInfo.displayCount,
        });
      }

      context.dispatchAction(setDisplayRoleAction(targetRole));
      const persistence = await persistDisplayRole(context);
      return Object.freeze({
        changed: true,
        previousRole: currentRole,
        currentRole: targetRole,
        ...persistence,
      });
    }),
  ]);
