import type {ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import {logoutCommand, logoutSucceededCommand} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {sessionActions} from '../slices/staffSession';

export const createStaffLogoutActor = (): ActorDefinition =>
  defineActor(moduleName, 'logout', [
    onCommand(logoutCommand, async context => {
      context.dispatchAction(sessionActions.setAnonymous());
      await context.dispatchCommand(logoutSucceededCommand, {});
      return null;
    }),
  ]);
