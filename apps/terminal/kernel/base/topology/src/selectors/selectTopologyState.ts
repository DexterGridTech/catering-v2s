import type {StateRoot} from '@catering-v2s/kernel-base-state'
import {moduleName} from '../moduleName'
import type {TopologyState} from '../types/state'

export type {TopologyState} from '../types/state'

export const topologySliceName = `${moduleName}.state` as const

export const selectTopologyState = (state: StateRoot): TopologyState => {
  const value = state[topologySliceName]
  if (value === undefined || value === null) throw new Error(`Missing topology slice: ${topologySliceName}`)
  return value as TopologyState
}
