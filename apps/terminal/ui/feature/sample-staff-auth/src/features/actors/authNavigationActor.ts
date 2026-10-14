import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {clearLayersCommand, createUiVariableWrite, setUiVariablesCommand} from '@catering-v2s/kernel-base-ui-state';
import {loginSucceededCommand, logoutSucceededCommand} from '@catering-v2s/kernel-feature-sample-staff-session';
import {needToLoginStaffCommand} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {operatorNameVariable} from '../../declarations/variables';
import {isContentOwner, primaryDisplayMode, showLoginStage} from './shared/staffAuthActorSupport';

export const createAuthNavigationActor = (): ActorDefinition =>
  defineActor(moduleName, 'auth-navigation', [
    onCommand(needToLoginStaffCommand, async context => {
      if (!isContentOwner(context)) return null;
      await showLoginStage(context);
      return null;
    }),
    onCommand(logoutSucceededCommand, async context => {
      if (!isContentOwner(context)) return null;
      await context.dispatchCommand(clearLayersCommand, {displayMode: primaryDisplayMode});
      return null;
    }),
    onCommand(loginSucceededCommand, async context => {
      if (!isContentOwner(context)) return null;
      await context.dispatchCommand(setUiVariablesCommand, {
        entries: [createUiVariableWrite(operatorNameVariable, context.command.payload.operatorName)],
      });
      await context.dispatchCommand(clearLayersCommand, {displayMode: primaryDisplayMode});
      return null;
    }),
  ]);
