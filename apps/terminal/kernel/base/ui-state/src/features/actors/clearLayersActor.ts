import {defineActor, onCommand, type ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import {clearLayersCommand} from '../../declarations/commands';
import {contentActions} from '../slices/contentActions';
import {completeUiStateWrite} from './completeWrite';
import {dispatchContentAction, normalizeClearLayersPayload} from './shared/contentActorSupport';

export const createClearLayersActor = (): ActorDefinition =>
  defineActor(moduleName, 'clear-layers', [
    onCommand(clearLayersCommand, async context => {
      const payload = normalizeClearLayersPayload(context.command.payload);
      return completeUiStateWrite(
        context,
        dispatchContentAction(context, contentActions.clearLayers(payload)),
        'content',
      );
    }),
  ]);
