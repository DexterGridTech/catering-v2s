import type {StateRoot} from '@catering-v2s/kernel-base-state'
import type {RuntimeRequestLedgerState} from '../features/slices/requestLedger'

export const readRequestLedgerState = (
  state: StateRoot,
  sliceName: string,
): RuntimeRequestLedgerState | undefined => {
  const slice = state[sliceName]
  return typeof slice === 'object' && slice !== null
    ? slice as RuntimeRequestLedgerState
    : undefined
}
