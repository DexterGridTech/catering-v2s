import {onCommand, defineActor} from '../../foundations/defineActor';
import {findExpiredRequestLedgerIds} from '../../foundations/findExpiredRequestLedgerIds';
import {moduleName} from '../../moduleName';
import {cleanupRequestLedgerCommand} from '../commands/cleanupRequestLedger';
import {requestLedgerActionsForMode} from '../slices/requestLedger';
import {selectRuntimeInstanceMode} from '../../selectors/selectRuntimeInstanceMode';
import type {ActorDefinition} from '../../types/actor';
import type {RuntimeLimits} from '../../types/limits';

/**
 * The cleanup actor owns the explicit cleanup command.  Reducers only apply
 * the delete action; lifecycle writes separately reuse the same expired-id
 * calculator before inserting a new request.
 */
export const createCleanupRequestLedgerActor = (
  getLimits: () => Pick<RuntimeLimits, 'requestRetentionMs' | 'requestMaxResidenceMs'>,
): ActorDefinition =>
  defineActor(moduleName, 'request-ledger-cleanup', [
    onCommand(cleanupRequestLedgerCommand, context => {
      const mode = selectRuntimeInstanceMode(context.getState());
      const limits = getLimits();
      const requestIds = findExpiredRequestLedgerIds({state: context.getState(), mode, limits});

      if (requestIds.length > 0) {
        context.dispatchAction(requestLedgerActionsForMode(mode).deleteRecords({requestIds}));
      }
      return Object.freeze({deletedRequestIds: Object.freeze(requestIds)});
    }),
  ]);
