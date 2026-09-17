import type {StateRoot} from '@catering-v2s/kernel-base-state'
import {selectDisplayRole} from '@catering-v2s/kernel-base-display-context'
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime'
import {hasTopologySecondarySurface} from '../foundations/evaluateTopologyOperation'
import {selectTopologyState} from './selectTopologyState'
import type {TopologyFacts} from '@catering-v2s/kernel-base-contracts'

export const selectTopologyFacts = (state: StateRoot): TopologyFacts => {
  const topology = selectTopologyState(state)
  const instanceMode = selectRuntimeInstanceMode(state)
  const displayRole = selectDisplayRole(state)
  const paired = topology.masterLocator !== null
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
