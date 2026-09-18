import type {StateRoot} from '@catering-v2s/kernel-base-state'
import {selectDisplayRole} from '@catering-v2s/kernel-base-display-context'
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime'
import {hasTopologySecondarySurface} from '../foundations/evaluateTopologyOperation'
import {selectTopologyState} from './selectTopologyState'
import type {TopologyFacts} from '@catering-v2s/kernel-base-contracts'

export const areTopologyFactsEqual = (
  previous: TopologyFacts | undefined,
  next: TopologyFacts | undefined,
): boolean => {
  if (Object.is(previous, next)) return true
  if (previous === undefined || next === undefined) return false
  return Object.is(previous.surfaceForm, next.surfaceForm)
    && Object.is(previous.displayCount, next.displayCount)
    && Object.is(previous.instanceMode, next.instanceMode)
    && Object.is(previous.displayRole, next.displayRole)
    && Object.is(previous.paired, next.paired)
    && Object.is(previous.peerReachable, next.peerReachable)
    && Object.is(previous.hasTopologySecondarySurface, next.hasTopologySecondarySurface)
    && Object.is(previous.masterLocator, next.masterLocator)
    && Object.is(previous.peerIdentity, next.peerIdentity)
    && Object.is(previous.hostDesired, next.hostDesired)
    && Object.is(previous.hostActual, next.hostActual)
    && Object.is(previous.hostErrorCode, next.hostErrorCode)
}

export const selectTopologyFacts = (state: StateRoot): TopologyFacts => {
  const topology = selectTopologyState(state)
  const instanceMode = selectRuntimeInstanceMode(state)
  const displayRole = selectDisplayRole(state)
  // A slave owns the persisted locator; a master learns its pairing from the
  // accepted peer identity.  Reachability is intentionally independent and is
  // not part of the paired fact.
  const paired = topology.masterLocator !== null
    || (instanceMode === 'MASTER' && topology.peerIdentity !== null)
  return Object.freeze({
    surfaceForm: topology.surfaceForm,
    displayCount: topology.displayCount,
    instanceMode,
    displayRole,
    paired,
    peerReachable: topology.peerReachable,
    hasTopologySecondarySurface: hasTopologySecondarySurface({
      displayCount: topology.displayCount,
      instanceMode,
      paired,
    }),
    masterLocator: topology.masterLocator,
    peerIdentity: topology.peerIdentity,
    hostDesired: topology.hostDesired,
    hostActual: topology.hostActual,
    hostErrorCode: topology.hostErrorCode,
  })
}
