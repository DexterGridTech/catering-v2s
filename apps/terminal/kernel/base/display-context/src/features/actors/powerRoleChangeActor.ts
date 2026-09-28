import {defineActor, onCommand, selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {ActorDefinition, ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import {cancelPowerRoleChangeCommand, confirmPowerRoleChangeCommand, requestPowerRoleChangeCommand} from '../commands';
import {clearPowerConfirmationAction, setDisplayRoleAction, setPowerConfirmationAction} from '../slices/displayRole';
import {selectDisplayRole} from '../../selectors/selectDisplayRole';
import {selectPowerConfirmation} from '../../selectors/selectPowerConfirmation';
import {resolvePowerRoleTarget} from '../../foundations/displayDerivation';
import {createDisplayError, logDisplayDiagnostic} from '../../foundations/displayErrors';
import {readDisplayInfo, toDisplayInfoDiagnostic} from '../../foundations/displayDevice';
import {persistDisplayRole} from '../../foundations/persistDisplayRole';
import {isDisplayRole, isPowerSource, type DisplayRole, type PowerSource} from '../../types/display';
import type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';

const readPowerSource = (value: unknown): PowerSource | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = Reflect.get(value, 'powerSource');
  return isPowerSource(candidate) ? candidate : undefined;
};

const readTargetRole = (value: unknown): DisplayRole | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = Reflect.get(value, 'targetRole');
  return isDisplayRole(candidate) ? candidate : undefined;
};

const noChange = (
  input: Readonly<{
    readonly currentRole: DisplayRole;
    readonly reason: string;
    readonly targetRole?: DisplayRole;
  }>,
): Readonly<Record<string, string | boolean>> =>
  Object.freeze({
    changed: false,
    previousRole: input.currentRole,
    currentRole: input.currentRole,
    reason: input.reason,
    ...(input.targetRole === undefined ? {} : {targetRole: input.targetRole}),
  });

const readDisplaySnapshot = async (context: ActorExecutionContext) => {
  const displayInfo = await readDisplayInfo(context.platformPorts.device);
  if (displayInfo.status === 'unavailable') {
    logDisplayDiagnostic({
      context,
      event: 'power-status.display-info-unavailable',
      message: 'Power event was observed without usable display info',
      data: {...toDisplayInfoDiagnostic(displayInfo)},
    });
    return {displayInfo, diagnostic: toDisplayInfoDiagnostic(displayInfo)} as const;
  }
  if (displayInfo.status === 'malformed') {
    logDisplayDiagnostic({
      context,
      event: 'power-status.display-info-malformed',
      message: 'Power event was observed with malformed display info',
      data: {reason: 'MALFORMED_DISPLAY_COUNT', valueType: displayInfo.valueType},
    });
    return {displayInfo, diagnostic: {status: 'succeeded', reason: 'MALFORMED_DISPLAY_COUNT'} as const} as const;
  }
  return {displayInfo, diagnostic: null} as const;
};

export const createPowerRoleChangeActor = (surfaceForm: SurfaceForm): ActorDefinition =>
  defineActor(moduleName, 'power-role-change', [
    onCommand(requestPowerRoleChangeCommand, async context => {
      const source = readPowerSource(context.command.payload);
      if (source === undefined) {
        throw createDisplayError(context, 'Power source payload is invalid', {reasonCode: 'invalid-power-source'});
      }
      const currentRole = selectDisplayRole(context.getState());
      const instanceMode = selectRuntimeInstanceMode(context.getState());
      const {displayInfo, diagnostic} = await readDisplaySnapshot(context);
      if (displayInfo.status === 'unavailable') {
        return Object.freeze({
          ...noChange({currentRole, reason: 'display-info-unavailable'}),
          diagnostic,
        });
      }
      if (displayInfo.status === 'malformed') {
        return Object.freeze({
          ...noChange({currentRole, reason: 'display-info-malformed'}),
          diagnostic,
        });
      }
      const targetRole = resolvePowerRoleTarget({
        powerSource: source,
        instanceMode,
        displayRole: currentRole,
        displayCount: displayInfo.displayCount,
      });
      if (targetRole === null)
        return noChange({currentRole, reason: source === 'unknown' ? 'unknown-power-source' : 'not-eligible'});
      context.dispatchAction(
        setPowerConfirmationAction({
          powerSource: source,
          targetRole,
          requestedSurfaceForm: surfaceForm,
          requestedInstanceMode: instanceMode,
          requestedDisplayRole: currentRole,
          requestedDisplayCount: displayInfo.displayCount,
        }),
      );
      return Object.freeze({
        changed: false,
        pending: true,
        previousRole: currentRole,
        currentRole,
        targetRole,
        reason: 'awaiting-confirmation',
      });
    }),
    onCommand(confirmPowerRoleChangeCommand, async context => {
      const source = readPowerSource(context.command.payload);
      const targetRole = readTargetRole(context.command.payload);
      if (source === undefined || targetRole === undefined) {
        throw createDisplayError(context, 'Power confirmation payload is invalid', {
          reasonCode: 'invalid-power-confirmation',
        });
      }
      const currentRole = selectDisplayRole(context.getState());
      const currentMode = selectRuntimeInstanceMode(context.getState());
      const pending = selectPowerConfirmation(context.getState());
      const {displayInfo} = await readDisplaySnapshot(context);
      const freshTarget =
        displayInfo.status === 'valid'
          ? resolvePowerRoleTarget({
              powerSource: source,
              instanceMode: currentMode,
              displayRole: currentRole,
              displayCount: displayInfo.displayCount,
            })
          : null;
      const stale =
        pending === null ||
        pending.powerSource !== source ||
        pending.targetRole !== targetRole ||
        pending.requestedSurfaceForm !== surfaceForm ||
        pending.requestedInstanceMode !== currentMode ||
        pending.requestedDisplayRole !== currentRole ||
        displayInfo.status !== 'valid' ||
        pending.requestedDisplayCount !== displayInfo.displayCount ||
        freshTarget !== targetRole;
      if (stale) {
        context.dispatchAction(clearPowerConfirmationAction());
        return noChange({currentRole, reason: 'stale-precondition', targetRole});
      }
      context.dispatchAction(setDisplayRoleAction(targetRole));
      const persistence = await persistDisplayRole(context);
      context.dispatchAction(clearPowerConfirmationAction());
      return Object.freeze({
        changed: true,
        previousRole: currentRole,
        currentRole: targetRole,
        ...persistence,
      });
    }),
    onCommand(cancelPowerRoleChangeCommand, async context => {
      const currentRole = selectDisplayRole(context.getState());
      const pending = selectPowerConfirmation(context.getState());
      if (pending !== null) context.dispatchAction(clearPowerConfirmationAction());
      return noChange({currentRole, reason: 'cancelled'});
    }),
  ]);
