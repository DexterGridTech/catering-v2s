import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import {showScreenCommand} from '../../declarations/commands';
import {contentActions} from '../slices/contentActions';
import {completeUiStateWrite} from './completeWrite';
import {dispatchContentAction, normalizeShowPayload} from './shared/contentActorSupport';

export const createShowScreenActor = (): ActorDefinition =>
  defineActor(moduleName, 'show-screen', [
    onCommand(showScreenCommand, async context => {
      const payload = normalizeShowPayload(context.command.payload);
      return completeUiStateWrite(
        context,
        dispatchContentAction(context, contentActions.showScreen(payload), payload.workspace),
        'content',
      );
    }),
  ]);
