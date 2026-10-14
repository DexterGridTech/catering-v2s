import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import {closeLayerCommand} from '../../declarations/commands';
import {contentActions} from '../slices/contentActions';
import {completeUiStateWrite} from './completeWrite';
import {dispatchContentAction, normalizeCloseLayerPayload} from './shared/contentActorSupport';

export const createCloseLayerActor = (): ActorDefinition =>
  defineActor(moduleName, 'close-layer', [
    onCommand(closeLayerCommand, async context => {
      const payload = normalizeCloseLayerPayload(context.command.payload);
      return completeUiStateWrite(
        context,
        dispatchContentAction(context, contentActions.closeLayer(payload), payload.workspace),
        'content',
      );
    }),
  ]);
