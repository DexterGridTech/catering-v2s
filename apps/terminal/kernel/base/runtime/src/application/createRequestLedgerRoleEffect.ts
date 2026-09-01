import type {RuntimeRoleChangeEffect} from '../types/module'
import {
  createClearRequestLedgerSliceAction,
  requestLedgerSliceNameForMode,
} from '../features/slices/requestLedger'

/** Clear the half that is about to lose local write ownership before role state changes. */
export const createRequestLedgerRoleEffect = (): RuntimeRoleChangeEffect => ({
  previousMode,
  context,
}) => {
  context.dispatchAction(createClearRequestLedgerSliceAction(
    requestLedgerSliceNameForMode(previousMode),
  ))
}
