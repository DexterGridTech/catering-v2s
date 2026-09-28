import {
  defineActor,
  onCommand,
  selectRuntimeInstanceMode,
  setRuntimeInstanceModeCommand,
} from '@catering-v2s/kernel-base-runtime';
import type {ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import {switchInstanceModeCommand} from '../commands/switchInstanceMode';
import {getSwitchInstanceModeEligibility} from '../../foundations/displayDerivation';
import {createDisplayError, logDisplayDiagnostic} from '../../foundations/displayErrors';
import {readDisplayInfo, toDisplayInfoDiagnostic} from '../../foundations/displayDevice';
import {isRuntimeInstanceMode} from '../../foundations/runtimeInstanceMode';

export const createSwitchInstanceModeActor = (): ActorDefinition =>
  defineActor(moduleName, 'switch-instance-mode', [
    onCommand(switchInstanceModeCommand, async context => {
      const payload = context.command.payload;
      const requested =
        typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'instanceMode') : undefined;
      if (!isRuntimeInstanceMode(requested)) {
        throw createDisplayError(context, 'Instance mode payload must be MASTER or SLAVE', {
          reasonCode: 'invalid-instance-mode',
        });
      }
      const currentMode = selectRuntimeInstanceMode(context.getState());
      if (requested === currentMode) {
        return Object.freeze({changed: false, previousMode: currentMode, currentMode});
      }

      let displayCount = 1;
      if (requested === 'SLAVE') {
        const displayInfo = await readDisplayInfo(context.platformPorts.device);
        if (displayInfo.status === 'unavailable') {
          logDisplayDiagnostic({
            context,
            event: 'instance-mode.display-info-unavailable',
            message: 'Instance mode change has no usable display info',
            data: {...toDisplayInfoDiagnostic(displayInfo)},
          });
          throw createDisplayError(context, 'Display info was not available', {
            ...toDisplayInfoDiagnostic(displayInfo, 'portStatus'),
          });
        }
        if (displayInfo.status === 'malformed') {
          logDisplayDiagnostic({
            context,
            event: 'instance-mode.display-info-malformed',
            message: 'Instance mode change received malformed display info',
            data: {
              reason: 'MALFORMED_DISPLAY_COUNT',
              valueType: displayInfo.valueType,
            },
          });
          throw createDisplayError(context, 'Display info was malformed', {
            reasonCode: 'malformed-display-count',
          });
        }
        displayCount = displayInfo.displayCount;
      }

      const eligibility = getSwitchInstanceModeEligibility({
        targetMode: requested,
        routeDisplayMode: context.command.routeContext?.displayMode,
        displayCount,
      });
      if (!eligibility.allowed) {
        throw createDisplayError(context, 'Instance mode change rejected by display policy', {
          reasonCode: eligibility.reasonCode,
          displayCount,
        });
      }

      const child = await context.dispatchCommand(
        setRuntimeInstanceModeCommand,
        Object.freeze({instanceMode: requested}),
        {
          requestId: context.command.requestId ?? undefined,
          parentCommandId: context.command.commandId,
          routeContext: context.command.routeContext,
          target: 'local',
        },
      );
      if (child.status !== 'completed') {
        throw createDisplayError(context, 'Runtime instance mode command did not complete', {
          reasonCode: 'runtime-command-not-completed',
          childStatus: child.status,
        });
      }
      return Object.freeze({changed: true, previousMode: currentMode, currentMode: requested});
    }),
  ]);
