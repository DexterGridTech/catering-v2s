import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {defineActor, onCommand} from '../../foundations/defineActor';
import {recordLocalInteractionCommand} from '../commands/recordLocalInteraction';
import {recordLocalInteractionAction} from '../slices/localInteraction';
import {selectLastLocalInteraction} from '../../selectors/selectLastLocalInteraction';
import {moduleName} from '../../moduleName';

export const createLocalInteractionActor = () =>
  defineActor(moduleName, 'local-interaction', [
    onCommand(recordLocalInteractionCommand, context => {
      if (context.command.payload.runtimeIdentity !== context.runtimeId) {
        context.platformPorts.logger.warn({
          category: 'runtime.local-interaction',
          event: 'runtime.local-interaction.stale-runtime-ignored',
          message: 'Ignored a local interaction callback from another Runtime instance',
          data: {status: 'ignored'},
        });
        return Object.freeze({recorded: false, reason: 'runtime-identity-mismatch'});
      }
      const current = selectLastLocalInteraction(context.getState());
      context.dispatchAction(recordLocalInteractionAction(nowTimestampMs()));
      return Object.freeze({recorded: true, revision: current.revision + 1});
    }),
  ]);
