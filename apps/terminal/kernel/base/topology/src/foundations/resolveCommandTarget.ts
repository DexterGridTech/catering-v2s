import type {
  CommandTargetResolver,
} from '@catering-v2s/kernel-base-runtime'
import {selectTopologyFacts} from '../selectors/selectTopologyFacts'

type DisplayMode = 'PRIMARY' | 'SECONDARY'

const readDisplayMode = (value: unknown): DisplayMode | undefined => {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = Reflect.get(value, 'displayMode')
  return candidate === 'PRIMARY' || candidate === 'SECONDARY' ? candidate : undefined
}

/**
 * Resolves topology-sensitive dispatches at the runtime boundary. The
 * resolver returns undefined when topology has no special routing decision so
 * the command definition's existing default target remains authoritative.
 * Reachability is deliberately not a fallback: an unavailable peer must
 * produce a peer error instead of silently mutating the local machine.
 */
export const resolveTopologyCommandTarget: CommandTargetResolver = input => {
  const facts = selectTopologyFacts(input.state)
  const displayMode = readDisplayMode(input.payload) ?? input.routeContext?.displayMode

  if (input.routeIntent === 'peer-intent') {
    return facts.instanceMode === 'SLAVE' && facts.paired ? 'peer' : undefined
  }

  if (
    displayMode === 'SECONDARY'
    && facts.instanceMode === 'MASTER'
    && facts.paired
    && (facts.displayCount === null || facts.displayCount === 1)
  ) {
    return 'peer'
  }

  return undefined
}
