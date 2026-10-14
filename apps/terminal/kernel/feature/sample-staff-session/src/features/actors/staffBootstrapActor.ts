import type {ActorDefinition, ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import {
  bootstrapSessionCommand,
  sessionRestoredAnonymousCommand,
  sessionRestoredAuthenticatedCommand,
} from '../../declarations/commands';
import {moduleName} from '../../moduleName';
import {selectSessionState} from '../../selectors/selectSessionState';

const dispatchRestoreEvent = async (context: ActorExecutionContext): Promise<void> => {
  const state = selectSessionState(context.getState());
  if (state.status === 'authenticated' && state.operatorName !== null) {
    await context.dispatchCommand(sessionRestoredAuthenticatedCommand, {operatorName: state.operatorName});
    return;
  }
  await context.dispatchCommand(sessionRestoredAnonymousCommand, {});
};

export const createStaffBootstrapActor = (): ActorDefinition =>
  defineActor(moduleName, 'bootstrap', [
    onCommand(bootstrapSessionCommand, async context => {
      await dispatchRestoreEvent(context);
      return null;
    }),
  ]);
