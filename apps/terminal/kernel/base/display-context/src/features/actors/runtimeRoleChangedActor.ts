import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import type {ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import {runtimeInstanceModeChangedCommand} from '@catering-v2s/kernel-base-runtime';
import {setDisplayRoleAction} from '../slices/displayRole';
import {selectDisplayRole} from '../../selectors/selectDisplayRole';
import {createDisplayError} from '../../foundations/displayErrors';
import {persistDisplayRole} from '../../foundations/persistDisplayRole';
import {isRuntimeInstanceMode} from '../../foundations/runtimeInstanceMode';

export const createRuntimeRoleChangedActor = (): ActorDefinition =>
  defineActor(moduleName, 'runtime-role-changed', [
    onCommand(runtimeInstanceModeChangedCommand, async context => {
      const payload = context.command.payload;
      const previousMode =
        typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'previousMode') : undefined;
      const nextMode = typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'nextMode') : undefined;
      if (!isRuntimeInstanceMode(previousMode) || !isRuntimeInstanceMode(nextMode)) {
        throw createDisplayError(context, 'Runtime role-change payload is invalid', {
          reasonCode: 'invalid-runtime-role-change',
        });
      }
      if (previousMode === nextMode) return Object.freeze({changed: false, reason: 'idempotent'});
      const previousRole = selectDisplayRole(context.getState());
      if (previousRole === 'CHIEF') {
        return Object.freeze({changed: false, previousRole, currentRole: previousRole, reason: 'already-chief'});
      }
      context.dispatchAction(setDisplayRoleAction('CHIEF'));
      const persistence = await persistDisplayRole(context);
      return Object.freeze({
        changed: true,
        previousRole,
        currentRole: 'CHIEF' as const,
        previousMode,
        nextMode,
        ...persistence,
      });
    }),
  ]);
