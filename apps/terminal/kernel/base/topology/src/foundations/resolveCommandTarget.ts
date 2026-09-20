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
  if (facts === undefined) return undefined
  const displayMode = readDisplayMode(input.payload) ?? input.routeContext?.displayMode

  if (input.routeIntent === 'peer-intent') {
    // A peer-intent comes from an interactive secondary surface.  The
    // primary surface on a SLAVE is the local BRANCH workspace and must stay
    // local.  Secondary content is owned by the peer's MAIN actor and is
    // projected through state sync; only a secondary interaction travels back
    // to that owner.
    return facts.instanceMode === 'SLAVE' && facts.paired && displayMode === 'SECONDARY'
      ? 'peer'
      : undefined
  }

  return undefined
}
